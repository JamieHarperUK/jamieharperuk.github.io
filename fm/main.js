// Data sources for the Football Manager Site
const dataDomain = "https://jamieharperuk.github.io/";
const dataSources = {
    games: dataDomain + "fm/data/games.json",
    teams: dataDomain + "fm/data/teams.json",
    posts: dataDomain + "fm/data/posts.json"
};

const app = {
    currentPage: "home",
    data: {
        games: [],
        teams: [],
        posts: []
    },

    async init() {
        try {
            await this.loadData();
            this.setupNavigation();
            this.generateTeamPages();
            this.setupHashRouting();
            this.renderHome();
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

        const postsLink = document.createElement("a");
        postsLink.href = "#posts";
        postsLink.textContent = "Posts";
        navLinks.appendChild(postsLink);

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
        } else if (path === "posts") {
            this.renderPostsPage();
            document.getElementById("posts")?.classList.add("active");
        } else if (path.startsWith("team/")) {
            const teamId = path.split("/")[1];
            const pageId = `team-${teamId}`;
            const page = document.getElementById(pageId);
            if (page) {
                this.renderTeamPage(teamId);
                page.classList.add("active");
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

             if (this.currentPage === "posts" && href === "#posts") {
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
    },

    renderPostsPage() {
        this.renderPosts("allPosts", Number.POSITIVE_INFINITY);
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
            const safeContent = this.escapeHtml(post.content || "");
            const tags = Array.isArray(post.tags) ? post.tags : [];

            card.innerHTML = `
                <h3 class="update-title">${safeTitle}</h3>
                <div class="update-meta">
                    <span>${safeDate} at ${safeTime}</span>
                    <span class="update-category">${safeCategory}</span>
                </div>
                <p class="update-content">${safeContent}</p>
                <div class="tags">${tags.map((tag) => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join("")}</div>
            `;

            container.appendChild(card);
        });
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
        const recentForm = played.slice(0, 5).map((game) => this.getResultLetter(game, team.team_name)).join("") || "N/A";

        const yellowCards = (team.players || []).reduce((count, player) => count + Number(player[2] || 0), 0);
        const redCards = (team.players || []).reduce((count, player) => count + Number(player[3] || 0), 0);

        content.innerHTML = `
            <h1 class="section-title">${this.escapeHtml(team.team_name)}</h1>

            <section class="team-stats">
                <article class="stat-card">
                    <div class="stat-label">Game</div>
                    <div class="stat-value">${this.escapeHtml(team.osm_or_top_eleven || "Unknown")}</div>
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
                    <div class="stat-value">${recentForm}</div>
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

            <section class="panel">
                <h2 class="panel-title">Past Fixtures</h2>
                <div class="fixtures-grid" id="team-played-${teamId}"></div>
            </section>

            <section class="panel">
                <h2 class="panel-title">Squad</h2>
                <div class="roster-grid" id="team-roster-${teamId}"></div>
            </section>
        `;

        const upcomingContainer = document.getElementById(`team-upcoming-${teamId}`);
        const playedContainer = document.getElementById(`team-played-${teamId}`);
        const rosterContainer = document.getElementById(`team-roster-${teamId}`);

        if (upcomingContainer) {
            if (!upcoming.length) {
                upcomingContainer.innerHTML = '<div class="empty-state">No upcoming fixtures listed.</div>';
            } else {
                upcoming.slice(0, 10).forEach((game) => upcomingContainer.appendChild(this.createFixtureCard(game)));
            }
        }

        if (playedContainer) {
            if (!played.length) {
                playedContainer.innerHTML = '<div class="empty-state">No played fixtures listed yet.</div>';
            } else {
                played.slice(0, 10).forEach((game) => playedContainer.appendChild(this.createFixtureCard(game)));
            }
        }

        if (rosterContainer) {
            this.renderRoster(team.players || [], rosterContainer);
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

        const score = played
            ? `${this.escapeHtml(game.home_score)} - ${this.escapeHtml(game.away_score)}`
            : "vs";

        card.innerHTML = `
            <div class="fixture-header">
                <div class="fixture-badge">${played ? "Result" : "Upcoming"}</div>
                <div class="fixture-league">${competition}</div>
            </div>
            <div class="fixture-body">
                <div class="fixture-date">${gameDate} at ${gameTime}</div>
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
                            <td><span class="cards-pill yellow">${yellow}</span></td>
                            <td><span class="cards-pill red">${red}</span></td>
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
                            <th>Y</th>
                            <th>R</th>
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
