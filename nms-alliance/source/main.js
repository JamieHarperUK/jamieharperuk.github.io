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
const socialPlatforms = [
    { key: "discord", label: "Discord", mark: "D" },
    { key: "facebook", label: "Facebook", mark: "f" },
    { key: "twitter", label: "X / Twitter", mark: "X" },
    { key: "youtube", label: "YouTube", mark: "▶" },
    { key: "reddit", label: "Reddit", mark: "r/" }
];
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

function renderJoinRoles(roles) {
    const container = document.querySelector("[data-join-roles]");
    container.replaceChildren();
    if (!roles.length) {
        addEmptyState(container, "Alliance roles have not been listed yet.");
        container.firstElementChild.classList.add("join-role-empty");
        return;
    }

    roles.forEach((role, index) => {
        const item = makeElement("article", "join-role");
        item.append(
            makeElement("span", "join-role-index", String(index + 1).padStart(2, "0")),
            makeElement("h3", "", role.name || "Alliance role"),
            makeElement("p", "", role.description || "")
        );
        container.append(item);
    });
}

function normalizeSocialUrl(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "#") return "";

    try {
        const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
        return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
        return "";
    }
}

function renderSocialLinks(socials) {
    const section = document.querySelector("[data-social-section]");
    const container = document.querySelector("[data-social-links]");
    const platforms = [
        { key: "discord", label: "Discord", mark: "D" },
        { key: "facebook", label: "Facebook", mark: "f" },
        { key: "twitter", label: "X / Twitter", mark: "X" },
        { key: "youtube", label: "YouTube", mark: "▶" },
        { key: "reddit", label: "Reddit", mark: "r/" }
    ];
    container.replaceChildren();

    platforms.forEach(({ key, label, mark }) => {
        const href = normalizeSocialUrl(socials && socials[key]);
        if (!href) return;

        const link = document.createElement("a");
        link.className = `social-link social-${key}`;
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `Open ${label} in a new tab`);

        const icon = makeElement("span", "social-icon", mark);
        icon.setAttribute("aria-hidden", "true");
        link.append(icon, makeElement("span", "social-name", label));
        const outbound = makeElement("span", "social-outbound", "↗");
        outbound.setAttribute("aria-hidden", "true");
        link.append(outbound);
        container.append(link);
    });

    section.hidden = container.childElementCount === 0;
}

function normalizeSocialUrl(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "#") return "";

    try {
        const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
        return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
        return "";
    }
}

function renderSocialLinks(socials) {
    const section = document.querySelector("[data-social-section]");
    const container = document.querySelector("[data-social-links]");
    container.replaceChildren();

    socialPlatforms.forEach(({ key, label, mark }) => {
        const href = normalizeSocialUrl(socials && socials[key]);
        if (!href) return;

        const link = document.createElement("a");
        link.className = `social-link social-${key}`;
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `Open ${label} in a new tab`);

        const icon = makeElement("span", "social-icon", mark);
        icon.setAttribute("aria-hidden", "true");
        link.append(icon, makeElement("span", "social-name", label));
        const outbound = makeElement("span", "social-outbound", "↗");
        outbound.setAttribute("aria-hidden", "true");
        link.append(outbound);
        container.append(link);
    });

    section.hidden = container.childElementCount === 0;
}

function renderMembers(members) {
    const container = document.querySelector("[data-members-list]");
    container.replaceChildren();
    if (!members.length) {
        addEmptyState(container, "No members have been added yet.");
        return;
    }

    members.forEach((member, index) => {
        const info = member.info || {};
        const card = makeElement("article", "member-card");
        const name = String(info.name || "Alliance member").trim();
        const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
        const role = String(info.role || "Member").trim();
        card.dataset.role = role.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        const cardTop = makeElement("div", "member-card-top");
        cardTop.append(
            makeElement("span", "member-index", `Explorer ${String(index + 1).padStart(2, "0")}`),
            makeElement("span", "member-role", role)
        );

        const identity = makeElement("div", "member-identity");
        identity.append(
            makeElement("span", "member-monogram", initials || "N"),
            makeElement("div", "member-identity-copy")
        );
        const identityCopy = identity.querySelector(".member-identity-copy");
        identityCopy.append(makeElement("h2", "", name));
        if (info.joined_date) {
            const joined = makeElement("p", "member-joined");
            joined.append(makeElement("span", "", "Joined"));
            const date = makeElement("time", "", info.joined_date);
            const dateParts = String(info.joined_date).match(/^(\d{2})-(\d{2})-(\d{4})$/);
            if (dateParts) date.dateTime = `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`;
            joined.append(date);
            identityCopy.append(joined);
        }

        card.append(cardTop, identity);
        if (info.nms_friend_code) {
            const friendCode = makeElement("div", "member-code");
            friendCode.append(
                makeElement("span", "member-code-label", "Friend code"),
                makeElement("span", "member-code-value", info.nms_friend_code)
            );
            card.append(friendCode);
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
                    Number.isInteger(glyph) && glyph >= 1 && glyph <= 16
                        ? (glyph === 16 ? "0" : glyph.toString(16).toUpperCase())
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

        const asteroidBases = bases.filter((base) => (
            base.location?.system === systemIndex
            && (base.location?.body_type === "habitable_asteroid" || base.location?.planet === -1)
        ));
        if (asteroidBases.length) {
            const asteroidCard = document.createElement("details");
            asteroidCard.className = "body-card body-accordion asteroid-accordion";
            const asteroidHeading = document.createElement("summary");
            asteroidHeading.className = "body-head";
            asteroidHeading.append(
                makeElement("h3", "", "Habitable Asteroid"),
                makeElement("p", "", `${asteroidBases.length} ${asteroidBases.length === 1 ? "base" : "bases"}`)
            );
            const asteroidContent = makeElement("div", "body-content");
            const baseList = makeElement("div", "body-bases asteroid-bases");
            baseList.append(makeElement("h4", "", `Bases · ${asteroidBases.length}`));
            asteroidBases.forEach((base) => {
                const baseEntry = makeElement("article", "body-base");
                baseEntry.append(
                    makeElement("h5", "", base.name || "Unnamed base"),
                    makeElement("p", "", base.description || ""),
                    makeElement("p", "body-base-creator", base.creator ? `Built by ${base.creator}` : "")
                );
                baseList.append(baseEntry);
            });
            asteroidContent.append(baseList);
            asteroidCard.append(asteroidHeading, asteroidContent);
            bodyList.append(asteroidCard);
        }

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
    const socials = info.socials && typeof info.socials === "object" && !Array.isArray(info.socials) ? info.socials : {};
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
    renderJoinRoles(roles);
    renderSocialLinks(socials);
    renderSocialLinks(info.socials);
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

const disclaimerDialog = document.getElementById("disclaimer");
document.getElementById("open-disclaimer").addEventListener("click", (event) => {
    event.preventDefault();
    disclaimerDialog.showModal();
});
document.querySelectorAll("[data-close-disclaimer]").forEach((button) => {
    button.addEventListener("click", () => disclaimerDialog.close());
});
disclaimerDialog.addEventListener("click", (event) => {
    if (event.target === disclaimerDialog) disclaimerDialog.close();
});
disclaimerDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    disclaimerDialog.close();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && disclaimerDialog.open) disclaimerDialog.close();
});

loadAllianceSite().catch((error) => {
    const status = document.getElementById("load-status");
    status.classList.add("error");
    status.textContent = `Alliance records could not be loaded: ${error.message}`;
});
