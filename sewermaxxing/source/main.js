const site_config = {
    site_title: "SewerMaxxing Guide Book",
    site_description: "A comprehensive guide to maximizing your success while SewerMaxxing in the Varrock Sewers of RuneScape.",
    site_author: "Jamie Harper",
    site_url: "https://jhuk.co.uk/sewermaxxing/",
    site_language: "en"
};

const data_source = site_config.site_url + "source/data/";
const rs_data = {
    OSRS: {
        title: "Old School RuneScape",
        url: "https://oldschool.runescape.com/",
        guide_data: data_source + "osrs.json",
        drops_data: data_source + "osrs_drops.json"
    },
    RS3: {
        title: "RuneScape 3",
        url: "https://www.runescape.com/",
        guide_data: data_source + "rs3.json",
        drops_data: data_source + "rs3_drops.json"
    }
};
const rs_account_types = ["Normal", "Ironman", "Hardcore Ironman", "Ultimate Ironman", "Group Ironman"];
const rs_account_tiers = ["Free To Play", "Member"];
const featured_sewermaxxers = data_source + "accounts.json";

const site_pages = [
    ["home", "Home"],
    ["rs3", "RuneScape"],
    ["osrs", "Old School RuneScape"],
    ["accounts", "Accounts"],
    ["disclaimer", "Disclaimer"]
];

let appData = {};
const progressStoragePrefix = "sewermaxxing-progress-";

async function responseToJson(response) {
    if (!response.ok) throw new Error(`${response.status} loading ${response.url}`);
    return response.json();
}

function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}

function getGuideProgress(version) {
    try {
        return JSON.parse(localStorage.getItem(progressStoragePrefix + version.toLowerCase()) || "{}");
    } catch (error) {
        console.warn(`Unable to read ${version} progress.`, error);
        return {};
    }
}

function saveGuideProgress(version, progress) {
    localStorage.setItem(progressStoragePrefix + version.toLowerCase(), JSON.stringify(progress));
}

function formatGoalValue(goal, value) {
    if (goal === "GP") {
        return Number(value).toLocaleString("en-GB") + " GP";
    }
    return Number(value).toLocaleString("en-GB");
}

function bindProgressCheckboxes(version) {
    document.querySelectorAll("[data-progress-key]").forEach(checkbox => {
        checkbox.addEventListener("change", () => {
            const progress = getGuideProgress(version);
            progress[checkbox.dataset.progressKey] = checkbox.checked;
            saveGuideProgress(version, progress);
            updatePhaseProgress(version, checkbox);
        });
    });
}

function updatePhaseProgress(version, changedCheckbox) {
    const phase = changedCheckbox.closest(".chapter");
    if (!phase) return;

    const objectiveCheckboxes = phase.querySelectorAll(".objective-check");
    const phaseCheckbox = phase.querySelector(".phase-check");
    if (!objectiveCheckboxes.length || !phaseCheckbox) return;

    if (changedCheckbox.classList.contains("objective-check")) {
        const allComplete = [...objectiveCheckboxes].every(item => item.checked);
        phaseCheckbox.checked = allComplete;
        const progress = getGuideProgress(version);
        progress[phaseCheckbox.dataset.progressKey] = allComplete;
        saveGuideProgress(version, progress);
    }
}

