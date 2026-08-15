// Core site URL configuration.
const siteConfig = {
    canonicalOrigin: "https://example.com",
    appBasePath: "/fc-template/",
    ticketsPageEnabled: true
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
    games: buildFmUrl("data/fc_games.json"),
    teams: buildFmUrl("data/fc_teams.json"),
    posts: buildFmUrl("data/posts.json"),
    tickets: buildFmUrl("data/fc_tickets.json"),
    tables: buildFmUrl("data/fc_tables.json")
};

const pushConfig = {
    enabled: true,
    workerBaseUrl: "https://fm-push-worker.oakshiftsoftware.workers.dev",
    siteId: "fc-template",
    serviceWorkerPath: "sw.js"
};

const shareConfig = {
    workerBaseUrl: "https://share.jhuk.co.uk"
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
const app = {
    currentPage: "home",
    analyticsId: "",
    siteMeta: {
        title: "Football Club Site",
        description: "Track your club's fixtures, squad updates, and match news in one place.",
        image: buildFmUrl("data/fm_bg.png", true)
    },
    data: {
        games: [],
        teams: [],
        posts: [],
        tickets: [],
        tables: []
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
            this.setupNavigation();
            this.generateTeamPages();
            this.setupHashRouting();
            this.setupInternalLinkNavigation();
            this.setupAnalytics();
            this.setupInstallPrompt();
            this.setupModals();
            this.renderHome();
            if (pushConfig.enabled) {
                await this.setupPushNotifications();
            } else {
                this.disablePushNotifications();
            }
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

    setupModals() {
        // Setup player detail modal
        const playerDetailCloseBtn = document.getElementById("playerDetailModalClose");
        const playerDetailModal = document.getElementById("playerDetailModal");

        if (playerDetailCloseBtn) {
            playerDetailCloseBtn.addEventListener("click", () => {
                this.closePlayerDetailModal();
            });
        }

        if (playerDetailModal) {
            playerDetailModal.addEventListener("click", (event) => {
                if (event.target === playerDetailModal) {
                    this.closePlayerDetailModal();
                }
            });
        }

        // Close modals on Escape key
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                const playerModal = document.getElementById("playerDetailModal");
                if (playerModal?.classList.contains("is-open")) {
                    this.closePlayerDetailModal();
                }
            }
        });
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

        if (view === "tickets") {
            return "tickets";
        }

        if (view === "fixtures") {
            return "fixtures";
        }

        if (view === "tables") {
            return "tables";
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
            return "/fc-template/";
        }

        if (path === "posts") {
            return "/fc-template/?view=posts";
        }

        if (path === "tickets") {
            return "/fc-template/?view=tickets";
        }

        if (path === "tables") {
            return "/fc-template/?view=tables";
        }

        if (path === "hall-of-fame") {
            return "/fc-template/?view=hall-of-fame";
        }

        if (path.startsWith("post/")) {
            return `/fc-template/?view=post&slug=${encodeURIComponent(path.split("/")[1])}`;
        }

        if (path.startsWith("team/")) {
            return `/fc-template/?view=team&slug=${encodeURIComponent(path.split("/")[1])}`;
        }

        return "/fc-template/";
    },

    getAnalyticsPageTitle(path) {
        if (!path || path === "home") {
            return "Home";
        }

        if (path === "posts") {
            return "Posts";
        }

        if (path === "tickets") {
            return "Tickets";
        }

        if (path === "fixtures") {
            return "Fixtures";
        }

        if (path === "tables") {
            return "Tables";
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
        const [gamesResponse, teamsResponse, postsResponse, ticketsResponse, tablesResponse] = await Promise.all([
            fetch(dataSources.games),
            fetch(dataSources.teams),
            fetch(dataSources.posts),
            fetch(dataSources.tickets),
            fetch(dataSources.tables)
        ]);

        if (!gamesResponse.ok || !teamsResponse.ok || !postsResponse.ok || !ticketsResponse.ok || !tablesResponse.ok) {
            throw new Error("Unable to load one or more JSON data sources.");
        }

        const [gamesJson, teamsJson, postsJson, ticketsJson, tablesJson] = await Promise.all([
            gamesResponse.json(),
            teamsResponse.json(),
            postsResponse.json(),
            ticketsResponse.json(),
            tablesResponse.json()
        ]);

        this.data.games = Array.isArray(gamesJson.games) ? gamesJson.games : [];
        this.data.teams = Array.isArray(teamsJson.teams) ? teamsJson.teams : [];
        this.data.posts = Array.isArray(postsJson.posts) ? postsJson.posts : [];
        this.data.tickets = Array.isArray(ticketsJson.tickets) ? ticketsJson.tickets : [];
        this.data.tables = Array.isArray(tablesJson.tables) ? tablesJson.tables : [];

        if (!this.data.games.length && gamesJson && Array.isArray(gamesJson)) {
            this.data.games = gamesJson;
        }
        if (!this.data.teams.length && teamsJson && Array.isArray(teamsJson)) {
            this.data.teams = teamsJson;
        }
        if (!this.data.posts.length && postsJson && Array.isArray(postsJson)) {
            this.data.posts = postsJson;
        }
        if (!this.data.tickets.length && ticketsJson && Array.isArray(ticketsJson)) {
            this.data.tickets = ticketsJson;
        }
        if (!this.data.tables.length && tablesJson && Array.isArray(tablesJson)) {
            this.data.tables = tablesJson;
        }
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
        // Group less-frequent items into a 'More' dropdown for mobile
        const moreDropdown = document.createElement("div");
        moreDropdown.className = "nav-dropdown";

        const moreToggle = document.createElement("button");
        moreToggle.className = "nav-dropdown-toggle";
        moreToggle.type = "button";
        moreToggle.id = "moreDropdownToggle";
        moreToggle.setAttribute("aria-expanded", "false");
        moreToggle.setAttribute("data-analytics-action", "nav_click");
        moreToggle.setAttribute("data-analytics-category", "Navigation");
        moreToggle.setAttribute("data-analytics-label", "More Menu");
        moreToggle.textContent = "More";

        const moreMenu = document.createElement("div");
        moreMenu.className = "nav-dropdown-menu";

        const ticketsLink = document.createElement("a");
        ticketsLink.href = "#tickets";
        ticketsLink.textContent = "Tickets";
        ticketsLink.setAttribute("data-analytics-action", "nav_click");
        ticketsLink.setAttribute("data-analytics-category", "Navigation");
        ticketsLink.setAttribute("data-analytics-label", "Tickets");
        ticketsLink.addEventListener("click", () => {
            this.closeMoreDropdown();
        });
        moreMenu.appendChild(ticketsLink);

        const tablesLink = document.createElement("a");
        tablesLink.href = "#tables";
        tablesLink.textContent = "Tables";
        tablesLink.setAttribute("data-analytics-action", "nav_click");
        tablesLink.setAttribute("data-analytics-category", "Navigation");
        tablesLink.setAttribute("data-analytics-label", "Tables");
        tablesLink.addEventListener("click", () => {
            this.closeMoreDropdown();
        });
        moreMenu.appendChild(tablesLink);

        const fixturesLink = document.createElement("a");
        fixturesLink.href = "#fixtures";
        fixturesLink.textContent = "Fixtures";
        fixturesLink.setAttribute("data-analytics-action", "nav_click");
        fixturesLink.setAttribute("data-analytics-category", "Navigation");
        fixturesLink.setAttribute("data-analytics-label", "Fixtures");
        fixturesLink.addEventListener("click", () => {
            this.closeMoreDropdown();
        });
        moreMenu.appendChild(fixturesLink);

        moreDropdown.appendChild(moreToggle);
        moreDropdown.appendChild(moreMenu);
        navLinks.appendChild(moreDropdown);

        // Attach event listeners after the elements exist to avoid TDZ errors
        moreToggle.addEventListener("click", () => {
            const moreContainer = moreDropdown;
            const isOpen = moreContainer.classList.toggle("open");
            moreToggle.setAttribute("aria-expanded", String(isOpen));
        });

        document.addEventListener("click", (event) => {
            if (!dropdown.contains(event.target)) {
                this.closeTeamsDropdown();
            }
            if (!moreDropdown.contains(event.target)) {
                this.closeMoreDropdown();
            }
        });

        this.updateNavLinks();
    },

    closeTeamsDropdown() {
        const toggle = document.getElementById("teamsDropdownToggle");
        const dropdown = toggle ? toggle.closest(".nav-dropdown") : null;
        if (dropdown && dropdown.classList.contains("open")) {
            dropdown.classList.remove("open");
        }
        if (toggle) {
            toggle.setAttribute("aria-expanded", "false");
        }
    },

    closeMoreDropdown() {
        const toggle = document.getElementById("moreDropdownToggle");
        const dropdown = toggle ? toggle.closest(".nav-dropdown") : null;
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

        if (route === "tickets") {
            this.navigate("tickets");
            return;
        }

        if (route === "tables") {
            this.navigate("tables");
            return;
        }

        if (route === "fixtures") {
            this.navigate("fixtures");
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
                description: "Latest club updates, news, and match reports.",
                image: this.siteMeta.image,
                url: this.getCanonicalPageUrl("posts")
            });
        } else if (path === "tickets") {
            this.renderTicketsPage();
            document.getElementById("tickets")?.classList.add("active");
            this.updatePageMetadata({
                title: `Tickets | ${this.siteMeta.title}`,
                description: "Ticket availability and club matchday ticket details.",
                image: this.siteMeta.image,
                url: this.getCanonicalPageUrl("tickets")
            });
        } else if (path === "fixtures") {
            this.renderFixturesPage();
            document.getElementById("fixtures")?.classList.add("active");
            this.updatePageMetadata({
                title: `Fixtures | ${this.siteMeta.title}`,
                description: "All upcoming and recent fixtures.",
                image: this.siteMeta.image,
                url: this.getCanonicalPageUrl("fixtures")
            });
        } else if (path === "tables") {
            this.renderTablesPage();
            document.getElementById("tables")?.classList.add("active");
            this.updatePageMetadata({
                title: `Tables | ${this.siteMeta.title}`,
                description: "League tables and club standings across the season.",
                image: this.siteMeta.image,
                url: this.getCanonicalPageUrl("tables")
            });
        } else if (path === "hall-of-fame") {
            this.renderHallOfFamePage();
            document.getElementById("hall-of-fame")?.classList.add("active");
            this.updatePageMetadata({
                title: `Club History | ${this.siteMeta.title}`,
                description: "Past seasons, club honours, and player achievements.",
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
        this.closeMoreDropdown();
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

            if (this.currentPage === "tickets" && href === "#tickets") {
                link.classList.add("active");
                return;
            }

            if (this.currentPage === "tables" && href === "#tables") {
                link.classList.add("active");
                return;
            }

            if (this.currentPage === "fixtures" && href === "#fixtures") {
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
        const moreToggle = document.getElementById("moreDropdownToggle");
        if (moreToggle) {
            const moreActive = ["tickets", "tables", "fixtures"].includes(this.currentPage);
            moreToggle.classList.toggle("active", moreActive);
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

        const teams = finishedTeams
            .slice()
            .sort((a, b) => this.compareFinishedTeamPlace(a, b));

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
                </a>
            `;
        }).join("");

        const sectionsMarkup = cardsMarkup ? `
            <section class="panel hall-of-fame-panel">
                <div class="hall-of-fame-grid">${cardsMarkup}</div>
            </section>
        ` : "";

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

    renderTicketsPage() {
        const container = document.getElementById("ticketsContent");
        if (!container) {
            return;
        }

        const tickets = [...this.data.tickets];
        if (!tickets.length) {
            container.innerHTML = '<div class="empty-state">No ticket listings are available right now.</div>';
            return;
        }

        container.innerHTML = tickets.map((ticket) => {
            const title = this.escapeHtml(ticket.title || ticket.match || "Match ticket");
            const date = this.escapeHtml(ticket.date || ticket.match_date || "TBA");
            const venue = this.escapeHtml(ticket.venue || ticket.location || "Unknown venue");
            const status = this.escapeHtml(ticket.status || ticket.availability || "Available");
            const notes = this.escapeHtml(ticket.notes || ticket.description || "");
            const link = String(ticket.link || ticket.url || "").trim();
            const actionButton = link ? `<a href="${this.escapeHtml(link)}" class="site-button" target="_blank" rel="noopener">Buy / View</a>` : "";

            return `
                <article class="ticket-card">
                    <div class="ticket-header">
                        <h3>${title}</h3>
                        <span class="ticket-status">${status}</span>
                    </div>
                    <div class="ticket-meta">
                        <span>${date}</span>
                        <span>${venue}</span>
                    </div>
                    <p class="ticket-description">${notes}</p>
                    <div class="ticket-actions">${actionButton}</div>
                </article>
            `;
        }).join("");
    },

    renderTablesPage() {
        const container = document.getElementById("tablesContent");
        if (!container) {
            return;
        }

        const tables = [...this.data.tables];
        if (!tables.length) {
            container.innerHTML = '<div class="empty-state">No standing tables have been added yet.</div>';
            return;
        }

        container.innerHTML = tables.map((table) => {
            const title = this.escapeHtml(table.title || table.name || "League Table");
            const subtitle = this.escapeHtml(table.season || table.competition || "");
            const rows = Array.isArray(table.rows) ? table.rows : [];
            const headers = rows.length && typeof rows[0] === "object" && !Array.isArray(rows[0])
                ? Object.keys(rows[0])
                : [];

            const rowsMarkup = rows.length
                ? rows.map((row) => {
                    if (typeof row === "object" && !Array.isArray(row)) {
                        return `<tr>${headers.map((key) => `<td>${this.escapeHtml(String(row[key] ?? ""))}</td>`).join("")}</tr>`;
                    }

                    if (Array.isArray(row)) {
                        return `<tr>${row.map((cell) => `<td>${this.escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`;
                    }

                    return `<tr><td>${this.escapeHtml(String(row ?? ""))}</td></tr>`;
                }).join("")
                : "<tr><td colspan=100 class=\"empty-state\">No rows available for this table.</td></tr>";

            const tableHeader = headers.length
                ? `<thead><tr>${headers.map((key) => `<th>${this.escapeHtml(key)}</th>`).join("")}</tr></thead>`
                : "";

            const tableBody = `<tbody>${rowsMarkup}</tbody>`;

            return `
                <section class="panel table-panel">
                    <div class="panel-heading">
                        <h2 class="panel-title">${title}</h2>
                        ${subtitle ? `<span class="panel-subtitle">${subtitle}</span>` : ""}
                    </div>
                    <div class="table-wrapper">
                        <table class="standings-table">
                            ${tableHeader}
                            ${tableBody}
                        </table>
                    </div>
                </section>
            `;
        }).join("");
    },

    renderFixturesPage() {
        const container = document.getElementById("fixturesList");
        if (!container) {
            return;
        }

        const upcoming = this.getUpcomingGames().sort((a, b) => this.compareGameDateAsc(a, b));
        const played = [...this.data.games].filter((g) => this.isPlayed(g)).sort((a, b) => this.compareGameDateDesc(a, b));

        container.innerHTML = "";

        if (!upcoming.length && !played.length) {
            container.innerHTML = '<div class="empty-state">No fixtures available.</div>';
            return;
        }

        if (upcoming.length) {
            const upSection = document.createElement("section");
            upSection.className = "panel";
            upSection.innerHTML = `<h2 class="panel-title">Upcoming Fixtures</h2>`;
            const grid = document.createElement("div");
            grid.className = "fixtures-grid";
            upcoming.forEach((game) => grid.appendChild(this.createFixtureCard(game)));
            upSection.appendChild(grid);
            container.appendChild(upSection);
        }

        if (played.length) {
            const recentSection = document.createElement("section");
            recentSection.className = "panel";
            recentSection.innerHTML = `<h2 class="panel-title">Recent Results</h2>`;
            const grid = document.createElement("div");
            grid.className = "fixtures-grid";
            played.slice(0, 24).forEach((game) => grid.appendChild(this.createFixtureCard(game)));
            recentSection.appendChild(grid);
            container.appendChild(recentSection);
        }
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

        categoryGameType = this.escapeHtml(latestPost.category || "News");

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

        const showPushButton = state.isSubscribed;

        if (fabButton) {
            fabButton.style.display = showPushButton ? "" : "none";
            fabButton.setAttribute("aria-hidden", String(!showPushButton));

            if (showPushButton) {
                const statusText = "On";
                fabButton.setAttribute("aria-label", `Notification settings (${statusText})`);
                fabButton.classList.add("is-enabled");
            } else {
                fabButton.removeAttribute("aria-label");
                fabButton.classList.remove("is-enabled");
            }
        }

        this.syncInstallButton();
    },

    disablePushNotifications() {
        const { fabButton } = this.getPushModalElements();
        const { enableButton, disableButton, statusText } = this.getPushUiElements();

        if (fabButton) {
            fabButton.style.display = "none";
            fabButton.setAttribute("aria-hidden", "true");
        }

        if (enableButton) {
            enableButton.disabled = true;
        }

        if (disableButton) {
            disableButton.disabled = true;
        }

        if (statusText) {
            statusText.textContent = "Push notifications are disabled for this site.";
        }
    },

    async setupPushNotifications() {
        const { enableButton, disableButton } = this.getPushUiElements();
        const { fabButton, modal, closeButton } = this.getPushModalElements();

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

        if (!pushConfig.enabled) {
            this.disablePushNotifications();
            return;
        }

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
        const totalPlayers = this.data.teams.reduce((count, team) => count + (team.players?.length || 0), 0);
        const upcomingCount = this.getUpcomingGames().length;
        const postsCount = this.data.posts.length;

        container.innerHTML = `
            <article class="stat-card">
                <div class="stat-label">Active Teams</div>
                <div class="stat-value">${activeTeams}</div>
            </article>
            <article class="stat-card">
                <div class="stat-label">Total Players</div>
                <div class="stat-value">${totalPlayers}</div>
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

            categoryGameType = safeCategory;

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

        categoryGameType = safeCategory;

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
        const title = String(post?.title || "Club Update");
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

        if (path === "tickets") {
            return `${canonicalBase}?view=tickets`;
        }

        if (path === "fixtures") {
            return `${canonicalBase}?view=fixtures`;
        }

        if (path === "tables") {
            return `${canonicalBase}?view=tables`;
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
        const teamType = this.escapeHtml(team.team_type || team.category || "First Team");
        const teamImageUrl = String(team.team_image || "").trim();
        const teamImageTag = teamImageUrl
            ? `<img src="${this.escapeHtml(teamImageUrl)}" alt="${this.escapeHtml(team.team_name)} image" class="team-page-image">`
            : "";

        content.innerHTML = `
            <h1 class="section-title">${this.escapeHtml(team.team_name)}</h1>
            ${teamImageTag ? `<div class="team-image-wrapper">${teamImageTag}</div>` : ""}

            <section class="team-stats">
                <article class="stat-card">
                    <div class="stat-label">Team Type</div>
                    <div class="stat-value">${teamType}</div>
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
                <article class="stat-card">
                    <div class="stat-label">Cards</div>
                    <div class="stat-value"><span style="color: var(--warning-color);">${yellowCards}</span> <span style="color: var(--text-secondary); font-weight: normal;">/</span> <span style="color: var(--danger-color);">${redCards}</span></div>
                </article>
            </section>

            <section class="panel">
            <section class="panel">
                <h2 class="panel-title">Squad & Players</h2>
                <p class="notes-content">Player images and squad numbers are shown below. Fixtures have moved to the dedicated Fixtures page.</p>
            </section>

            <section class="panel">
                <h2 class="panel-title">Squad</h2>
                <div class="roster-grid" id="team-roster-${teamId}"></div>
            </section>
        `;

        const rosterContainer = document.getElementById(`team-roster-${teamId}`);

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
        const gameType = this.escapeHtml(game.competition || "Competition");
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
            const normalized = this.normalizePlayerData(player);
            const position = String(normalized.position || "").toUpperCase();
            const bucket = this.getPositionGroup(position);
            groups[bucket].push({ normalized, raw: player });
        });

        container.innerHTML = "";

        Object.entries(groups).forEach(([title, list]) => {
            if (!list.length) {
                return;
            }

            const section = document.createElement("section");
            section.className = "panel roster-panel";
            const heading = document.createElement("h3");
            heading.className = "roster-heading";
            heading.textContent = title;

            const grid = document.createElement("div");
            grid.className = "player-grid";

            list.forEach(({ normalized, raw }) => {
                const card = document.createElement("article");
                const roleClass = title.toLowerCase().replace(/s$/, "");
                card.className = `player-card ${roleClass}`;

                const imgWrap = document.createElement("div");
                imgWrap.className = "player-thumb-wrap";
                if (normalized.imageUrl) {
                    const img = document.createElement("img");
                    img.className = "player-thumb";
                    img.src = `${siteConfig.appBasePath}data/${normalized.imageUrl}`;
                    img.alt = normalized.name;
                    imgWrap.appendChild(img);
                } else {
                    const ph = document.createElement("div");
                    ph.className = "player-thumb placeholder";
                    ph.textContent = normalized.number || "";
                    imgWrap.appendChild(ph);
                }

                const info = document.createElement("div");
                info.className = "player-info-card";
                info.innerHTML = `<div class="player-pos">${this.escapeHtml(normalized.position)}</div><div class="player-number">${normalized.number ? `#${normalized.number}` : ""}</div>`;

                card.appendChild(imgWrap);
                card.appendChild(info);

                // Add click handler to open player detail modal
                card.addEventListener("click", () => {
                    this.openPlayerDetailModal(raw);
                });

                grid.appendChild(card);
            });

            section.appendChild(heading);
            section.appendChild(grid);
            container.appendChild(section);
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

    getPositionGroupClass(position) {
        const group = this.getPositionGroup(position);
        return group.toLowerCase().replace(/s$/, "");
    },

    normalizePlayerData(player) {
        // Handle both array and object formats for backwards compatibility
        if (Array.isArray(player)) {
            return {
                position: player[0] || "",
                name: player[1] || "Unknown Player",
                yellow: Number(player[2] || 0),
                red: Number(player[3] || 0),
                injury: Number(player[4] || 0),
                number: player[5] || "",
                imageUrl: player[6] || "",
                goals: 0,
                assists: 0,
                appearances: 0,
                notes: ""
            };
        }
        // Object format (new)
        return {
            position: player.position || "",
            name: player.name || "Unknown Player",
            yellow: Number(player.yellow || 0),
            red: Number(player.red || 0),
            injury: Number(player.injury || 0),
            number: player.number || "",
            imageUrl: player.imageUrl || "",
            goals: Number(player.goals || 0),
            assists: Number(player.assists || 0),
            appearances: Number(player.appearances || 0),
            notes: player.notes || ""
        };
    },

    getPlayerDetailModalElements() {
        return {
            modal: document.getElementById("playerDetailModal"),
            closeButton: document.getElementById("playerDetailModalClose"),
            title: document.getElementById("playerDetailTitle"),
            image: document.getElementById("playerDetailImage"),
            position: document.getElementById("playerDetailPosition"),
            number: document.getElementById("playerDetailNumber"),
            appearances: document.getElementById("playerDetailAppearances"),
            goals: document.getElementById("playerDetailGoals"),
            assists: document.getElementById("playerDetailAssists"),
            yellow: document.getElementById("playerDetailYellow"),
            red: document.getElementById("playerDetailRed"),
            injury: document.getElementById("playerDetailInjury"),
            notesContainer: document.getElementById("playerDetailNotesContainer"),
            notes: document.getElementById("playerDetailNotes")
        };
    },

    openPlayerDetailModal(playerData) {
        const elements = this.getPlayerDetailModalElements();
        if (!elements.modal) {
            return;
        }

        const normalized = this.normalizePlayerData(playerData);

        // Get position group class and apply to modal-dialog (player-modal)
        const positionGroupClass = this.getPositionGroupClass(normalized.position);
        const playerModalDialog = elements.modal.querySelector(".player-modal");
        
        if (playerModalDialog) {
            playerModalDialog.classList.remove("goalkeeper", "defender", "midfielder", "forward", "other");
            playerModalDialog.classList.add(positionGroupClass);
        }

        // Populate modal content
        elements.title.textContent = normalized.name;
        elements.position.textContent = normalized.position.toUpperCase();
        elements.number.textContent = `#${normalized.number || "-"}`;
        elements.appearances.textContent = normalized.appearances;
        elements.goals.textContent = normalized.goals;
        elements.assists.textContent = normalized.assists;
        elements.yellow.textContent = normalized.yellow;
        elements.red.textContent = normalized.red;
        elements.injury.textContent = `${normalized.injury} days`;

        if (normalized.imageUrl) {
            elements.image.src = `${siteConfig.appBasePath}data/${normalized.imageUrl}`;
            elements.image.alt = normalized.name;
        } else {
            elements.image.src = "";
            elements.image.alt = "";
        }

        // Handle notes
        if (normalized.notes && normalized.notes.trim()) {
            elements.notes.textContent = normalized.notes;
            elements.notesContainer.style.display = "block";
        } else {
            elements.notesContainer.style.display = "none";
        }

        // Show modal
        elements.modal.classList.add("is-open");
        elements.modal.setAttribute("aria-hidden", "false");
        this.syncBodyModalOpenState();
    },

    closePlayerDetailModal() {
        const { modal } = this.getPlayerDetailModalElements();
        if (!modal) {
            return;
        }

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        this.syncBodyModalOpenState();
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
