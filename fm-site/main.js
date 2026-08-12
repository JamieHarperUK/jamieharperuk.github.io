const siteConfig = {
    canonicalOrigin: typeof window !== "undefined" && window.location && window.location.origin
        ? window.location.origin
        : "https://jamieharperuk.github.io", // GitHub URL or Custom Domain Name
    appBasePath: "/fm-site/" // Application Directory ('/' if hosted at root, or '/[subdirectory]/' if hosted in a subdirectory)
};

const runtimeOrigin = (typeof window !== "undefined" && window.location && window.location.origin)
    ? window.location.origin
    : siteConfig.canonicalOrigin;

function buildFmUrl(path = "", useCanonical = false) {
    const origin = useCanonical ? siteConfig.canonicalOrigin : runtimeOrigin;
    const base = new URL(siteConfig.appBasePath.replace(/^\//, ""), origin.replace(/\/+$/, "") + "/");
    return new URL(path.replace(/^\/+/, ""), base).toString();
}

function buildRootUrl(path = "", useCanonical = false) {
    const origin = useCanonical ? siteConfig.canonicalOrigin : runtimeOrigin;
    return new URL(path.replace(/^\/+/, ""), origin.replace(/\/+$/, "") + "/").toString();
}

const dataSources = {
    games: buildFmUrl("data/games.json"),
    teams: buildFmUrl("data/teams.json"),
    posts: buildFmUrl("data/posts.json")
};

const pushConfig = {
    workerBaseUrl: "",
    siteId: "",
    serviceWorkerPath: "sw.js"
};

const shareConfig = {
    workerBaseUrl: ""
};

const platformLogoUrls = {
    topEleven: buildFmUrl("data/top-eleven-logo.png", true),
    osm: buildFmUrl("data/osm-logo.png", true),
    hattrick: buildFmUrl("data/hattrick-logo.png", true)
};

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

// To be referenced and used when specifically sharing posts on social media platforms like X (formerly Twitter), not Facebook.
const gameTwitterHandles = {
    top_eleven: "@topeleven",
    osm: "@OSMLikeABoss",
    hattrick: "@Hattrick"
};

const app = {
    currentPage: "home",
    analyticsId: "",
    siteMeta: {
        title: "Football Management",
        description: "A white-label football management hub for fixtures, squads, and update posts.",
        image: buildFmUrl("data/fm_bg_thin.png", true)
    },
    data: {
        games: [],
        teams: [],
        posts: [],
        eloRatings: {}
    },
    uiState: {
        pastFixtures: {},
        installPromptEvent: null,
        push: {
            registration: null,
            isSubscribed: false,
            isBusy: false
        }
    },

    async init() {
        try {
            this.captureDefaultSiteMetadata();
            await this.loadData();
            this.setupEloModal();
            this.setupNavigation();
            this.generateTeamPages();
            this.setupHashRouting();
            this.setupInternalLinkNavigation();
            this.setupAnalytics();
            this.setupInstallPrompt();
            this.renderHome();
            await this.setupPushNotifications();
            this.handleRoute();
        } catch (error) {
            this.renderError(error);
        }
    },

    setupInstallPrompt() {
        if (!("serviceWorker" in navigator) || !window.matchMedia) {
            return;
        }

        const installButton = document.getElementById("installFab");

        window.addEventListener("beforeinstallprompt", (event) => {
            event.preventDefault();
            this.uiState.installPromptEvent = event;
            this.syncInstallButton();
        });

        window.addEventListener("appinstalled", () => {
            this.uiState.installPromptEvent = null;
            this.syncInstallButton();
        });

        if (installButton) {
            installButton.addEventListener("click", async () => {
                await this.promptInstallApp();
            });
        }

        navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {
            // Ignore registration errors here; push notifications already handle the worker separately.
        });

        this.syncInstallButton();
    },

    syncInstallButton() {
        const installButton = document.getElementById("installFab");
        const fabGroup = installButton?.closest(".fab-group");
        if (!installButton || !fabGroup) {
            return;
        }

        const isMobileViewport = window.matchMedia("(max-width: 840px)").matches;
        const isInstallAvailable = Boolean(this.uiState.installPromptEvent);
        fabGroup.classList.toggle("is-install-ready", isMobileViewport && isInstallAvailable);
        installButton.disabled = !isMobileViewport || !isInstallAvailable;
        installButton.setAttribute("aria-hidden", String(!(isMobileViewport && isInstallAvailable)));
    },

    async promptInstallApp() {
        const installPromptEvent = this.uiState.installPromptEvent;
        if (!installPromptEvent) {
            return;
        }

        installPromptEvent.prompt();
        const choice = await installPromptEvent.userChoice;
        this.uiState.installPromptEvent = null;
        this.syncInstallButton();

        if (choice?.outcome === "accepted") {
            this.trackEvent("pwa_install_accepted", "PWA", "Install Accepted");
        } else {
            this.trackEvent("pwa_install_dismissed", "PWA", "Install Dismissed");
        }
    },

    setupAnalytics() {
        document.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) {
                return;
            }

            const interactiveElement = target.closest("a, button");
            if (!interactiveElement) {
                return;
            }

            const action = interactiveElement.getAttribute("data-analytics-action") || "click";
            const category = interactiveElement.getAttribute("data-analytics-category") || "Interaction";
            const label = interactiveElement.getAttribute("data-analytics-label") || interactiveElement.textContent?.trim() || interactiveElement.getAttribute("aria-label") || "unknown";

            if (action && category) {
                this.trackEvent(action, category, label);
            }
        });
    },

    trackEvent(action, category, label = "", value) {
        if (typeof window.gtag !== "function") {
            return;
        }

        const payload = {
            event_category: category,
            event_label: label
        };

        if (typeof value !== "undefined") {
            payload.value = value;
        }

        window.gtag("event", action, payload);
    },

    trackPageView(path) {
        if (typeof window.gtag !== "function") {
            return;
        }

        const pagePath = this.getAnalyticsPagePath(path);
        const pageTitle = this.getAnalyticsPageTitle(path);

        window.gtag("config", this.analyticsId, {
            page_path: pagePath,
            page_title: pageTitle
        });

        window.gtag("event", "page_view", {
            page_title: pageTitle,
            page_location: pagePath,
            page_path: pagePath
        });
    },

    getRoutePathFromLocation() {
        const hash = window.location.hash.replace(/^#/, "").trim();
        if (hash) {
            return hash === "home" ? "home" : hash;
        }

        const searchParams = new URLSearchParams(window.location.search);
        const view = searchParams.get("view")?.toLowerCase();
        const slug = searchParams.get("slug")?.trim();

        if (view === "posts") {
            return "posts";
        }

        if (view === "hall-of-fame") {
            return "hall-of-fame";
        }

        if (view === "post" && slug) {
            return `post/${slug}`;
        }

        if (view === "team" && slug) {
            return `team/${slug}`;
        }

        return "home";
    },

    getAnalyticsPagePath(path) {
        if (!path || path === "home") {
            return "/fm/";
        }

        if (path === "posts") {
            return "/fm/?view=posts";
        }

        if (path === "hall-of-fame") {
            return "/fm/?view=hall-of-fame";
        }

        if (path.startsWith("post/")) {
            return `/fm/?view=post&slug=${encodeURIComponent(path.split("/")[1])}`;
        }

        if (path.startsWith("team/")) {
            return `/fm/?view=team&slug=${encodeURIComponent(path.split("/")[1])}`;
        }

        return "/fm/";
    },

    getAnalyticsPageTitle(path) {
        if (!path || path === "home") {
            return "Home";
        }

        if (path === "posts") {
            return "Posts";
        }

        if (path === "hall-of-fame") {
            return "Hall of Fame";
        }

        if (path.startsWith("post/")) {
            const slug = path.split("/")[1];
            const post = this.findPostBySlug(slug);
            return post?.title ? `Post: ${post.title}` : "Post Detail";
        }

        if (path.startsWith("team/")) {
            const teamId = path.split("/")[1];
            const team = this.data.teams.find((item) => this.toTeamId(item.team_name) === teamId);
            return team?.team_name ? `Team: ${team.team_name}` : "Team Page";
        }

        return "Home";
    },

    async loadData() {
        const [gamesResponse, teamsResponse, postsResponse] = await Promise.all([
            fetch(dataSources.games),
            fetch(dataSources.teams),
            fetch(dataSources.posts)
        ]);

        if (!gamesResponse.ok || !teamsResponse.ok || !postsResponse.ok) {
            throw new Error("Unable to load one or more JSON data sources.");
        }

        const [gamesJson, teamsJson, postsJson] = await Promise.all([
            gamesResponse.json(),
            teamsResponse.json(),
            postsResponse.json()
        ]);

        this.data.games = Array.isArray(gamesJson.games) ? gamesJson.games : [];
        this.data.teams = Array.isArray(teamsJson.teams) ? teamsJson.teams : [];
        this.data.posts = Array.isArray(postsJson.posts) ? postsJson.posts : [];
        this.calculateEloRatings();
    },

    normalizePlatformName(rawPlatform) {
        const value = String(rawPlatform || "").trim();
        const key = value.toLowerCase();
        if (key === "osm" || key === "online soccer manager") {
            return "OSM";
        }
        if (key === "top eleven" || key === "topeleven") {
            return "Top Eleven";
        }
        if (key === "hattrick") {
            return "Hattrick";
        }
        return value || "Unknown";
    },

    getPlatformDetails(platformName) {
        const normalized = this.normalizePlatformName(platformName);
        if (normalized === "Top Eleven") {
            return {
                name: "Top Eleven",
                fullName: "Top Eleven",
                logo: platformLogoUrls.topEleven,
                link: "https://www.topeleven.com/",
                invertLogo: true,
                kFactor: 28,
                eloIntro: "This rating is a continuously evolving ELO for this Top Eleven team based on the matches I have recorded."
            };
        }
        if (normalized === "OSM") {
            return {
                name: "OSM",
                fullName: "Online Soccer Manager",
                logo: platformLogoUrls.osm,
                link: "https://www.onlinesoccermanager.com/",
                invertLogo: false,
                kFactor: 24,
                eloIntro: "This rating is a season-style ELO for this OSM team based on the matches I have recorded for that platform."
            };
        }
        if (normalized === "Hattrick") {
            return {
                name: "Hattrick",
                fullName: "Hattrick",
                logo: platformLogoUrls.hattrick,
                link: "https://www86.hattrick.org/Club/?TeamID=3417735",
                invertLogo: false,
                kFactor: 28,
                eloIntro: "This rating is a continuously evolving ELO for this Hattrick team based on the matches I have recorded."
            };
        }
        return {
            name: normalized,
            fullName: normalized,
            logo: "",
            link: "#",
            invertLogo: false,
            kFactor: 24,
            eloIntro: "This rating is calculated from the matches I have recorded for this platform."
        };
    },

    calculateEloRatings() {
        const ratingsByPlatform = {};
        const platformSet = new Set();

        (this.data.teams || []).forEach((team) => {
            platformSet.add(this.normalizePlatformName(team.osm_or_top_eleven));
        });
        (this.data.games || []).forEach((game) => {
            platformSet.add(this.normalizePlatformName(game.osm_or_top_eleven));
        });

        const platforms = [...platformSet].filter((platformName) => platformName && platformName !== "Unknown");

        platforms.forEach((platformName) => {
            const platformTeams = new Set();
            const platformGames = this.data.games.filter((game) => this.normalizePlatformName(game.osm_or_top_eleven) === platformName && this.isPlayed(game));

            (this.data.teams || []).forEach((team) => {
                if (this.normalizePlatformName(team.osm_or_top_eleven) === platformName) {
                    platformTeams.add(team.team_name);
                }
            });

            platformGames.forEach((game) => {
                platformTeams.add(game.home_team);
                platformTeams.add(game.away_team);
            });

            const ratings = {};
            [...platformTeams].forEach((teamName) => {
                ratings[teamName] = 1500;
            });

            const kFactor = this.getPlatformDetails(platformName).kFactor;
            const homeAdvantage = 40;

            platformGames
                .slice()
                .sort((a, b) => this.compareGameDateAsc(a, b))
                .forEach((game) => {
                    const homeRating = ratings[game.home_team];
                    const awayRating = ratings[game.away_team];

                    if (typeof homeRating !== "number" || typeof awayRating !== "number") {
                        return;
                    }

                    const expectedHome = 1 / (1 + Math.pow(10, (awayRating - (homeRating + homeAdvantage)) / 400));
                    const expectedAway = 1 - expectedHome;
                    const homeScore = Number(game.home_score);
                    const awayScore = Number(game.away_score);

                    let actualHome = 0.5;
                    let actualAway = 0.5;

                    if (!Number.isNaN(homeScore) && !Number.isNaN(awayScore)) {
                        if (homeScore > awayScore) {
                            actualHome = 1;
                            actualAway = 0;
                        } else if (homeScore < awayScore) {
                            actualHome = 0;
                            actualAway = 1;
                        }
                    }

                    ratings[game.home_team] = homeRating + kFactor * (actualHome - expectedHome);
                    ratings[game.away_team] = awayRating + kFactor * (actualAway - expectedAway);
                });

            ratingsByPlatform[platformName] = ratings;
        });

        this.data.eloRatings = ratingsByPlatform;
        return ratingsByPlatform;
    },

    setupEloModal() {
        const modal = document.getElementById("eloInfoModal");
        const closeButton = modal?.querySelector(".modal-close");

        if (!modal || !closeButton) {
            return;
        }

        closeButton.addEventListener("click", () => this.closeEloInfoModal());

        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                this.closeEloInfoModal();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                this.closeEloInfoModal();
            }
        });
    },

    openEloInfoModal(team, platform) {
        const modal = document.getElementById("eloInfoModal");
        const content = document.getElementById("eloInfoContent");
        const title = document.getElementById("eloInfoTitle");

        if (!modal || !content || !title) {
            return;
        }

        const platformName = this.normalizePlatformName(platform);
        const platformDetails = this.getPlatformDetails(platformName);
        const intro = platformDetails.eloIntro;

        content.innerHTML = `
            <p style="margin-top: 0rem;">${this.escapeHtml(intro)}</p>
            <ul>
                <li>Each team starts at a baseline rating of 1500.</li>
                <li>Ratings are updated after every played match in date order.</li>
                <li>Wins, draws, and losses are converted into expected outcomes using the current ratings.</li>
                <li>Home advantage is included as a small bump to the home team.</li>
            </ul>
            <p><strong>Caveats:</strong> this is calculated from the results I record in the match data, not from every league game in the wider competition. It also does not factor in yellow or red cards yet (this will be added in a future update), so the rating is based on results rather than disciplinary events.</p>
            <p style="margin-bottom: 0rem;"><strong>${this.escapeHtml(team.team_name)}</strong> is currently being evaluated in the ${this.escapeHtml(platformName)} pool.</p>
        `;

        title.textContent = `${platformDetails.name} ELO Explained`;
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    },

    closeEloInfoModal() {
        const modal = document.getElementById("eloInfoModal");
        if (!modal) {
            return;
        }

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        this.syncBodyModalOpenState();
    },

    syncBodyModalOpenState() {
        const hasOpenModal = Boolean(document.querySelector(".modal-backdrop.is-open"));
        document.body.classList.toggle("modal-open", hasOpenModal);
    },

    setupNavigation() {
        const navLinks = document.getElementById("navLinks");
        if (!navLinks) {
            return;
        }

        navLinks.innerHTML = "";

        const homeLink = document.createElement("a");
        homeLink.href = "#home";
        homeLink.textContent = "Home";
        homeLink.setAttribute("data-analytics-action", "nav_click");
        homeLink.setAttribute("data-analytics-category", "Navigation");
        homeLink.setAttribute("data-analytics-label", "Home");
        navLinks.appendChild(homeLink);

        const dropdown = document.createElement("div");
        dropdown.className = "nav-dropdown";

        const dropdownToggle = document.createElement("button");
        dropdownToggle.className = "nav-dropdown-toggle";
        dropdownToggle.type = "button";
        dropdownToggle.id = "teamsDropdownToggle";
        dropdownToggle.setAttribute("aria-expanded", "false");
        dropdownToggle.setAttribute("data-analytics-action", "nav_click");
        dropdownToggle.setAttribute("data-analytics-category", "Navigation");
        dropdownToggle.setAttribute("data-analytics-label", "Teams Menu");
        dropdownToggle.textContent = "Teams";

        const dropdownMenu = document.createElement("div");
        dropdownMenu.className = "nav-dropdown-menu";
        dropdownMenu.id = "teamsDropdownMenu";

        this.data.teams
            .filter((team) => !team.end_state || typeof team.end_state !== "object")
            .forEach((team) => {
                const teamId = this.toTeamId(team.team_name);
                const link = document.createElement("a");
                link.href = `#team/${teamId}`;
                link.textContent = team.team_name;
                link.setAttribute("data-analytics-action", "team_click");
                link.setAttribute("data-analytics-category", "Navigation");
                link.setAttribute("data-analytics-label", team.team_name);
                link.addEventListener("click", () => {
                    this.closeTeamsDropdown();
                });
                dropdownMenu.appendChild(link);
            });

        dropdownToggle.addEventListener("click", () => {
            const isOpen = dropdown.classList.toggle("open");
            dropdownToggle.setAttribute("aria-expanded", String(isOpen));
        });

        document.addEventListener("click", (event) => {
            if (!dropdown.contains(event.target)) {
                this.closeTeamsDropdown();
            }
        });

        dropdown.appendChild(dropdownToggle);
        dropdown.appendChild(dropdownMenu);
        navLinks.appendChild(dropdown);

        const hallOfFameLink = document.createElement("a");
        hallOfFameLink.href = "#hall-of-fame";
        hallOfFameLink.textContent = "Hall of Fame";
        hallOfFameLink.setAttribute("data-analytics-action", "nav_click");
        hallOfFameLink.setAttribute("data-analytics-category", "Navigation");
        hallOfFameLink.setAttribute("data-analytics-label", "Hall of Fame");
        navLinks.appendChild(hallOfFameLink);

        const postsLink = document.createElement("a");
        postsLink.href = "#posts";
        postsLink.textContent = "Posts";
        postsLink.setAttribute("data-analytics-action", "nav_click");
        postsLink.setAttribute("data-analytics-category", "Navigation");
        postsLink.setAttribute("data-analytics-label", "Posts");
        navLinks.appendChild(postsLink);

        this.updateNavLinks();
    },

    closeTeamsDropdown() {
        const dropdown = document.querySelector(".nav-dropdown");
        const toggle = document.getElementById("teamsDropdownToggle");
        if (dropdown && dropdown.classList.contains("open")) {
            dropdown.classList.remove("open");
        }
        if (toggle) {
            toggle.setAttribute("aria-expanded", "false");
        }
    },

    setupHashRouting() {
        window.addEventListener("hashchange", () => this.handleRoute());
        window.addEventListener("popstate", () => this.handleRoute());
    },

    setupInternalLinkNavigation() {
        document.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) {
                return;
            }

            const link = target.closest("a[href^='#']");
            if (!link) {
                return;
            }

            const route = link.getAttribute("href")?.replace(/^#/, "").trim();
            if (!route) {
                return;
            }

            event.preventDefault();
            this.navigate(route);
        });
    },

    handleRoute() {
        const route = this.getRoutePathFromLocation();

        if (route === "home") {
            this.navigate("home");
            return;
        }

        if (route === "posts") {
            this.navigate("posts");
            return;
        }

        if (route === "hall-of-fame") {
            this.navigate("hall-of-fame");
            return;
        }

        if (route.startsWith("post/")) {
            const postSlug = route.split("/")[1];
            this.navigate(`post/${postSlug}`);
            return;
        }

        if (route.startsWith("team/")) {
            const teamId = route.split("/")[1];
            this.navigate(`team/${teamId}`);
            return;
        }

        window.location.hash = "#home";
    },

    navigate(path) {
        this.currentPage = path;

        const expectedHash = path === "home" ? "#home" : `#${path}`;
        const currentHash = window.location.hash || "";
        if (currentHash !== expectedHash) {
            window.location.hash = expectedHash;
        }

        document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
        this.updateNavLinks();

        if (path === "home") {
            this.renderHome();
            document.getElementById("home")?.classList.add("active");
            this.updatePageMetadata({
                title: this.siteMeta.title,
                description: this.siteMeta.description,
                image: this.siteMeta.image,
                url: this.getCanonicalPageUrl("home")
            });
        } else if (path === "posts") {
            this.renderPostsPage();
            document.getElementById("posts")?.classList.add("active");
            this.updatePageMetadata({
                title: `Posts | ${this.siteMeta.title}`,
                description: "Latest Football Management updates, announcements, and match progress posts.",
                image: this.siteMeta.image,
                url: this.getCanonicalPageUrl("posts")
            });
        } else if (path === "hall-of-fame") {
            this.renderHallOfFamePage();
            document.getElementById("hall-of-fame")?.classList.add("active");
            this.updatePageMetadata({
                title: `Hall of Fame | ${this.siteMeta.title}`,
                description: "Past and finished leagues, seasons, and teams from the Football Management archive.",
                image: this.siteMeta.image,
                url: this.getCanonicalPageUrl("hall-of-fame")
            });
        } else if (path.startsWith("post/")) {
            const postSlug = path.split("/")[1];
            this.renderPostDetailPage(postSlug);
            document.getElementById("post-detail")?.classList.add("active");
        } else if (path.startsWith("team/")) {
            const teamId = path.split("/")[1];
            const pageId = `team-${teamId}`;
            const page = document.getElementById(pageId);
            if (page) {
                this.renderTeamPage(teamId);
                page.classList.add("active");

                const team = this.data.teams.find((item) => this.toTeamId(item.team_name) === teamId);
                if (team) {
                    this.updatePageMetadata({
                        title: `${team.team_name} | ${this.siteMeta.title}`,
                        description: `${team.team_name} team page with squad, fixtures, and form updates.`,
                        image: this.siteMeta.image,
                        url: this.getCanonicalPageUrl(`team/${teamId}`)
                    });
                }
            }
        }

        this.closeTeamsDropdown();
        this.trackPageView(path);

        window.scrollTo(0, 0);
    },

    updateNavLinks() {
        document.querySelectorAll(".nav-links a").forEach((link) => {
            link.classList.remove("active");
            const href = link.getAttribute("href");

            if (this.currentPage === "home" && href === "#home") {
                link.classList.add("active");
                return;
            }

             if ((this.currentPage === "posts" || this.currentPage.startsWith("post/")) && href === "#posts") {
                link.classList.add("active");
                return;
            }

            if (this.currentPage === "hall-of-fame" && href === "#hall-of-fame") {
                link.classList.add("active");
                return;
            }

            if (this.currentPage.startsWith("team/") && href === `#${this.currentPage}`) {
                link.classList.add("active");
            }
        });

        const dropdownToggle = document.getElementById("teamsDropdownToggle");
        if (dropdownToggle) {
            dropdownToggle.classList.toggle("active", this.currentPage.startsWith("team/"));
        }
    },

    generateTeamPages() {
        const container = document.getElementById("teamPagesContainer");
        if (!container) {
            return;
        }

        container.innerHTML = "";

        this.data.teams.forEach((team) => {
            const teamId = this.toTeamId(team.team_name);
            const page = document.createElement("section");
            page.id = `team-${teamId}`;
            page.className = "page";
            page.innerHTML = `<div id="content-${teamId}"></div>`;
            container.appendChild(page);
        });
    },

    renderHome() {
        this.renderOverviewStats();
        this.renderUpcomingFixtures();
        this.renderLatestPostPreview();
    },

    renderHallOfFamePage() {
        const container = document.getElementById("hallOfFameContent");
        if (!container) {
            return;
        }

        const finishedTeams = this.data.teams.filter((team) => team.end_state && typeof team.end_state === "object");
        const byPlatform = {};

        finishedTeams.forEach((team) => {
            const platform = this.normalizePlatformName(team.osm_or_top_eleven);
            if (!byPlatform[platform]) {
                byPlatform[platform] = [];
            }
            byPlatform[platform].push(team);
        });

        const preferredPlatformOrder = ["Top Eleven", "Hattrick", "OSM"];
        const dynamicPlatforms = Object.keys(byPlatform)
            .filter((platform) => !preferredPlatformOrder.includes(platform))
            .sort();
        const platformOrder = preferredPlatformOrder
            .filter((platform) => Array.isArray(byPlatform[platform]) && byPlatform[platform].length)
            .concat(dynamicPlatforms);
        const sectionsMarkup = platformOrder
            .map((platform) => {
                const teams = byPlatform[platform]
                    .slice()
                    .sort((a, b) => this.compareFinishedTeamPlace(a, b));

                if (!teams.length) {
                    return "";
                }

                const cardsMarkup = teams.map((team) => {
                    const teamId = this.toTeamId(team.team_name);
                    const finalPlace = team.end_state?.final_place || "Finished";
                    const finalEndDate = team.end_state?.end_date || "Unknown date";
                    const placeClass = this.getHallOfFamePlaceClass(finalPlace);

                    const posColors = {
                        first: "rgba(242, 204, 96, 0.5)",
                        second: "rgba(192, 192, 192, 0.5)",
                        third: "rgba(205, 127, 50, 0.5)"
                    };
                    let positionIcon = "";

                    if (finalPlace === "1st") {
                        positionIcon = `<div class="hall-of-fame-badge" style="background-color: ${posColors.first}; color: rgb(20 28 43);"><i class="fa-solid fa-trophy" style="margin-right: 0.5rem;"></i>${this.escapeHtml(finalPlace)}</div>`;
                    } else if (finalPlace === "2nd") {
                        positionIcon = `<div class="hall-of-fame-badge" style="background-color: ${posColors.second}; color: rgb(20 28 43);"><i class="fa-solid fa-medal" style="margin-right: 0.5rem;"></i>${this.escapeHtml(finalPlace)}</div>`;
                    } else {
                        positionIcon = `<div class="hall-of-fame-badge" style="background-color: ${posColors.third}; color: rgb(20 28 43);"><i class="fa-solid fa-medal" style="margin-right: 0.5rem;"></i>${this.escapeHtml(finalPlace)}</div>`;
                    }

                    return `
                        <a href="#team/${teamId}" class="hall-of-fame-card ${placeClass}" data-analytics-action="hall_of_fame_click" data-analytics-category="Hall of Fame" data-analytics-label="${this.escapeHtml(team.team_name)}">
                            ${positionIcon}
                            <h3>${this.escapeHtml(team.team_name)}</h3>
                            <p>${this.escapeHtml(team.competition || "Unknown competition")}<br /><i>(Ended: ${this.escapeHtml(finalEndDate)})</i></p>
                            <div class="hall-of-fame-footer">
                                <span class="hall-of-fame-meta" style="font-style: italic; font-weight: 100;">${this.escapeHtml(platform)}</span>
                            </div>
                        </a>
                    `;
                }).join("");

                return `
                    <section class="panel hall-of-fame-panel">
                        <div class="hall-of-fame-grid">${cardsMarkup}</div>
                    </section>
                `;
            })
            .filter(Boolean)
            .join("");

        container.innerHTML = `
            <h1 class="section-title">Hall of Fame</h1>
            <div class="notes-section hall-of-fame-hero">
                <div class="notes-content">
                    An archive of completed leagues, seasons, and standout runs. These entries preserve the history of the journeys that have already reached their final chapter.
                </div>
            </div>
            ${sectionsMarkup || '<div class="empty-state">No finished teams or leagues have been recorded yet.</div>'}
        `;
    },

    renderPostsPage() {
        this.renderPosts("allPosts", Number.POSITIVE_INFINITY);
    },

    renderLatestPostPreview() {
        const container = document.getElementById("latestPostPreview");
        if (!container) {
            return;
        }

        const latestPost = [...this.data.posts]
            .sort((a, b) => this.comparePostDateDesc(a, b))[0];

        if (!latestPost) {
            container.innerHTML = '<div class="empty-state">No posts yet.</div>';
            return;
        }

        const safeTitle = this.escapeHtml(latestPost.title || "Untitled update");
        const safeDate = this.escapeHtml(latestPost.date_time?.[0] || "Unknown date");
        const safeTime = this.escapeHtml(latestPost.date_time?.[1] || "--:--");
        const safeContent = this.escapeHtml(this.getPostDescription(latestPost.content || ""));
        const tags = Array.isArray(latestPost.tags) ? latestPost.tags : [];
        let categoryGameType = latestPost.category || "Other";

        const gameLogoKey = {
            "top eleven": platformLogoUrls.topEleven,
            "osm": platformLogoUrls.osm,
            "hattrick": platformLogoUrls.hattrick
        };

        if (latestPost.category?.toLowerCase() === "top eleven") {
            categoryGameType = `<img src="${gameLogoKey["top eleven"]}" alt="Top Eleven logo" style="height: 1rem; vertical-align: middle; filter: invert(1);">`;
        } else if (latestPost.category?.toLowerCase() === "osm") {
            categoryGameType = `<img src="${gameLogoKey["osm"]}" alt="Online Soccer Manager logo" style="height: 1rem; vertical-align: middle;">`;
        } else if (latestPost.category?.toLowerCase() === "hattrick") {
            categoryGameType = `<img src="${gameLogoKey["hattrick"]}" alt="Hattrick logo" style="height: 1rem; vertical-align: middle;">`;
        }

        container.innerHTML = `
            <article class="latest-post-card">
                <div class="latest-post-header">
                    <span class="latest-post-label">Latest update</span>
                </div>
                <h3 class="update-title"><a href="#post/${this.getPostSlug(latestPost)}" class="post-link" data-analytics-action="post_click" data-analytics-category="Posts" data-analytics-label="Latest Post">${safeTitle}</a></h3>
                <div class="update-meta">
                    <span>${safeDate} @ ${safeTime}</span>
                    <span class="update-category">${categoryGameType}</span>
                </div>
                <p class="update-content">${safeContent}</p>
                <div class="tags">${tags.map((tag) => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join("")}</div>
            </article>
        `;
    },

    getPushUiElements() {
        return {
            enableButton: document.getElementById("enablePushBtn"),
            disableButton: document.getElementById("disablePushBtn"),
            statusText: document.getElementById("pushStatusText")
        };
    },

    getPushModalElements() {
        return {
            fabButton: document.getElementById("pushFab"),
            modal: document.getElementById("pushModal"),
            closeButton: document.getElementById("pushModalClose")
        };
    },

    openPushSettingsModal() {
        const { modal, fabButton } = this.getPushModalElements();
        if (!modal) {
            return;
        }

        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        if (fabButton) {
            fabButton.setAttribute("aria-expanded", "true");
        }
        this.syncBodyModalOpenState();
    },

    closePushSettingsModal() {
        const { modal, fabButton } = this.getPushModalElements();
        if (!modal) {
            return;
        }

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        if (fabButton) {
            fabButton.setAttribute("aria-expanded", "false");
        }
        this.syncBodyModalOpenState();
    },

    setPushStatus(message, tone = "neutral") {
        const { statusText } = this.getPushUiElements();
        if (!statusText) {
            return;
        }

        statusText.textContent = message;
        statusText.classList.remove("is-error", "is-success");
        if (tone === "error") {
            statusText.classList.add("is-error");
        }
        if (tone === "success") {
            statusText.classList.add("is-success");
        }
    },

    getNotificationPermission() {
        if (!("Notification" in window)) {
            return "unsupported";
        }

        return Notification.permission;
    },

    syncPushButtons() {
        const { enableButton, disableButton } = this.getPushUiElements();
        const { fabButton } = this.getPushModalElements();
        if (!enableButton || !disableButton) {
            return;
        }

        const state = this.uiState.push;
        const permission = this.getNotificationPermission();
        enableButton.disabled = state.isBusy || state.isSubscribed || permission === "denied";
        disableButton.disabled = state.isBusy || !state.isSubscribed;

        if (fabButton) {
            const statusText = state.isSubscribed ? "On" : "Off";
            fabButton.setAttribute("aria-label", `Notification settings (${statusText})`);
            fabButton.classList.toggle("is-enabled", state.isSubscribed);
        }

        this.syncInstallButton();
    },

    async setupPushNotifications() {
        const { enableButton, disableButton } = this.getPushUiElements();
        const { fabButton, modal, closeButton } = this.getPushModalElements();
        // If push notifications are not configured for this deployment,
        // hide the Alerts/fab button and skip setup.
        const notificationsConfigured = String(pushConfig.workerBaseUrl || "").trim() !== "" && String(pushConfig.siteId || "").trim() !== "";
        if (!notificationsConfigured) {
            if (fabButton) {
                try { fabButton.style.display = "none"; } catch (e) { /* ignore */ }
            }
            return;
        }

        if (fabButton) {
            fabButton.addEventListener("click", () => {
                this.trackEvent("push_modal_open", "Notifications", "Open Notification Controls");
                this.openPushSettingsModal();
            });
        }

        if (closeButton) {
            closeButton.addEventListener("click", () => this.closePushSettingsModal());
        }

        if (modal) {
            modal.addEventListener("click", (event) => {
                if (event.target === modal) {
                    this.closePushSettingsModal();
                }
            });
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && modal?.classList.contains("is-open")) {
                this.closePushSettingsModal();
            }
        });

        if (!enableButton || !disableButton) {
            return;
        }

        const supported = "serviceWorker" in navigator && "PushManager" in window;
        if (!supported) {
            this.setPushStatus("Push notifications are not supported in this browser.", "error");
            enableButton.disabled = true;
            disableButton.disabled = true;
            return;
        }

        enableButton.addEventListener("click", () => {
            this.trackEvent("push_enable_click", "Notifications", "Enable Notifications");
            this.subscribeToPushNotifications();
        });

        disableButton.addEventListener("click", () => {
            this.trackEvent("push_disable_click", "Notifications", "Disable Notifications");
            this.unsubscribeFromPushNotifications();
        });

        this.setPushStatus("Checking subscription status...");

        try {
            const registration = await navigator.serviceWorker.register(pushConfig.serviceWorkerPath, { scope: "./" });
            this.uiState.push.registration = registration;
            const existingSubscription = await registration.pushManager.getSubscription();
            this.uiState.push.isSubscribed = Boolean(existingSubscription);

            if (this.uiState.push.isSubscribed) {
                this.setPushStatus("Push notifications are enabled for this browser.", "success");
            } else if (this.getNotificationPermission() === "denied") {
                this.setPushStatus("Notification permission is blocked. Allow notifications for this site in your browser settings, then reload.", "error");
            } else if (this.getNotificationPermission() === "default") {
                this.setPushStatus("Push notifications are disabled. Click Enable Notifications to show the browser permission prompt.");
            } else {
                this.setPushStatus("Push notifications are currently disabled.");
            }
        } catch (error) {
            this.setPushStatus(`Unable to initialize push notifications: ${error.message}`, "error");
        }

        this.syncPushButtons();
    },

    async fetchVapidPublicKey() {
        const response = await fetch(`${pushConfig.workerBaseUrl}/vapid-public-key`);
        if (!response.ok) {
            throw new Error(`Failed to fetch VAPID public key (HTTP ${response.status}).`);
        }

        const payload = await response.json();
        const publicKey = String(payload?.publicKey || "").trim();
        if (!publicKey) {
            throw new Error("Worker returned an empty VAPID public key.");
        }

        return publicKey;
    },

    async subscribeToPushNotifications() {
        if (this.uiState.push.isBusy) {
            return;
        }

        this.uiState.push.isBusy = true;
        this.syncPushButtons();

        try {
            if (Notification.permission === "denied") {
                throw new Error("Notification permission is blocked in this browser.");
            }

            let permission = Notification.permission;
            if (permission === "default") {
                permission = await Notification.requestPermission();
            }

            if (permission !== "granted") {
                throw new Error("Notification permission was not granted.");
            }

            const registration = this.uiState.push.registration
                || await navigator.serviceWorker.register(pushConfig.serviceWorkerPath, { scope: "./" });
            this.uiState.push.registration = registration;

            const vapidPublicKey = await this.fetchVapidPublicKey();
            const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });

            const response = await fetch(`${pushConfig.workerBaseUrl}/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    siteId: pushConfig.siteId,
                    subscription
                })
            });

            if (!response.ok) {
                throw new Error(`Subscription registration failed (HTTP ${response.status}).`);
            }

            this.uiState.push.isSubscribed = true;
            this.trackEvent("push_enabled", "Notifications", "Enabled");
            this.setPushStatus("Push notifications enabled successfully.", "success");
        } catch (error) {
            this.setPushStatus(`Unable to enable push notifications: ${error.message}`, "error");
        } finally {
            this.uiState.push.isBusy = false;
            this.syncPushButtons();
        }
    },

    async unsubscribeFromPushNotifications() {
        if (this.uiState.push.isBusy) {
            return;
        }

        this.uiState.push.isBusy = true;
        this.syncPushButtons();

        try {
            const registration = this.uiState.push.registration
                || await navigator.serviceWorker.register(pushConfig.serviceWorkerPath, { scope: "./" });
            this.uiState.push.registration = registration;

            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                this.uiState.push.isSubscribed = false;
                this.setPushStatus("Push notifications are already disabled.");
                return;
            }

            const endpoint = subscription.endpoint;
            await subscription.unsubscribe();

            const response = await fetch(`${pushConfig.workerBaseUrl}/unsubscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    siteId: pushConfig.siteId,
                    endpoint
                })
            });

            if (!response.ok) {
                throw new Error(`Unsubscribe sync failed (HTTP ${response.status}).`);
            }

            this.uiState.push.isSubscribed = false;
            this.trackEvent("push_disabled", "Notifications", "Disabled");
            this.setPushStatus("Push notifications disabled successfully.", "success");
        } catch (error) {
            this.setPushStatus(`Unable to disable push notifications: ${error.message}`, "error");
        } finally {
            this.uiState.push.isBusy = false;
            this.syncPushButtons();
        }
    },

    renderOverviewStats() {
        const container = document.getElementById("overviewStats");
        if (!container) {
            return;
        }

        const totalTeams = this.data.teams.length;
        const activeTeams = this.data.teams.filter((team) => !team.end_state || typeof team.end_state !== "object").length;
        const pastTeams = this.data.teams.filter((team) => team.end_state && typeof team.end_state === "object").length;
        const totalPlayers = this.data.teams.reduce((count, team) => count + (team.players?.length || 0), 0);
        const upcomingCount = this.getUpcomingGames().length;
        const postsCount = this.data.posts.length;

        container.innerHTML = `
            <article class="stat-card">
                <div class="stat-label">Active Teams</div>
                <div class="stat-value">${activeTeams}</div>
            </article>
            <article class="stat-card">
                <div class="stat-label">Past Teams</div>
                <div class="stat-value">${pastTeams}</div>
            </article>
            <article class="stat-card">
                <div class="stat-label">Upcoming Matches</div>
                <div class="stat-value">${upcomingCount}</div>
            </article>
            <article class="stat-card">
                <div class="stat-label">Total Posts</div>
                <div class="stat-value">${postsCount}</div>
            </article>
        `;
    },

    renderUpcomingFixtures() {
        const container = document.getElementById("upcomingFixtures");
        if (!container) {
            return;
        }

        const upcoming = this.getUpcomingGames().sort((a, b) => this.compareGameDateAsc(a, b)).slice(0, 8);

        if (!upcoming.length) {
            container.innerHTML = '<div class="empty-state">No upcoming fixtures at the moment.</div>';
            return;
        }

        container.innerHTML = "";
        upcoming.forEach((game) => {
            container.appendChild(this.createFixtureCard(game));
        });
    },

    renderPosts(containerId, limit = Number.POSITIVE_INFINITY) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        const updates = [...this.data.posts]
            .sort((a, b) => this.comparePostDateDesc(a, b))
            .slice(0, limit);

        if (!updates.length) {
            container.innerHTML = '<div class="empty-state">No update posts yet.</div>';
            return;
        }

        container.innerHTML = "";

        updates.forEach((post) => {
            const card = document.createElement("article");
            card.className = "update-card";

            const safeTitle = this.escapeHtml(post.title || "Untitled update");
            const safeDate = this.escapeHtml(post.date_time?.[0] || "Unknown date");
            const safeTime = this.escapeHtml(post.date_time?.[1] || "--:--");
            const safeCategory = this.escapeHtml(post.category || "Other");
            const safeContent = this.escapeHtml(this.getPostDescription(post.content || ""));
            const tags = Array.isArray(post.tags) ? post.tags : [];

            let categoryGameType = "";

            if (safeCategory.toLowerCase() === "top eleven" || safeCategory.toLowerCase() === "osm" || safeCategory.toLowerCase() === "hattrick") {
                let gameTypeDataTwo = {
                    title: "Unknown",
                    logo: ""
                };

                if (safeCategory.toLowerCase() === "top eleven") {
                    gameTypeDataTwo.title = "Top Eleven";
                    gameTypeDataTwo.logo = platformLogoUrls.topEleven;
                    categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 1rem; vertical-align: middle; filter: invert(1);">`;
                } else if (safeCategory.toLowerCase() === "osm") {
                    gameTypeDataTwo.title = "Online Soccer Manager";
                    gameTypeDataTwo.logo = platformLogoUrls.osm;
                    categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 1rem; vertical-align: middle;">`;
                } else if (safeCategory.toLowerCase() === "hattrick") {
                    gameTypeDataTwo.title = "Hattrick";
                    gameTypeDataTwo.logo = platformLogoUrls.hattrick;
                    categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 1rem; vertical-align: middle;">`;
                }
            } else {
                categoryGameType = safeCategory;
            }

            card.innerHTML = `
                <h3 class="update-title"><a href="#post/${this.getPostSlug(post)}" class="post-link" data-analytics-action="post_click" data-analytics-category="Posts" data-analytics-label="${this.escapeHtml(post.title || "Untitled update")}">${safeTitle}</a></h3>
                <div class="update-meta">
                    <span>${safeDate} @ ${safeTime}</span>
                    <span class="update-category">${categoryGameType}</span>
                </div>
                <p class="update-content">${safeContent}</p>
                <div class="tags">${tags.map((tag) => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join("")}</div>
            `;

            container.appendChild(card);
        });
    },

    renderPostDetailPage(postSlug) {
        const container = document.getElementById("postDetailContent");
        if (!container) {
            return;
        }

        const post = this.findPostBySlug(postSlug);
        if (!post) {
            container.innerHTML = `
                <h1 class="section-title">Post Not Found</h1>
                <div class="empty-state">The requested post could not be found. <a href="#posts" class="site-link">Return to posts</a>.</div> 
            `;
            this.updatePageMetadata({
                title: `Post Not Found | ${this.siteMeta.title}`,
                description: this.siteMeta.description,
                image: this.siteMeta.image,
                url: this.getCanonicalPageUrl(`post/${postSlug}`)
            });
            return;
        }

        const safeTitle = this.escapeHtml(post.title || "Untitled update");
        const safeDate = this.escapeHtml(post.date_time?.[0] || "Unknown date");
        const safeTime = this.escapeHtml(post.date_time?.[1] || "--:--");
        const safeCategory = this.escapeHtml(post.category || "Other");
        const safeContent = this.renderPostContent(post.content || "");
        const tags = Array.isArray(post.tags) ? post.tags : [];
        const postImage = this.getPostImageUrl(post);
        const postUrl = this.getCanonicalPageUrl(`post/${postSlug}`);
        const postShareUrl = this.getPostSharePageUrl(postSlug);
        const shareUrls = this.getPostShareUrls(post, postShareUrl);

        let categoryGameType = "";

        if (safeCategory.toLowerCase() === "top eleven" || safeCategory.toLowerCase() === "osm" || safeCategory.toLowerCase() === "hattrick") {
            let gameTypeDataTwo = {
                title: "Unknown",
                logo: ""
            };

            if (safeCategory.toLowerCase() === "top eleven") {
                gameTypeDataTwo.title = "Top Eleven";
                gameTypeDataTwo.logo = platformLogoUrls.topEleven;
                categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 2rem; vertical-align: middle; filter: invert(1);">`;
            } else if (safeCategory.toLowerCase() === "osm") {
                gameTypeDataTwo.title = "Online Soccer Manager";
                gameTypeDataTwo.logo = platformLogoUrls.osm;
                categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 2rem; vertical-align: middle;">`;
            } else if (safeCategory.toLowerCase() === "hattrick") {
                gameTypeDataTwo.title = "Hattrick";
                gameTypeDataTwo.logo = platformLogoUrls.hattrick;
                categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 2rem; vertical-align: middle;">`;
            }
        } else {
            categoryGameType = safeCategory;
        }

        container.innerHTML = `
            <a href="#posts" class="site-link" data-analytics-action="post_back_click" data-analytics-category="Posts" data-analytics-label="Back to Posts">&larr; Back to Posts</a>
            <h1 class="section-title" style="margin-top: 0.6rem;">${safeTitle}</h1>

            <article class="update-card post-detail-card">
                <div class="update-meta">
                    <span>${safeDate} @ ${safeTime}</span>
                    <span class="update-category">${categoryGameType}</span>
                </div>
                <div class="update-content">${safeContent}</div>
                <div class="tags">${tags.map((tag) => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join("")}</div>
                <div class="post-share-buttons">
                    <a href="${shareUrls.x}" class="share-btn share-x" target="_blank" rel="noopener noreferrer" aria-label="Share this post on X" data-analytics-action="share_click" data-analytics-category="Posts" data-analytics-label="Share on X">
                        <i class="fa-brands fa-x-twitter"></i> Share on X
                    </a>
                    <a href="${shareUrls.facebook}" class="share-btn share-facebook" target="_blank" rel="noopener noreferrer" aria-label="Share this post on Facebook" data-analytics-action="share_click" data-analytics-category="Posts" data-analytics-label="Share on Facebook">
                        <i class="fa-brands fa-facebook-f"></i> Share on Facebook
                    </a>
                    <button type="button" class="share-btn share-copy" id="copy-post-link-btn" aria-label="Copy share link" data-analytics-action="copy_link_click" data-analytics-category="Posts" data-analytics-label="Copy Post Link">
                        <i class="fa-solid fa-link"></i> Copy Link
                    </button>
                </div>
            </article>
        `;

        const copyLinkButton = document.getElementById("copy-post-link-btn");
        if (copyLinkButton) {
            copyLinkButton.addEventListener("click", async () => {
                this.trackEvent("copy_link_click", "Posts", "Copy Post Link");
                const copied = await this.copyTextToClipboard(postShareUrl);
                copyLinkButton.textContent = copied ? "Copied" : "Copy Failed";
                setTimeout(() => {
                    copyLinkButton.innerHTML = '<i class="fa-solid fa-link"></i> Copy Link';
                }, 1500);
            });
        }

        this.updatePageMetadata({
            title: `${safeTitle} | ${this.siteMeta.title}`,
            description: this.getPostDescription(post.content),
            image: postImage,
            url: postUrl
        });
    },

    findPostBySlug(postSlug) {
        return this.data.posts.find((post) => this.getPostSlug(post) === postSlug) || null;
    },

    getPostSlug(post) {
        const title = String(post?.title || "post");
        const date = String(post?.date_time?.[0] || "");
        const time = String(post?.date_time?.[1] || "");
        const seed = `${title}-${date}-${time}`;

        return seed
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "post";
    },

    getPostDescription(content) {
        const normalizedContent = String(content || "")
            .replace(/\[link=[^\]\n\r]+\]([\s\S]*?)\[\/link\]/gi, "$1")
            .replace(/\[featured-image=[^\]\n\r]+\]([\s\S]*?)\[\/featured-image\]/gi, "$1");
        const text = normalizedContent.replace(/\s+/g, " ").trim();
        if (!text) {
            return this.siteMeta.description;
        }

        return text.length > 180 ? `${text.slice(0, 177)}...` : text;
    },

    sanitizePostLinkUrl(rawUrl) {
        const candidate = String(rawUrl || "").trim();
        if (!candidate) {
            return "";
        }

        try {
            const resolved = new URL(candidate, this.getCanonicalPageUrl("home"));
            if (!/^https?:$/i.test(resolved.protocol)) {
                return "";
            }
            return resolved.toString();
        } catch (_error) {
            return "";
        }
    },

    sanitizePostMediaUrl(rawUrl) {
        return this.sanitizePostLinkUrl(rawUrl);
    },

    renderPostContent(content) {
        const rawContent = String(content || "");
        const tagPattern = /\[link=([^\]\n\r]+)\]([\s\S]*?)\[\/link\]|\[featured-image=([^\]\n\r]+)\]([\s\S]*?)\[\/featured-image\]/gi;

        let output = "";
        let lastIndex = 0;
        let match = null;

        while ((match = tagPattern.exec(rawContent)) !== null) {
            const fullMatch = match[0] || "";
            const linkUrlRaw = match[1] || "";
            const linkLabelRaw = match[2] || "";
            const featuredImageUrlRaw = match[3] || "";
            const featuredImageCaptionRaw = match[4] || "";

            output += this.escapeHtml(rawContent.slice(lastIndex, match.index)).replace(/\n/g, "<br>");

            if (linkUrlRaw) {
                const safeUrl = this.sanitizePostLinkUrl(linkUrlRaw);
                if (safeUrl) {
                    const safeLabel = this.escapeHtml(String(linkLabelRaw || "").trim() || safeUrl);
                    output += `<a href="${this.escapeHtml(safeUrl)}" class="site-link" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
                } else {
                    output += this.escapeHtml(fullMatch);
                }
            } else {
                const safeImageUrl = this.sanitizePostMediaUrl(featuredImageUrlRaw);
                if (safeImageUrl) {
                    const captionText = String(featuredImageCaptionRaw || "").trim();
                    const safeAlt = this.escapeHtml(captionText || "Featured image");
                    output += `<figure class="post-featured-image-block"><img src="${this.escapeHtml(safeImageUrl)}" alt="${safeAlt}" class="post-detail-image post-featured-image">${captionText ? `<figcaption>${this.escapeHtml(captionText)}</figcaption>` : ""}</figure>`;
                } else {
                    output += this.escapeHtml(fullMatch);
                }
            }

            lastIndex = match.index + fullMatch.length;
        }

        output += this.escapeHtml(rawContent.slice(lastIndex)).replace(/\n/g, "<br>");
        return output;
    },

    getPostImageUrl(post) {
        const postImage = String(post?.image || "").trim();
        if (!postImage) {
            return this.siteMeta.image;
        }

        if (/^https?:\/\//i.test(postImage)) {
            return postImage;
        }

        const normalizedPath = postImage.replace(/^\/+/, "");
        if (normalizedPath.startsWith("fm/")) {
            return buildRootUrl(normalizedPath, true);
        }
        return buildFmUrl(normalizedPath, true);
    },

    getPostImageMarkup(post, className = "post-list-image") {
        const postImage = String(post?.image || "").trim();
        if (!postImage) {
            return "";
        }

        const imageUrl = this.getPostImageUrl(post);
        const imageAlt = this.escapeHtml(post?.title || "Post image");
        return `<img src="${imageUrl}" alt="${imageAlt}" class="${className}">`;
    },

    getPostShareUrls(post, postUrl) {
        const shareUrl = encodeURIComponent(postUrl);
        const title = String(post?.title || "Football Management Update");
        const baseText = `${title} | ${this.siteMeta.title}`;
        const tags = Array.isArray(post?.tags) ? post.tags : [];
        const hashtags = tags
            .map((tag) => String(tag || "").trim().replace(/\s+/g, ""))
            .filter((tag) => tag.length > 0)
            .map((tag) => `#${tag}`);

        const hashtagsLine = hashtags.length ? hashtags.join(" ") : "";
        const gameHandle = this.getGameTwitterHandleByCategory(post?.category);

        const facebookText = hashtagsLine
            ? `${baseText}\n\n${hashtagsLine}\n\n`
            : baseText; 

        const xText = hashtagsLine ? `${baseText}\n\n${hashtagsLine} ${gameHandle}\n\n` : baseText;

        return {
            x: `https://x.com/intent/tweet?url=${shareUrl}&text=${encodeURIComponent(xText)}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${encodeURIComponent(facebookText)}`
        };
    },

    getGameTwitterHandleByCategory(category) {
        const key = String(category || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");

        return gameTwitterHandles[key] || "";
    },

    getPostSharePageUrl(postSlug) {
        const safeSlug = encodeURIComponent(String(postSlug || "").trim());
        const configuredBase = String(shareConfig.workerBaseUrl || "").trim().replace(/\/+$/, "");

        if (configuredBase) {
            return `${configuredBase}/post/${safeSlug}`;
        }

        // Fallback keeps existing behavior until share worker base URL is configured.
        return this.getCanonicalPageUrl(`post/${String(postSlug || "").trim()}`);
    },

    getCanonicalPageUrl(path = "") {
        const canonicalBase = buildFmUrl("", true);
        if (!path || path === "home") {
            return canonicalBase;
        }

        if (path === "posts") {
            return `${canonicalBase}?view=posts`;
        }

        if (path.startsWith("post/")) {
            const postSlug = path.split("/")[1];
            return `${canonicalBase}?view=post&slug=${encodeURIComponent(postSlug)}`;
        }

        if (path.startsWith("team/")) {
            const teamId = path.split("/")[1];
            return `${canonicalBase}?view=team&slug=${encodeURIComponent(teamId)}`;
        }

        return canonicalBase;
    },

    async copyTextToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }

            const fallback = document.createElement("textarea");
            fallback.value = text;
            fallback.style.position = "fixed";
            fallback.style.opacity = "0";
            document.body.appendChild(fallback);
            fallback.focus();
            fallback.select();
            const successful = document.execCommand("copy");
            document.body.removeChild(fallback);
            return successful;
        } catch (error) {
            console.error("Copy link failed", error);
            return false;
        }
    },

    captureDefaultSiteMetadata() {
        const titleMeta = document.querySelector('meta[property="og:title"]');
        const descriptionMeta = document.querySelector('meta[property="og:description"]');
        const imageMeta = document.querySelector('meta[property="og:image"]');

        this.siteMeta.title = titleMeta?.getAttribute("content") || document.title || this.siteMeta.title;
        this.siteMeta.description = descriptionMeta?.getAttribute("content") || this.siteMeta.description;
        this.siteMeta.image = imageMeta?.getAttribute("content") || this.siteMeta.image;
    },

    updatePageMetadata({ title, description, image, url }) {
        const resolvedTitle = title || this.siteMeta.title;
        const resolvedDescription = description || this.siteMeta.description;
        const resolvedImage = image || this.siteMeta.image;
        const resolvedUrl = url || window.location.href;

        document.title = title || this.siteMeta.title;
        this.setMetaTag('meta[property="og:title"]', "property", "og:title", resolvedTitle);
        this.setMetaTag('meta[property="og:description"]', "property", "og:description", resolvedDescription);
        this.setMetaTag('meta[property="og:image"]', "property", "og:image", resolvedImage);
        this.setMetaTag('meta[property="og:url"]', "property", "og:url", resolvedUrl);
        this.setMetaTag('meta[name="description"]', "name", "description", resolvedDescription);

        this.setMetaTag('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
        this.setMetaTag('meta[name="twitter:title"]', "name", "twitter:title", resolvedTitle);
        this.setMetaTag('meta[name="twitter:description"]', "name", "twitter:description", resolvedDescription);
        this.setMetaTag('meta[name="twitter:image"]', "name", "twitter:image", resolvedImage);
        this.setMetaTag('meta[name="twitter:url"]', "name", "twitter:url", resolvedUrl);
    },

    setMetaTag(selector, keyName, keyValue, content) {
        let tag = document.querySelector(selector);
        if (!tag) {
            tag = document.createElement("meta");
            tag.setAttribute(keyName, keyValue);
            document.head.appendChild(tag);
        }
        tag.setAttribute("content", content || "");
    },

    renderTeamPage(teamId) {
        const team = this.data.teams.find((item) => this.toTeamId(item.team_name) === teamId);
        const content = document.getElementById(`content-${teamId}`);

        if (!team || !content) {
            return;
        }

        const teamGames = this.getTeamGames(team.team_name);
        const upcoming = teamGames.filter((game) => !this.isPlayed(game)).sort((a, b) => this.compareGameDateAsc(a, b));
        const played = teamGames.filter((game) => this.isPlayed(game)).sort((a, b) => this.compareGameDateDesc(a, b));
        const pastFixturesState = this.getPastFixturesState(teamId);
        const recentFormResults = played.slice(0, 5).map((game) => this.getResultLetter(game, team.team_name));
        const recentFormMarkup = this.getRecentFormMarkup(recentFormResults);

        const yellowCards = (team.players || []).reduce((count, player) => count + Number(player[2] || 0), 0);
        const redCards = (team.players || []).reduce((count, player) => count + Number(player[3] || 0), 0);
        const isCompletedTeam = Boolean(team.end_state && typeof team.end_state === "object");
        const eloPlatform = this.normalizePlatformName(team.osm_or_top_eleven);
        const platformRatings = this.data.eloRatings?.[eloPlatform] || {};
        const eloValue = Math.round(Number(platformRatings[team.team_name]) || 1500);

        const gameTypeData = this.getPlatformDetails(team.osm_or_top_eleven);

        let gameLogoTag = this.escapeHtml(gameTypeData.fullName || "Unknown");
        if (gameTypeData.logo) {
            const topElevenFilterStyle = gameTypeData.invertLogo ? " filter: invert(1);" : "";
            gameLogoTag = `<img src="${gameTypeData.logo}" alt="${gameTypeData.fullName} logo" style="height: 1.75rem; vertical-align: middle;${topElevenFilterStyle}">`;
        }

        content.innerHTML = `
            <h1 class="section-title">${this.escapeHtml(team.team_name)}</h1>

            <section class="team-stats">
                <article class="stat-card">
                    <div class="stat-label">Game</div>
                    <div class="stat-value">
                        <a href="${gameTypeData.link}" target="_blank">
                            ${gameLogoTag}
                        </a>
                    </div>
                </article>
                <article class="stat-card">
                    <div class="stat-label">League</div>
                    <div class="stat-value">${this.escapeHtml(team.competition || "Unknown")}</div>
                </article>
                <article class="stat-card">
                    <div class="stat-label">Squad Size</div>
                    <div class="stat-value">${team.players?.length || 0}</div>
                </article>
                <article class="stat-card">
                    <div class="stat-label">Recent Form</div>
                    ${recentFormMarkup}
                </article>
                <article class="stat-card elo-card">
                    <div class="stat-label">
                        ELO Rating
                        <button class="elo-info-btn" type="button" data-analytics-action="elo_info_click" data-analytics-category="Teams" data-analytics-label="${this.escapeHtml(team.team_name)}" aria-label="Explain how ELO is calculated for ${this.escapeHtml(team.team_name)}">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                    <div class="stat-value">${eloValue}</div>
                </article>
                <article class="stat-card">
                    <div class="stat-label">Cards</div>
                    <div class="stat-value"><span style="color: var(--warning-color);">${yellowCards}</span> <span style="color: var(--text-secondary); font-weight: normal;">/</span> <span style="color: var(--danger-color);">${redCards}</span></div>
                </article>
            </section>

            <section class="panel">
                <h2 class="panel-title">Club Profile</h2>
                <p>
                    <strong>Country:</strong> ${this.escapeHtml(team.country || "Unknown")}<br>
                    <strong>Home Venue:</strong> ${this.escapeHtml(team.home_venue || "Unknown")}
                </p>
            </section>

            ${isCompletedTeam ? "" : `
            <section class="panel">
                <h2 class="panel-title">Upcoming Fixtures</h2>
                <div class="fixtures-grid" id="team-upcoming-${teamId}"></div>
            </section>
            `}

            <section class="panel past-panel ${pastFixturesState.collapsed ? "is-collapsed" : ""}" id="past-panel-${teamId}">
                <div class="panel-heading">
                    <h2 class="panel-title">Past Fixtures</h2>
                    <button class="panel-toggle-btn" id="team-played-toggle-${teamId}" type="button" aria-expanded="${String(!pastFixturesState.collapsed)}">
                        ${pastFixturesState.collapsed ? "Expand" : "Collapse"}
                    </button>
                </div>
                <div class="panel-content" id="team-played-panel-content-${teamId}">
                    <div class="fixtures-grid" id="team-played-${teamId}"></div>
                    <div class="panel-controls" id="team-played-controls-${teamId}"></div>
                </div>
            </section>

            <section class="panel">
                <h2 class="panel-title">Squad</h2>
                <div class="roster-grid" id="team-roster-${teamId}"></div>
            </section>
        `;

        const upcomingContainer = document.getElementById(`team-upcoming-${teamId}`);
        const playedToggleButton = document.getElementById(`team-played-toggle-${teamId}`);
        const rosterContainer = document.getElementById(`team-roster-${teamId}`);
        const eloInfoButton = content.querySelector(".elo-info-btn");

        if (upcomingContainer) {
            if (!upcoming.length) {
                upcomingContainer.innerHTML = '<div class="empty-state">No upcoming fixtures listed.</div>';
            } else {
                upcoming.slice(0, 10).forEach((game) => upcomingContainer.appendChild(this.createFixtureCard(game)));
            }
        }

        if (playedToggleButton) {
            playedToggleButton.addEventListener("click", () => {
                this.trackEvent("fixtures_toggle_click", "Teams", `Toggle ${team.team_name}`);
                const state = this.getPastFixturesState(teamId);
                state.collapsed = !state.collapsed;
                this.updatePastFixturesPanelState(teamId);
            });
        }

        this.renderPastFixturesList(teamId, played);
        this.updatePastFixturesPanelState(teamId);

        if (eloInfoButton) {
            eloInfoButton.addEventListener("click", (event) => {
                event.preventDefault();
                this.openEloInfoModal(team, eloPlatform);
            });
        }

        if (rosterContainer) {
            this.renderRoster(team.players || [], rosterContainer);
        }
    },

    getPastFixturesState(teamId) {
        if (!this.uiState.pastFixtures[teamId]) {
            this.uiState.pastFixtures[teamId] = {
                visibleCount: 6,
                collapsed: true
            };
        }

        return this.uiState.pastFixtures[teamId];
    },

    updatePastFixturesPanelState(teamId) {
        const state = this.getPastFixturesState(teamId);
        const panel = document.getElementById(`past-panel-${teamId}`);
        const toggleButton = document.getElementById(`team-played-toggle-${teamId}`);

        if (panel) {
            panel.classList.toggle("is-collapsed", state.collapsed);
        }

        if (toggleButton) {
            toggleButton.textContent = state.collapsed ? "Expand" : "Collapse";
            toggleButton.setAttribute("aria-expanded", String(!state.collapsed));
        }
    },

    renderPastFixturesList(teamId, playedGames) {
        const container = document.getElementById(`team-played-${teamId}`);
        const controls = document.getElementById(`team-played-controls-${teamId}`);

        if (!container || !controls) {
            return;
        }

        const state = this.getPastFixturesState(teamId);
        const visibleGames = playedGames.slice(0, state.visibleCount);

        container.innerHTML = "";
        controls.innerHTML = "";

        if (!playedGames.length) {
            container.innerHTML = '<div class="empty-state">No played fixtures listed yet.</div>';
            return;
        }

        visibleGames.forEach((game) => container.appendChild(this.createFixtureCard(game)));

        if (state.visibleCount < playedGames.length) {
            const loadMoreButton = document.createElement("button");
            loadMoreButton.type = "button";
            loadMoreButton.className = "load-more-btn";
            loadMoreButton.textContent = "Load More";
            loadMoreButton.addEventListener("click", () => {
                this.trackEvent("load_more_click", "Teams", `Load More ${teamId}`);
                state.visibleCount += 6;
                this.renderPastFixturesList(teamId, playedGames);
            });
            controls.appendChild(loadMoreButton);
        }
    },

    createFixtureCard(game) {
        const card = document.createElement("article");
        card.className = "fixture-card";

        const played = this.isPlayed(game);
        const homeTeam = this.escapeHtml(game.home_team || "Unknown");
        const awayTeam = this.escapeHtml(game.away_team || "Unknown");
        const competition = this.escapeHtml(game.competition || "Unknown Competition");
        const gameType = this.escapeHtml(game.osm_or_top_eleven || "Unknown");
        const gameDate = this.escapeHtml(game.date || "Unknown date");
        const gameTime = this.escapeHtml(game.time || "--:--");
        const venue = this.escapeHtml(game.venue || "Unknown");
        const homeOrAway = this.escapeHtml(game.home_or_away || "Unknown");

        const score = played
            ? `${this.escapeHtml(game.home_score)} - ${this.escapeHtml(game.away_score)}`
            : "vs";

        card.innerHTML = `
            <div class="fixture-header">
                <div class="fixture-badge">${played ? "Result" : "Upcoming"}</div>
                <div class="fixture-league">${competition}</div>
            </div>
            <div class="fixture-body">
                <div class="fixture-date">${gameDate} at ${gameTime} (<i>${homeOrAway}</>)</div>
                <div class="fixture-match">
                    <div class="team-name">${homeTeam}</div>
                    <div class="score ${played ? "" : "pending"}">${score}</div>
                    <div class="team-name right">${awayTeam}</div>
                </div>
                <div class="fixture-meta">
                    <span>${gameType}</span>
                    <span>${venue}</span>
                </div>
            </div>
        `;

        return card;
    },

    renderRoster(players, container) {
        const groups = {
            Goalkeepers: [],
            Defenders: [],
            Midfielders: [],
            Forwards: [],
            Other: []
        };

        players.forEach((player) => {
            const position = String(player[0] || "").toUpperCase();
            const bucket = this.getPositionGroup(position);
            groups[bucket].push(player);
        });

        container.innerHTML = "";

        Object.entries(groups).forEach(([title, list]) => {
            if (!list.length) {
                return;
            }

            const card = document.createElement("article");
            card.className = "roster-card";

            const rows = list
                .map((player) => {
                    const position = this.escapeHtml(player[0] || "-");
                    const name = this.escapeHtml(player[1] || "Unknown Player");
                    const yellow = this.escapeHtml(player[2] || "0");
                    const red = this.escapeHtml(player[3] || "0");
                    const injury = this.escapeHtml(player[4] || "0");

                    return `
                        <tr>
                            <td>${position}</td>
                            <td>${name}</td>
                            <td style="text-align: center;"><span class="cards-pill yellow">${yellow}</span></td>
                            <td style="text-align: center;"><span class="cards-pill red">${red}</span></td>
                            <td style="text-align: center;"><span class="cards-pill injury">${injury}</span></td>
                        </tr>
                    `;
                })
                .join("");

            card.innerHTML = `
                <h3 class="roster-heading">${title}</h3>
                <table class="roster-table">
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th>Player</th>
                            <th style="text-align: center;">Y</th>
                            <th style="text-align: center;">R</th>
                            <th style="text-align: center;">Inj</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;

            container.appendChild(card);
        });
    },

    getPositionGroup(position) {
        const goalkeepers = ["GK"];
        const defenders = ["LB", "RB", "CB", "LCB", "RCB", "DL", "DR", "DC", "WB", "CD"];
        const midfielders = ["CM", "CDM", "CAM", "LM", "RM", "MC", "DMC", "AMC", "AML", "AMR", "W", "IM"];
        const forwards = ["ST", "CF", "LW", "RW", "SS", "FW"];

        if (goalkeepers.includes(position)) {
            return "Goalkeepers";
        }

        if (defenders.includes(position)) {
            return "Defenders";
        }

        if (midfielders.includes(position)) {
            return "Midfielders";
        }

        if (forwards.includes(position)) {
            return "Forwards";
        }

        return "Other";
    },

    getUpcomingGames() {
        return this.data.games.filter((game) => !this.isPlayed(game));
    },

    getTeamGames(teamName) {
        return this.data.games.filter((game) => game.home_team === teamName || game.away_team === teamName);
    },

    isPlayed(game) {
        return game.home_score !== "" && game.away_score !== "";
    },

    getResultLetter(game, teamName) {
        if (!this.isPlayed(game)) {
            return "-";
        }

        const homeScore = Number(game.home_score);
        const awayScore = Number(game.away_score);

        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
            return "-";
        }

        if (homeScore === awayScore) {
            return "D";
        }

        const didHomeWin = homeScore > awayScore;
        const isHomeTeam = game.home_team === teamName;
        return (didHomeWin && isHomeTeam) || (!didHomeWin && !isHomeTeam) ? "W" : "L";
    },

    getRecentFormMarkup(results) {
        if (!results.length) {
            return '<div class="stat-value">TBD</div>';
        }

        const dots = results
            .map((result) => {
                let formClass = "draw";
                if (result === "W") {
                    formClass = "win";
                } else if (result === "L") {
                    formClass = "loss";
                }

                return `<span class="form-dot ${formClass}" aria-label="${result}" title="${result}"></span>`;
            })
            .join("");

        return `<div class="recent-form" aria-label="Recent results">${dots}</div>`;
    },

    compareGameDateAsc(a, b) {
        return this.parseGameDate(a).getTime() - this.parseGameDate(b).getTime();
    },

    compareFinishedTeamPlace(a, b) {
        const extractPlaceValue = (team) => {
            const place = String(team?.end_state?.final_place || "").trim();
            const match = place.match(/(\d+)/);
            return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
        };

        const aValue = extractPlaceValue(a);
        const bValue = extractPlaceValue(b);

        if (aValue === bValue) {
            return (a.team_name || "").localeCompare(b.team_name || "");
        }

        return aValue - bValue;
    },

    getHallOfFamePlaceClass(finalPlace) {
        const normalized = String(finalPlace || "").trim().toLowerCase();
        if (normalized.includes("1")) {
            return "legendary";
        }
        if (normalized.includes("2")) {
            return "silver";
        }
        if (normalized.includes("3")) {
            return "bronze";
        }
        return "classic";
    },

    compareGameDateDesc(a, b) {
        return this.parseGameDate(b).getTime() - this.parseGameDate(a).getTime();
    },

    comparePostDateDesc(a, b) {
        const aDate = this.parseDateTime(a.date_time?.[0], a.date_time?.[1]);
        const bDate = this.parseDateTime(b.date_time?.[0], b.date_time?.[1]);
        return bDate.getTime() - aDate.getTime();
    },

    parseGameDate(game) {
        return this.parseDateTime(game.date, game.time);
    },

    parseDateTime(date, time) {
        if (!date || typeof date !== "string") {
            return new Date(0);
        }

        const [day, month, year] = date.split("-").map((value) => Number(value));
        const [hour, minute] = String(time || "00:00").split(":").map((value) => Number(value));

        if ([day, month, year, hour, minute].some((value) => Number.isNaN(value))) {
            return new Date(0);
        }

        return new Date(year, month - 1, day, hour, minute, 0, 0);
    },

    toTeamId(name) {
        return String(name || "team")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    },

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },

    renderError(error) {
        const appContainer = document.getElementById("app");
        if (appContainer) {
            appContainer.innerHTML = `
                <section class="page active">
                    <h1 class="section-title">Unable to Load Football Hub</h1>
                    <div class="empty-state">
                        ${this.escapeHtml(error?.message || "An unknown error occurred while loading data.")}
                    </div>
                </section>
            `;
        }

        console.error(error);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});
