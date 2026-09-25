const source_dir = new URL("../", document.currentScript.src).href.replace(/\/$/, "");
const source_files = {
    alliance: `${source_dir}/data/alliance.json`,
    bases: `${source_dir}/data/bases.json`,
    members: `${source_dir}/data/members.json`,
    systems: `${source_dir}/data/systems.json`
};

const pageIds = ["home", "members", "territory", "join"];
const systemColors = {
    yellow: "#e5c94f",
    red: "#e26c64",
    blue: "#70a9e8",
    green: "#70bd87",
    purple: "#b392d9"
};
const emptyData = {
    alliance: { info: {}, roles: [] },
    bases: { bases: [] },
    members: { members: [] },
    systems: { systems: [] }
};

function setText(selector, value) {
    document.querySelectorAll(selector).forEach((element) => {
        element.textContent = value == null ? "" : String(value);
    });
}

function makeElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text != null) element.textContent = String(text);
    return element;
}

function addEmptyState(container, message) {
    container.replaceChildren(makeElement("p", "empty-state", message));
}

function renderRoles(roles, container) {
    container.replaceChildren();
    if (!roles.length) {
        addEmptyState(container, "Alliance roles have not been listed yet.");
        return;
    }

    roles.forEach((role) => {
        const item = makeElement("article", "role-item");
        item.append(
            makeElement("h3", "", role.name || "Alliance role"),
            makeElement("p", "", role.description || "")
        );
        container.append(item);
    });
}

function renderMembers(members) {
    const container = document.querySelector("[data-members-list]");
    container.replaceChildren();
    if (!members.length) {
        addEmptyState(container, "No members have been added yet.");
        return;
    }

    members.forEach((member) => {
        const info = member.info || {};
        const card = makeElement("article", "member-card");
        card.append(
            makeElement("h2", "", info.name || "Alliance member"),
            makeElement("p", "member-role", info.role || "Member"),
            makeElement("p", "", info.joined_date ? `Joined ${info.joined_date}` : "")
        );
        if (info.nms_friend_code) {
            card.append(makeElement("p", "member-code", `Friend code · ${info.nms_friend_code}`));
        }
        container.append(card);
    });
}

function renderSystems(systems, bases) {
    const container = document.querySelector("[data-systems-list]");
    container.replaceChildren();
    if (!systems.length) {
        addEmptyState(container, "No systems have been charted yet.");
        return;
    }

    systems.forEach((system, systemIndex) => {
        const info = system.system_info || {};
        const card = document.createElement("details");
        card.className = "system-card system-accordion";
        card.open = systemIndex === 0;
        const colorName = String(info.system_color || "").trim().toLowerCase();
        if (systemColors[colorName]) {
            card.dataset.systemColor = colorName;
            card.style.setProperty("--system-accent", systemColors[colorName]);
        }

        const heading = document.createElement("summary");
        heading.className = "system-head";
        heading.append(makeElement("h2", "", info.name || "Unnamed system"));
        if (systemColors[colorName]) {
            const colorLabel = makeElement("span", "system-color", colorName);
            colorLabel.setAttribute("aria-label", `${colorName} system`);
            heading.append(colorLabel);
        }

        const systemInfo = makeElement("dl", "system-info");
        [["Station", info.station_name], ["Region", info.region], ["Galaxy", info.galaxy]].forEach(([label, value]) => {
            if (!value) return;
            const row = makeElement("div", "system-info-item");
            row.append(makeElement("dt", "", label), makeElement("dd", "", value));
            systemInfo.append(row);
        });
        const bodyList = makeElement("div", "body-list");
        const bodies = Array.isArray(system.bodies) ? system.bodies : [];

        if (!bodies.length) {
            bodyList.append(makeElement("p", "empty-state", "No worlds recorded in this system."));
        }

        bodies.forEach((body, bodyIndex) => {
            const bodyCard = document.createElement("details");
            bodyCard.className = "body-card body-accordion";
            const bodyHeading = document.createElement("summary");
            bodyHeading.className = "body-head";
            bodyHeading.append(
                makeElement("h3", "", body.name || "Unnamed body"),
                makeElement("p", "", [body.type, body.environment].filter(Boolean).join(" · "))
            );
            const bodyContent = makeElement("div", "body-content");
            if (Array.isArray(body.glyphs) && body.glyphs.length) {
                const glyphLabel = makeElement("span", "glyph-label", "Portal glyphs");
                const glyphCode = makeElement("span", "glyph-code", body.glyphs.map((glyph) => (
                    Number.isInteger(glyph) && glyph >= 0 && glyph <= 15
                        ? glyph.toString(16).toUpperCase()
                        : "?"
                )).join(""));
                glyphCode.setAttribute("aria-label", `Portal glyph sequence ${body.glyphs.join(", ")}`);
                const glyphLine = makeElement("p", "glyphs");
                glyphLine.append(glyphLabel, glyphCode);
                bodyContent.append(glyphLine);
            }

            const details = document.createElement("dl");
            [["Resources", body.resources], ["Flora", body.flora], ["Fauna", body.fauna]].forEach(([label, values]) => {
                if (!Array.isArray(values) || !values.length) return;
                details.append(
                    makeElement("dt", "", label),
                    makeElement("dd", "", values.join(", "))
                );
            });
            bodyContent.append(details);

            const bodyBases = bases.filter((base) => (
                base.location?.system === systemIndex && base.location?.planet === bodyIndex
            ));
            if (bodyBases.length) {
                const baseList = makeElement("div", "body-bases");
                baseList.append(makeElement("h4", "", `Bases · ${bodyBases.length}`));
                bodyBases.forEach((base) => {
                    const baseEntry = makeElement("article", "body-base");
                    baseEntry.append(
                        makeElement("h5", "", base.name || "Unnamed base"),
                        makeElement("p", "", base.description || ""),
                        makeElement("p", "body-base-creator", base.creator ? `Built by ${base.creator}` : "")
                    );
                    baseList.append(baseEntry);
                });
                bodyContent.append(baseList);
            }

            bodyCard.append(bodyHeading, bodyContent);
            bodyList.append(bodyCard);
        });

        card.append(heading);
        if (systemInfo.childElementCount) card.append(systemInfo);
        card.append(bodyList);
        container.append(card);
    });
}

