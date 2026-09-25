const source_dir = new URL("../", document.currentScript.src).href.replace(/\/$/, "");
const source_files = {
    alliance: `${source_dir}/data/alliance.json`,
    bases: `${source_dir}/data/bases.json`,
    members: `${source_dir}/data/members.json`,
    systems: `${source_dir}/data/systems.json`
};

const pageIds = ["home", "members", "territory", "bases", "join"];
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

function renderSystems(systems) {
    const container = document.querySelector("[data-systems-list]");
    container.replaceChildren();
    if (!systems.length) {
        addEmptyState(container, "No systems have been charted yet.");
        return;
    }

    systems.forEach((system) => {
        const info = system.system_info || {};
        const card = makeElement("article", "system-card");
        const heading = makeElement("div", "system-head");
        heading.append(
            makeElement("h2", "", info.name || "Unnamed system"),
            makeElement("p", "", [info.region, info.galaxy].filter(Boolean).join(" · "))
        );
        const bodyList = makeElement("div", "body-list");
        const bodies = Array.isArray(system.bodies) ? system.bodies : [];

        if (!bodies.length) {
            bodyList.append(makeElement("p", "empty-state", "No worlds recorded in this system."));
        }

        bodies.forEach((body) => {
            const bodyCard = makeElement("section", "body-card");
            bodyCard.append(
                makeElement("h3", "", body.name || "Unnamed body"),
                makeElement("p", "", [body.type, body.environment].filter(Boolean).join(" · "))
            );
            if (Array.isArray(body.glyphs) && body.glyphs.length) {
                bodyCard.append(makeElement("p", "glyphs", `Glyphs · ${body.glyphs.join(" ")}`));
            }

            const details = document.createElement("dl");
            [["Resources", body.resources], ["Flora", body.flora], ["Fauna", body.fauna]].forEach(([label, values]) => {
                if (!Array.isArray(values) || !values.length) return;
                details.append(
                    makeElement("dt", "", label),
                    makeElement("dd", "", values.join(", "))
                );
            });
            bodyCard.append(details);
            bodyList.append(bodyCard);
        });

        card.append(heading, bodyList);
        container.append(card);
    });
}

function resolveBaseLocation(location, systems) {
    if (!location || !Number.isInteger(location.system)) return "Location not specified";
    const system = systems[location.system];
    if (!system) return "System not found";
    const systemName = system.system_info?.name || `System ${location.system + 1}`;
    const planetIndex = location.planet;
    if (!Number.isInteger(planetIndex)) return systemName;
    const bodyName = system.bodies?.[planetIndex]?.name || `Body ${planetIndex + 1}`;
    return `${systemName} · ${bodyName}`;
}

function renderBases(bases, systems) {
    const container = document.querySelector("[data-bases-list]");
    container.replaceChildren();
    if (!bases.length) {
        addEmptyState(container, "No alliance bases have been listed yet.");
        return;
    }

    bases.forEach((base) => {
        const card = makeElement("article", "base-card");
        card.append(
            makeElement("h2", "", base.name || "Unnamed base"),
            makeElement("p", "", base.description || ""),
            makeElement("p", "", base.creator ? `Built by ${base.creator}` : "")
        );
        const location = makeElement("p", "base-location coordinates", resolveBaseLocation(base.location, systems));
        card.append(location);
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

    setText("[data-alliance-name]", allianceName);
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
    renderSystems(systems);
    renderBases(bases, systems);

    const status = document.getElementById("load-status");
    if (failures.length) {
        status.classList.add("error");
        status.textContent = `Some alliance records could not be loaded: ${failures.join(", ")}.`;
    } else {
        status.textContent = "Alliance records updated.";
    }
}

window.addEventListener("hashchange", route);
route();
loadAllianceSite().catch((error) => {
    const status = document.getElementById("load-status");
    status.classList.add("error");
    status.textContent = `Alliance records could not be loaded: ${error.message}`;
});
