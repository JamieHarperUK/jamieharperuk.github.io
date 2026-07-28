// Data sources for the Football Manager Site
const dataDomain = "https://jamieharperuk.github.io/";
const dataSources = {
    games: dataDomain + "fm/data/games.json",
    teams: dataDomain + "fm/data/teams.json",
    posts: dataDomain + "fm/data/posts.json"
};

const pushConfig = {
    workerBaseUrl: "https://fm-push-worker.oakshiftsoftware.workers.dev",
    siteId: "fm",
    serviceWorkerPath: "sw.js"
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
    osm: "@OSMLikeABoss"
};

const app = {
    currentPage: "home",
    siteMeta: {
        title: "JHUK Football Management",
        description: "Track my OSM and Top Eleven teams, fixtures, and updates in one place.",
        image: "https://jamieharperuk.github.io/fm/data/fm_bg.png"
    },
    data: {
        games: [],
        teams: [],
        posts: []
    },
    uiState: {
        pastFixtures: {},
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
            this.renderHome();
            await this.setupPushNotifications();
            this.handleRoute();
        } catch (error) {
            this.renderError(error);
        }
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
        navLinks.appendChild(homeLink);

        const dropdown = document.createElement("div");
        dropdown.className = "nav-dropdown";

        const dropdownToggle = document.createElement("button");
        dropdownToggle.className = "nav-dropdown-toggle";
        dropdownToggle.type = "button";
        dropdownToggle.id = "teamsDropdownToggle";
        dropdownToggle.setAttribute("aria-expanded", "false");
        dropdownToggle.textContent = "Teams";

        const dropdownMenu = document.createElement("div");
        dropdownMenu.className = "nav-dropdown-menu";
        dropdownMenu.id = "teamsDropdownMenu";

        this.data.teams.forEach((team) => {
            const teamId = this.toTeamId(team.team_name);
            const link = document.createElement("a");
            link.href = `#team/${teamId}`;
            link.textContent = team.team_name;
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

        const postsLink = document.createElement("a");
        postsLink.href = "#posts";
        postsLink.textContent = "Posts";
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
    },

    handleRoute() {
        const hash = window.location.hash.replace(/^#/, "") || "home";

        if (hash === "home") {
            this.navigate("home");
            return;
        }

        if (hash === "posts") {
            this.navigate("posts");
            return;
        }

        if (hash.startsWith("post/")) {
            const postSlug = hash.split("/")[1];
            this.navigate(`post/${postSlug}`);
            return;
        }

        if (hash.startsWith("team/")) {
            const teamId = hash.split("/")[1];
            this.navigate(`team/${teamId}`);
            return;
        }

        window.location.hash = "#home";
    },

    navigate(path) {
        this.currentPage = path;

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

        container.innerHTML = `
            <article class="latest-post-card">
                <div class="latest-post-header">
                    <span class="latest-post-label">Latest update</span>
                    <a href="#post/${this.getPostSlug(latestPost)}" class="site-link">Read full post</a>
                </div>
                <h3 class="update-title"><a href="#post/${this.getPostSlug(latestPost)}" class="post-link">${safeTitle}</a></h3>
                <div class="update-meta">
                    <span>${safeDate} @ ${safeTime}</span>
                    <span class="update-category">${this.escapeHtml(latestPost.category || "Other")}</span>
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
        if (!enableButton || !disableButton) {
            return;
        }

        const state = this.uiState.push;
        const permission = this.getNotificationPermission();
        enableButton.disabled = state.isBusy || state.isSubscribed || permission === "denied";
        disableButton.disabled = state.isBusy || !state.isSubscribed;
    },

    async setupPushNotifications() {
        const { enableButton, disableButton } = this.getPushUiElements();
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
            this.subscribeToPushNotifications();
        });

        disableButton.addEventListener("click", () => {
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
        const totalPlayers = this.data.teams.reduce((count, team) => count + (team.players?.length || 0), 0);
        const upcomingCount = this.getUpcomingGames().length;
        const postsCount = this.data.posts.length;

        container.innerHTML = `
            <article class="stat-card">
                <div class="stat-label">Teams</div>
                <div class="stat-value">${totalTeams}</div>
            </article>
            <article class="stat-card">
                <div class="stat-label">Upcoming</div>
                <div class="stat-value">${upcomingCount}</div>
            </article>
            <article class="stat-card">
                <div class="stat-label">Posts</div>
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

            if (safeCategory.toLowerCase() === "top eleven" || safeCategory.toLowerCase() === "osm") {
                let gameTypeDataTwo = {
                    title: "Unknown",
                    logo: ""
                };

                if (safeCategory.toLowerCase() === "top eleven") {
                    gameTypeDataTwo.title = "Top Eleven";
                    gameTypeDataTwo.logo = "https://jamieharperuk.github.io/fm/data/top-eleven-logo.png";
                    categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 1rem; vertical-align: middle; filter: invert(1);">`;
                } else if (safeCategory.toLowerCase() === "osm") {
                    gameTypeDataTwo.title = "Online Soccer Manager";
                    gameTypeDataTwo.logo = "https://jamieharperuk.github.io/fm/data/osm-logo.png";
                    categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 1rem; vertical-align: middle;">`;
                }
            } else {
                categoryGameType = safeCategory;
            }

            card.innerHTML = `
                <h3 class="update-title"><a href="#post/${this.getPostSlug(post)}" class="post-link">${safeTitle}</a></h3>
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
        const safeContent = this.escapeHtml(post.content || "").replace(/\n/g, "<br>");
        const tags = Array.isArray(post.tags) ? post.tags : [];
        const postImage = this.getPostImageUrl(post);
        const postUrl = this.getCanonicalPageUrl(`post/${postSlug}`);
        const shareUrls = this.getPostShareUrls(post, postUrl);

        let categoryGameType = "";

        if (safeCategory.toLowerCase() === "top eleven" || safeCategory.toLowerCase() === "osm") {
            let gameTypeDataTwo = {
                title: "Unknown",
                logo: ""
            };

            if (safeCategory.toLowerCase() === "top eleven") {
                gameTypeDataTwo.title = "Top Eleven";
                gameTypeDataTwo.logo = "https://jamieharperuk.github.io/fm/data/top-eleven-logo.png";
                categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 2rem; vertical-align: middle; filter: invert(1);">`;
            } else if (safeCategory.toLowerCase() === "osm") {
                gameTypeDataTwo.title = "Online Soccer Manager";
                gameTypeDataTwo.logo = "https://jamieharperuk.github.io/fm/data/osm-logo.png";
                categoryGameType = `<img src="${gameTypeDataTwo.logo}" alt="${gameTypeDataTwo.title} logo" style="height: 2rem; vertical-align: middle;">`;
            }
        } else {
            categoryGameType = safeCategory;
        }

        container.innerHTML = `
            <a href="#posts" class="site-link">&larr; Back to Posts</a>
            <h1 class="section-title" style="margin-top: 0.6rem;">${safeTitle}</h1>

            <article class="update-card post-detail-card">
                <div class="update-meta">
                    <span>${safeDate} @ ${safeTime}</span>
                    <span class="update-category">${categoryGameType}</span>
                </div>
                <p class="update-content">${safeContent}</p>
                <div class="tags">${tags.map((tag) => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join("")}</div>
                <div class="post-share-buttons">
                    <a href="${shareUrls.x}" class="share-btn share-x" target="_blank" rel="noopener noreferrer" aria-label="Share this post on X">
                        <i class="fa-brands fa-x-twitter"></i> Share on X
                    </a>
                    <a href="${shareUrls.facebook}" class="share-btn share-facebook" target="_blank" rel="noopener noreferrer" aria-label="Share this post on Facebook">
                        <i class="fa-brands fa-facebook-f"></i> Share on Facebook
                    </a>
                    <button type="button" class="share-btn share-copy" id="copy-post-link-btn" aria-label="Copy share link">
                        <i class="fa-solid fa-link"></i> Copy Link
                    </button>
                </div>
            </article>
        `;

        const copyLinkButton = document.getElementById("copy-post-link-btn");
        if (copyLinkButton) {
            copyLinkButton.addEventListener("click", async () => {
                const copied = await this.copyTextToClipboard(postUrl);
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
        const text = String(content || "").replace(/\s+/g, " ").trim();
        if (!text) {
            return this.siteMeta.description;
        }

        return text.length > 180 ? `${text.slice(0, 177)}...` : text;
    },

    getPostImageUrl(post) {
        const postImage = String(post?.image || "").trim();
        if (!postImage) {
            return this.siteMeta.image;
        }

        if (/^https?:\/\//i.test(postImage)) {
            return postImage;
        }

        return new URL(postImage.replace(/^\/+/, ""), dataDomain).toString();
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

    getCanonicalPageUrl(hashPath = "") {
        const canonicalBase = new URL("fm/", dataDomain).toString();
        if (!hashPath) {
            return canonicalBase;
        }
        return `${canonicalBase}#${hashPath}`;
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

        const gameSelector = team.osm_or_top_eleven === "OSM" ? "Online Soccer Manager" : team.osm_or_top_eleven === "Top Eleven" ? "Top Eleven" : "Unknown";
        let gameTypeData = {
            title: "Unknown",
            logo: "",
            link: "#"
        };

        if (gameSelector == "Top Eleven") {
            gameTypeData.title = "Top Eleven";
            gameTypeData.logo = "https://jamieharperuk.github.io/fm/data/top-eleven-logo.png";
            gameTypeData.link = "https://www.topeleven.com/";
        } else if (gameSelector == "Online Soccer Manager") {
            gameTypeData.title = "Online Soccer Manager";
            gameTypeData.logo = "https://jamieharperuk.github.io/fm/data/osm-logo.png";
            gameTypeData.link = "https://www.onlinesoccermanager.com/";
        }

        let gameLogoTag = `<img src="${gameTypeData.logo}" alt="${gameTypeData.title} logo" style="height: 1.75rem; vertical-align: middle;">`;
        if (gameTypeData.title === "Top Eleven") {
            gameLogoTag = `<img src="${gameTypeData.logo}" alt="${gameTypeData.title} logo" style="height: 1.75rem; vertical-align: middle; filter: invert(1);">`;
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
                    <div class="stat-label">Competition</div>
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
                <h2 class="panel-title">Club Profile</h2>
                <p>
                    <strong>Country:</strong> ${this.escapeHtml(team.country || "Unknown")}<br>
                    <strong>Home Venue:</strong> ${this.escapeHtml(team.home_venue || "Unknown")}
                </p>
            </section>

            <section class="panel">
                <h2 class="panel-title">Upcoming Fixtures</h2>
                <div class="fixtures-grid" id="team-upcoming-${teamId}"></div>
            </section>

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

        if (upcomingContainer) {
            if (!upcoming.length) {
                upcomingContainer.innerHTML = '<div class="empty-state">No upcoming fixtures listed.</div>';
            } else {
                upcoming.slice(0, 10).forEach((game) => upcomingContainer.appendChild(this.createFixtureCard(game)));
            }
        }

        if (playedToggleButton) {
            playedToggleButton.addEventListener("click", () => {
                const state = this.getPastFixturesState(teamId);
                state.collapsed = !state.collapsed;
                this.updatePastFixturesPanelState(teamId);
            });
        }

        this.renderPastFixturesList(teamId, played);
        this.updatePastFixturesPanelState(teamId);

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

                    return `
                        <tr>
                            <td>${position}</td>
                            <td>${name}</td>
                            <td style="text-align: center;"><span class="cards-pill yellow">${yellow}</span></td>
                            <td style="text-align: center;"><span class="cards-pill red">${red}</span></td>
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
        const defenders = ["LB", "RB", "CB", "LCB", "RCB", "DL", "DR", "DC"];
        const midfielders = ["CM", "CDM", "CAM", "LM", "RM", "MC", "DMC", "AMC", "AML", "AMR"];
        const forwards = ["ST", "CF", "LW", "RW", "SS"];

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