function route() {
    const requested = window.location.hash.slice(1);
    const activePage = pageIds.includes(requested) ? requested : "home";
    document.querySelectorAll(".page").forEach((page) => {
        const isActive = page.id === activePage;
        page.classList.toggle("active", isActive);
        page.setAttribute("aria-hidden", String(!isActive));
    });
    document.querySelectorAll("nav [data-page]").forEach((link) => {
        const isActive = link.dataset.page === activePage;
        link.classList.toggle("active", isActive);
        if (isActive) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    });
}

async function loadJson(url, fallback) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
}

async function loadAllianceSite() {
    const keys = Object.keys(source_files);
    const results = await Promise.allSettled(keys.map((key) => loadJson(source_files[key], emptyData[key])));
    const data = { ...emptyData };
    const failures = [];

    results.forEach((result, index) => {
        if (result.status === "fulfilled") data[keys[index]] = result.value;
        else failures.push(keys[index]);
    });

    const info = data.alliance.info || {};
    const members = Array.isArray(data.members.members) ? data.members.members : [];
    const systems = Array.isArray(data.systems.systems) ? data.systems.systems : [];
    const bases = Array.isArray(data.bases.bases) ? data.bases.bases : [];
    const roles = Array.isArray(data.alliance.roles) ? data.alliance.roles : [];
    const homeSystemIndex = Number(info.home_system);
    const homeSystem = Number.isInteger(homeSystemIndex) ? systems[homeSystemIndex] : null;
    const allianceName = info.alliance_name || "Alliance Name";

    // setText("[data-alliance-name]", allianceName);
    setText(".brand-name", allianceName);
    setText("[data-alliance-description]", info.alliance_description || "A community of explorers making a home among the stars.");
    setText("[data-home-system]", homeSystem?.system_info?.name || "Uncharted");
    setText("[data-leaderboard-score]", Number(info.leaderboard_score || 0).toLocaleString());
    setText("[data-member-count]", members.length);
    setText("[data-system-count]", systems.length);
    setText("[data-base-count]", bases.length);
    setText("#current-year", new Date().getFullYear());
    document.title = `${allianceName} | No Man's Sky Alliance`;
    renderRoles(roles, document.querySelector("[data-role-list]"));
    renderRoles(roles, document.querySelector("[data-join-roles]"));
    renderMembers(members);
    renderSystems(systems, bases);
    const status = document.getElementById("load-status");
    if (failures.length) {
        status.classList.add("error");
        status.textContent = `Some alliance records could not be loaded: ${failures.join(", ")}.`;
    } else {
        status.textContent = "";
    }
}

window.addEventListener("hashchange", route);
route();
loadAllianceSite().catch((error) => {
    const status = document.getElementById("load-status");
    status.classList.add("error");
    status.textContent = `Alliance records could not be loaded: ${error.message}`;
});