function getRoute() {
    return (window.location.hash.replace(/^#/, "") || "home").toLowerCase();
}

function loadSiteData() {
    Promise.all([
        fetch(rs_data.OSRS.guide_data).then(responseToJson),
        fetch(rs_data.RS3.guide_data).then(responseToJson),
        fetch(rs_data.OSRS.drops_data).then(responseToJson),
        fetch(rs_data.RS3.drops_data).then(responseToJson),
        fetch(featured_sewermaxxers).then(responseToJson)
    ]).then(([osrs, rs3, osrsDrops, rs3Drops, accounts]) => {
        appData = { osrs, rs3, osrsDrops, rs3Drops, accounts };
        renderRoute();
    }).catch(error => {
        console.error("Unable to load guide data.", error);
        document.getElementById("app").innerHTML = `
            <section class="error-panel">
                <p class="eyebrow">The sewer gate is jammed</p>
                <h1>Guide data could not be loaded</h1>
                <p>Check the configured JSON paths and try again. No local JSON content has been changed.</p>
            </section>`;
    });
}

function renderNavigation() {
    const route = getRoute();
    document.getElementById("main-nav").innerHTML = site_pages.map(([page, label]) =>
        `<a href="#${page}" class="${route === page ? "active" : ""}">${escapeHtml(label)}</a>`
    ).join("");
}

function renderRoute() {
    renderNavigation();
    const route = getRoute();
    const handlers = {
        home: renderHome,
        rs3: () => renderGuide("RS3"),
        osrs: () => renderGuide("OSRS"),
        accounts: renderAccounts,
        disclaimer: renderDisclaimer
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
    (handlers[route] || renderNotFound)();
}

function renderHome() {
    document.title = site_config.site_title;
    document.getElementById("app").innerHTML = `
        <section class="hero">
            <div class="hero-copy">
                <p class="eyebrow">A Varrock underground challenge</p>
                <h1>Master the sewers.<br><em>From nothing.</em></h1>
                <p>${escapeHtml(site_config.site_description)}</p>
                <div class="hero-actions">
                    <a class="button primary" href="#rs3">Enter RuneScape</a>
                    <a class="button ghost" href="#osrs">Enter Old School</a>
                </div>
            </div>
            <div class="edition-card edition-rs3">
                <span class="edition-number">01</span>
                <strong>RuneScape</strong>
                <small>Live the sewer challenge in Gielinor</small>
                <a href="#rs3">Open guide <span>&rarr;</span></a>
            </div>
            <div class="edition-card edition-osrs">
                <span class="edition-number">02</span>
                <strong>Old School</strong>
                <small>Return to the classic sewer rules</small>
                <a href="#osrs">Open guide <span>&rarr;</span></a>
            </div>
        </section>
        <section class="home-grid">
            <article class="feature-panel">
                <p class="eyebrow">The challenge</p>
                <h2>One account.<br>Three metres.</h2>
                <p>Build a self-imposed life in the Varrock Sewers, track every milestone, and make the most of every encounter.</p>
            </article>
            <article class="stat-panel">
                <p class="eyebrow">Field resources</p>
                <div class="resource-list">
                    <a href="#rs3"><span>RuneScape guide</span><b>Read &rarr;</b></a>
                    <a href="#osrs"><span>Old School guide</span><b>Read &rarr;</b></a>
                    <a href="#accounts"><span>Featured accounts</span><b>View &rarr;</b></a>
                </div>
            </article>
        </section>`;
}

function normaliseOverview(value) {
    return Array.isArray(value) ? value : [value];
}

function renderGuide(version) {
    const key = version.toLowerCase();
    const guide = appData[key];
    const started = guide.getting_started;
    const drops = version === "OSRS" ? appData.osrsDrops : appData.rs3Drops;
    const progress = getGuideProgress(version);
    document.title = `${guide.guide_title} | ${site_config.site_title}`;
    document.getElementById("app").innerHTML = `
        <section class="guide-header ${key}">
            <div>
                <p class="eyebrow">${version === "OSRS" ? "The classic edition" : "The modern edition"}</p>
                <h1>${escapeHtml(guide.guide_title)}</h1>
                <p>${escapeHtml(started.introduction)}</p>
            </div>
            <div class="guide-meta">
                <span>Last updated</span><strong>${escapeHtml(guide.last_updated)}</strong>
                <button class="button drop-button" data-open-drops="${version}">Browse monster drops</button>
            </div>
        </section>
        <section class="quick-facts">
            <article><span>Requirements</span><strong>${started.requirements.length}</strong></article>
            <button class="quick-fact-button" type="button" data-open-goals="${version}">
                <span>Challenge goals</span><strong>${started.challenge_objectives.length}</strong>
            </button>
            <article><span>Monster tables</span><strong>${drops.drops.length}</strong></article>
        </section>
        <div class="guide-layout">
            <aside class="guide-sidebar">
                <p class="eyebrow">Requirements</p>
                <ul>${started.requirements.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                <p class="eyebrow">Area restrictions</p>
                <ul>${started.area_restrictions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </aside>
            <div class="chapter-list">
                ${(started.steps || []).map((step, index) => `
                    <article class="chapter">
                        <div class="chapter-marker">${String(index + 1).padStart(2, "0")}</div>
                        <div>
                            <p class="chapter-kicker">Phase</p>
                            <div class="phase-heading">
                                <h2>${escapeHtml(step.title)}</h2>
                                <label class="progress-check">
                                    <input class="phase-check" type="checkbox" data-progress-key="phase-${index}" ${progress[`phase-${index}`] ? "checked" : ""}>
                                    <span>Complete phase</span>
                                </label>
                            </div>
                            ${normaliseOverview(step.overview).map(text => `<p>${escapeHtml(text)}</p>`).join("")}
                            <div class="requirement-grid">
                                ${Object.entries(step.required || {}).map(([type, items]) => `
                                    <div>
                                        <h3>${escapeHtml(type.replace(/_/g, " "))}</h3>
                                        ${items.length ? items.map(([name, amount]) => `<p><span>${escapeHtml(name)}</span><b>${escapeHtml(amount)}</b></p>`).join("") : `<p>None required</p>`}
                                    </div>`).join("")}
                            </div>
                            <div class="objectives">
                                ${(step.objectives || []).map((item, objectiveIndex) => `
                                    <article>
                                        <span>&#9878;</span>
                                        <div><h3>${escapeHtml(item.objective)}</h3><p>${escapeHtml(item.description)}</p></div>
                                        <label class="objective-progress" title="Mark objective complete">
                                            <input class="objective-check" type="checkbox" data-progress-key="phase-${index}-objective-${objectiveIndex}" ${progress[`phase-${index}-objective-${objectiveIndex}`] ? "checked" : ""}>
                                            <span>Done</span>
                                        </label>
                                    </article>`).join("")}
                            </div>
                        </div>
                    </article>`).join("")}
            </div>
        </div>`;
    bindProgressCheckboxes(version);
    document.querySelector("[data-open-drops]").addEventListener("click", () => openDrops(version));
    document.querySelector("[data-open-goals]").addEventListener("click", () => openChallengeGoals(version));
}

function openChallengeGoals(version) {
    const guide = version === "OSRS" ? appData.osrs : appData.rs3;
    const goals = guide.getting_started.challenge_objectives;
    const modal = createModal("goals-modal", `
        <header>
            <div><p class="eyebrow">Challenge objectives</p><h2>${escapeHtml(guide.guide_title)}</h2></div>
            <button class="modal-close" aria-label="Close">&times;</button>
        </header>
        <div class="goals-grid">
            ${goals.map(([goal, target], index) => `
                <article>
                    <span class="goal-number">${String(index + 1).padStart(2, "0")}</span>
                    <div><h3>${escapeHtml(goal)}</h3><strong>${escapeHtml(formatGoalValue(goal, target))}</strong></div>
                </article>`).join("")}
        </div>
    `);
    modal.querySelector(".modal-close").addEventListener("click", () => closeModal(modal));
}

function createModal(className, markup) {
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `<section class="${className}" role="dialog" aria-modal="true">${markup}</section>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add("visible"));
    modal.addEventListener("click", event => {
        if (event.target === modal) closeModal(modal);
    });
    return modal;
}

function closeModal(modal) {
    modal.classList.remove("visible");
    setTimeout(() => modal.remove(), 180);
}

function openDrops(version) {
    const data = version === "OSRS" ? appData.osrsDrops : appData.rs3Drops;
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `
        <section class="drops-modal" role="dialog" aria-modal="true" aria-label="${version} monster drops">
            <header>
                <div><p class="eyebrow">Monster archive</p><h2>${escapeHtml(data.metadata.title)}</h2></div>
                <button class="modal-close" aria-label="Close">&times;</button>
            </header>
            <div class="monster-grid">
                ${data.drops.map((monster, index) => `
                    <button class="monster-card" data-monster="${index}">
                        <span class="monster-sigil">${String(index + 1).padStart(2, "0")}</span>
                        <strong>${escapeHtml(monster.name)}</strong>
                        <small>Level ${escapeHtml(monster.level)}</small>
                        <span class="view-drops">View drops &rarr;</span>
                    </button>`).join("")}
            </div>
        </section>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add("visible"));
    const close = () => {
        modal.classList.remove("visible");
        setTimeout(() => modal.remove(), 180);
    };
    modal.querySelector(".modal-close").addEventListener("click", close);
    modal.addEventListener("click", event => { if (event.target === modal) close(); });
    modal.querySelectorAll("[data-monster]").forEach(card => card.addEventListener("click", () => {
        showMonsterDrops(modal, data.drops[Number(card.dataset.monster)], version);
    }));
}

function showMonsterDrops(modal, monster, version) {
    const grid = modal.querySelector(".monster-grid");
    grid.classList.add("detail-view");
    grid.innerHTML = `
        <div class="drop-detail">
            <button class="back-button">&larr; All monsters</button>
            <div class="drop-title"><span>${escapeHtml(version)}</span><h3>${escapeHtml(monster.name)} <small>Level ${escapeHtml(monster.level)}</small></h3></div>
            <div class="drop-tables">
                ${Object.entries(monster.drops).map(([category, rows]) => `
                    <section>
                        <h4>${escapeHtml(category.replace(/_/g, " "))}</h4>
                        ${rows.map(([name, quantity, chance]) => `
                            <div class="drop-row">
                                <span class="drop-icon">${escapeHtml(name.charAt(0))}</span>
                                <strong>${escapeHtml(name)}</strong>
                                <span>x${escapeHtml(quantity)}</span>
                                <em>${escapeHtml(chance)}</em>
                            </div>`).join("")}
                    </section>`).join("")}
            </div>
        </div>`;
    grid.querySelector(".back-button").addEventListener("click", () => {
        modal.remove();
        openDrops(version);
    });
}

function renderAccounts() {
    document.title = `Featured Accounts | ${site_config.site_title}`;
    const accounts = appData.accounts.accounts || [];
    const acc_lu = appData.accounts.last_updated;
    document.getElementById("app").innerHTML = `
        <section class="page-heading">
            <p class="eyebrow">Notable challengers</p>
            <h1>Featured accounts</h1>
            <p>Featured accounts known to have taken part in the SewerMaxxing challenge.</p>
            <p>Last Updated:  ${acc_lu}</p>
        </section>
        <div class="account-grid">
            ${accounts.map(account => `
                <article class="account-card">
                    <div class="account-banner ${account.version.toLowerCase()}"><span>${escapeHtml(account.version)}</span></div>
                    <div class="account-body">
                        <p class="account-type">${escapeHtml(account.account_type)} &middot; ${escapeHtml(account.account_tier)}</p>
                        <h2>${escapeHtml(account.player_name)}</h2>
                        <div class="account-stats">
                            <div><span>Combat</span><strong>${escapeHtml(account.stats.combat_level)}</strong></div>
                            <div><span>Total level</span><strong>${escapeHtml(account.stats.total_level)}</strong></div>
                        </div>
                        <details>
                            <summary>View skills</summary>
                            <div class="skill-grid">
                                ${Object.entries(account.stats.skills).map(([skill, level]) => `<span>${escapeHtml(skill)} <b>${escapeHtml(level)}</b></span>`).join("")}
                            </div>
                        </details>
                    </div>
                </article>`).join("")}
        </div>`;
}

function renderDisclaimer() {
    document.title = `Disclaimer | ${site_config.site_title}`;
    document.getElementById("app").innerHTML = `
        <section class="simple-page">
            <p class="eyebrow">Community project</p>
            <h1>Disclaimer</h1>
            <p>SewerMaxxing Guide Book is a community-made fan project. It is not affiliated with, endorsed by, or supported by Jagex Limited.</p>
            <p>RuneScape and Old School RuneScape are trademarks of Jagex Limited. All game names, imagery and related marks belong to their respective owners.</p>
            <p>Content is provided for general guidance and may change as the challenge evolves.</p>
        </section>`;
}

function renderNotFound() {
    document.getElementById("app").innerHTML = `<section class="simple-page"><p class="eyebrow">404</p><h1>Lost beneath Varrock</h1><p><a href="#home">Return to the surface</a></p></section>`;
}

window.addEventListener("hashchange", renderRoute);
document.addEventListener("DOMContentLoaded", loadSiteData);
