const FC_MANAGER_CONFIG = {
    repoFullName: "jamieharperuk/jamieharperuk.github.io",
    siteBaseUrl: "https://jamieharperuk.github.io/fc-template/",
    oauth: {
        clientId: "Ov23liJxZCIXpxYWlATm",
        scope: "repo read:user",
        brokerBaseUrl: "https://ghwe.oakshiftsoftware.workers.dev"
    },
    files: [
        { key: "club", label: "Club", path: "fc-template/data/fc_club.json" },
        { key: "games", label: "Games", path: "fc-template/data/fc_games.json" },
        { key: "teams", label: "Teams", path: "fc-template/data/fc_teams.json" },
        { key: "tables", label: "Tables", path: "fc-template/data/fc_tables.json" },
        { key: "tickets", label: "Tickets", path: "fc-template/data/fc_tickets.json" }
    ]
};

const STORAGE_KEYS = {
    session: "fc_manager_auth_session",
    drafts: "fc_manager_local_drafts"
};

const state = {
    repoFullName: FC_MANAGER_CONFIG.repoFullName,
    repo: null,
    selectedKeys: new Set(["club", "games", "teams", "tables", "tickets"]),
    activeKey: "club",
    files: [],
    token: "",
    authSession: null
};

const elements = {};

function setOutput(message, tone = "info") {
    const output = elements.output;
    if (!output) return;
    output.textContent = message;
    output.style.color = tone === "error" ? "#f7b5b5" : tone === "ok" ? "#b9f0d0" : "#c6d7ef";
}

function setStatusChip(element, message, tone = "info") {
    if (!element) return;
    element.textContent = message;
    element.className = "status-pill";
    if (tone === "ok") element.classList.add("ok");
    if (tone === "warn") element.classList.add("warn");
    if (tone === "bad") element.classList.add("bad");
}

function readStoredAuthSession() {
    const raw = sessionStorage.getItem(STORAGE_KEYS.session);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !parsed.accessToken) return null;
        if (parsed.expiresAt && Date.now() >= Number(parsed.expiresAt)) {
            sessionStorage.removeItem(STORAGE_KEYS.session);
            return null;
        }
        return parsed;
    } catch (_error) {
        sessionStorage.removeItem(STORAGE_KEYS.session);
        return null;
    }
}

function saveStoredAuthSession(accessToken, tokenPayload) {
    const expiresIn = Number(tokenPayload && tokenPayload.expires_in) || 8 * 60 * 60;
    const session = {
        accessToken,
        createdAt: Date.now(),
        expiresAt: Date.now() + (expiresIn * 1000)
    };
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    state.authSession = session;
    state.token = accessToken;
}

function clearStoredAuthSession() {
    sessionStorage.removeItem(STORAGE_KEYS.session);
    state.authSession = null;
    state.token = "";
}

function getAuthHeaders(extra = {}) {
    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...extra
    };
    if (state.token) headers.Authorization = "token " + state.token;
    return headers;
}

async function ghFetch(path, options = {}) {
    const response = await fetch("https://api.github.com" + path, {
        headers: getAuthHeaders(),
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error("GitHub API request failed: " + response.status + " " + response.statusText + (text ? " - " + text : ""));
    }

    return response;
}

function getFileRecord(key) {
    return state.files.find((file) => file.key === key) || null;
}

function decodeBase64Content(encoded) {
    const normalized = String(encoded || "").replace(/\s/g, "");
    if (!normalized) return "";
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
}

function parseJsonOrNull(content, fallbackValue) {
    try {
        const value = JSON.parse(content);
        return value;
    } catch (_error) {
        return fallbackValue;
    }
}

function createDefaultJsonForKey(key) {
    const defaults = {
        club: {
            metadata: { lastUpdated: new Date().toISOString(), version: "1.0.0" },
            club: {
                club_name: "The Club",
                home_venue: "Home Ground",
                city: "City Name",
                country: "Country Name",
                established_year: "2026",
                description: "The Club is a placeholder football club, your team details should replace this information.",
                socials: {
                    facebook: "#",
                    twitter_x: "#",
                    instagram: "#",
                    youtube: "#",
                    tiktok: "#"
                }
            }
        },
        games: {
            metadata: { lastUpdated: new Date().toISOString(), version: "1.1.0" },
            games: []
        },
        teams: {
            metadata: { lastUpdated: new Date().toISOString(), version: "1.2.0" },
            teams: []
        },
        tables: {
            metadata: { lastUpdated: new Date().toISOString(), version: "1.0.0" },
            tables: []
        },
        tickets: {
            metadata: { lastUpdated: new Date().toISOString(), version: "1.0.0" },
            tickets: []
        }
    };
    return defaults[key] || { };
}

function normalizeDraftContent(file) {
    if (file.draftContent && typeof file.draftContent === "string") {
        return file.draftContent;
    }
    return JSON.stringify(file.json || createDefaultJsonForKey(file.key), null, 2);
}

function upsertFileState(fileMeta, payload, sha) {
    const existing = getFileRecord(fileMeta.key);
    const json = parseJsonOrNull(payload, createDefaultJsonForKey(fileMeta.key));
    const draftContent = JSON.stringify(json, null, 2);

    if (existing) {
        existing.label = fileMeta.label;
        existing.path = fileMeta.path;
        existing.sha = sha || existing.sha || "";
        existing.json = json;
        existing.draftContent = draftContent;
        return existing;
    }

    const item = {
        key: fileMeta.key,
        label: fileMeta.label,
        path: fileMeta.path,
        sha: sha || "",
        json,
        draftContent
    };
    state.files.push(item);
    return item;
}

function renderFileList() {
    const list = elements.fileList;
    if (!list) return;
    list.innerHTML = "";

    FC_MANAGER_CONFIG.files.forEach((fileMeta) => {
        const file = getFileRecord(fileMeta.key) || {
            key: fileMeta.key,
            label: fileMeta.label,
            path: fileMeta.path,
            json: createDefaultJsonForKey(fileMeta.key),
            draftContent: JSON.stringify(createDefaultJsonForKey(fileMeta.key), null, 2),
            sha: ""
        };

        const item = document.createElement("li");
        item.className = "file-item" + (state.activeKey === file.key ? " active" : "");

        const main = document.createElement("div");
        main.className = "file-main";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.selectedKeys.has(file.key);
        checkbox.setAttribute("aria-label", "Select " + file.label + " for commit");
        checkbox.addEventListener("change", (event) => {
            event.stopPropagation();
            if (event.target.checked) {
                state.selectedKeys.add(file.key);
            } else {
                state.selectedKeys.delete(file.key);
            }
            renderFileList();
        });

        const label = document.createElement("span");
        label.className = "file-label";
        label.textContent = file.label;

        const statusDot = document.createElement("span");
        statusDot.className = "file-badge";
        statusDot.textContent = file.sha ? "synced" : "new";

        main.appendChild(checkbox);
        main.appendChild(label);
        main.appendChild(statusDot);
        main.addEventListener("click", () => {
            state.activeKey = file.key;
            renderFileList();
            renderActiveEditor();
        });

        item.appendChild(main);
        list.appendChild(item);
    });
}

function renderActiveEditor() {
    const file = getFileRecord(state.activeKey) || getFileRecord("club");
    if (!file) return;

    elements.editorTitle.textContent = file.label;
    elements.editorArea.value = normalizeDraftContent(file);
    const outputText = "Ready to edit " + file.path + ".";
    setOutput(outputText, "info");
}

function setCurrentDraftFromEditor() {
    const file = getFileRecord(state.activeKey);
    if (!file) return;
    file.draftContent = elements.editorArea.value;
}

function readLocalDrafts() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.drafts);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return;
        Object.entries(parsed).forEach(([key, value]) => {
            const file = getFileRecord(key);
            if (!file) return;
            file.draftContent = typeof value === "string" ? value : JSON.stringify(file.json || createDefaultJsonForKey(key), null, 2);
        });
    } catch (_error) {
        localStorage.removeItem(STORAGE_KEYS.drafts);
    }
}

function persistLocalDrafts() {
    const payload = {};
    state.files.forEach((file) => {
        payload[file.key] = file.draftContent || JSON.stringify(file.json || createDefaultJsonForKey(file.key), null, 2);
    });
    localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(payload));
}

async function startDeviceFlow() {
    const brokerBaseUrl = String(FC_MANAGER_CONFIG.oauth.brokerBaseUrl || "").replace(/\/$/, "");
    if (!brokerBaseUrl) {
        throw new Error("GitHub OAuth broker is not configured.");
    }

    const response = await fetch(brokerBaseUrl + "/github/device/code", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: FC_MANAGER_CONFIG.oauth.clientId,
            scope: FC_MANAGER_CONFIG.oauth.scope
        })
    });

    if (!response.ok) {
        throw new Error("Unable to begin GitHub device flow.");
    }

    const payload = await response.json();
    if (!payload || !payload.device_code || !payload.user_code) {
        throw new Error("OAuth device flow did not return the expected values.");
    }

    const intervalSeconds = Number(payload.interval || 5);
    const expiresInSeconds = Number(payload.expires_in || 900);
    const expiresAt = Date.now() + (expiresInSeconds * 1000);

    setOutput("GitHub login required. Open the auth URL and enter the code shown in the browser.", "warn");

    const authUrl = "https://github.com/login/device";
    window.open(authUrl, "_blank", "noopener,noreferrer");
    window.alert("Open GitHub and enter the device code shown in the browser.\n\nUser code: " + payload.user_code + "\n\nThis popup will continue automatically once the code is approved.");

    const pollUntil = Date.now() + (expiresInSeconds * 1000);
    while (Date.now() < pollUntil) {
        await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
        const tokenResponse = await fetch(brokerBaseUrl + "/github/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: FC_MANAGER_CONFIG.oauth.clientId,
                device_code: payload.device_code,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code"
            })
        });

        const tokenJson = await tokenResponse.json();
        if (tokenJson && tokenJson.access_token) {
            saveStoredAuthSession(tokenJson.access_token, tokenJson);
            return tokenJson.access_token;
        }

        if (tokenJson && tokenJson.error === "authorization_pending") {
            continue;
        }

        if (tokenJson && tokenJson.error === "slow_down") {
            continue;
        }

        if (tokenJson && tokenJson.error) {
            throw new Error("GitHub device flow failed: " + tokenJson.error_description || tokenJson.error);
        }
    }

    throw new Error("GitHub device flow expired before approval was received.");
}

async function connectRepository() {
    const repoInput = document.getElementById("repoInput");
    const repoName = (repoInput ? repoInput.value : state.repoFullName).trim();
    if (!repoName) {
        setOutput("Enter a GitHub repository in the form owner/repo.", "error");
        return;
    }

    state.repoFullName = repoName;
    setStatusChip(elements.repoStatus, "Connecting…", "warn");
    setOutput("Connecting to GitHub and loading the FC template files…", "info");

    try {
        const authSession = readStoredAuthSession();
        if (authSession && authSession.accessToken) {
            state.token = authSession.accessToken;
            state.authSession = authSession;
        } else {
            await startDeviceFlow();
        }

        const repoResponse = await ghFetch("/repos/" + encodeURIComponent(repoName).replace(/%2F/g, "/"));
        state.repo = await repoResponse.json();
        const branch = state.repo.default_branch || "main";
        setStatusChip(elements.branchStatus, "branch: " + branch, "ok");
        setStatusChip(elements.repoStatus, "Connected", "ok");

        state.files = [];
        await Promise.all(FC_MANAGER_CONFIG.files.map(async (fileMeta) => {
            try {
                const fileResponse = await ghFetch("/repos/" + repoName + "/contents/" + encodeURIComponent(fileMeta.path).replace(/%2F/g, "/"));
                const filePayload = await fileResponse.json();
                const rawText = decodeBase64Content(filePayload.content);
                const json = parseJsonOrNull(rawText, createDefaultJsonForKey(fileMeta.key));
                upsertFileState(fileMeta, JSON.stringify(json, null, 2), filePayload.sha);
            } catch (_error) {
                upsertFileState(fileMeta, JSON.stringify(createDefaultJsonForKey(fileMeta.key), null, 2), "");
            }
        }));

        readLocalDrafts();
        if (!state.files.some((file) => file.key === state.activeKey)) {
            state.activeKey = state.files[0]?.key || "club";
        }
        renderFileList();
        renderActiveEditor();
        setOutput("Loaded " + state.files.length + " FC data files. Select multiple items and commit them together.", "ok");
    } catch (error) {
        console.error(error);
        setStatusChip(elements.repoStatus, "Auth failed", "bad");
        setOutput(error.message || "Unable to connect to the repository.", "error");
    }
}

async function getBranchHeadCommitSha(repoFullName, branch) {
    const refResponse = await ghFetch("/repos/" + repoFullName + "/git/ref/heads/" + encodeURIComponent(branch));
    const refPayload = await refResponse.json();
    return refPayload && refPayload.object ? refPayload.object.sha : "";
}

async function getCommitTreeSha(repoFullName, commitSha) {
    const commitResponse = await ghFetch("/repos/" + repoFullName + "/git/commits/" + commitSha);
    const commitPayload = await commitResponse.json();
    return commitPayload && commitPayload.tree ? commitPayload.tree.sha : "";
}

async function createBlob(repoFullName, contentString) {
    const blobResponse = await ghFetch("/repos/" + repoFullName + "/git/blobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentString, encoding: "utf-8" })
    });
    const blobPayload = await blobResponse.json();
    return blobPayload.sha;
}

async function commitFilesTogether(repoFullName, branch, message, files) {
    const parentCommitSha = await getBranchHeadCommitSha(repoFullName, branch);
    if (!parentCommitSha) {
        throw new Error("Unable to resolve branch head commit.");
    }

    const baseTreeSha = await getCommitTreeSha(repoFullName, parentCommitSha);
    if (!baseTreeSha) {
        throw new Error("Unable to resolve base tree for branch.");
    }

    const treeEntries = [];
    const fileBlobShas = {};

    for (const file of files) {
        const blobSha = await createBlob(repoFullName, file.content);
        fileBlobShas[file.path] = blobSha;
        treeEntries.push({ path: file.path, mode: "100644", type: "blob", sha: blobSha });
    }

    const treeResponse = await ghFetch("/repos/" + repoFullName + "/git/trees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries })
    });
    const treePayload = await treeResponse.json();

    const commitResponse = await ghFetch("/repos/" + repoFullName + "/git/commits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message,
            tree: treePayload.sha,
            parents: [parentCommitSha]
        })
    });
    const commitPayload = await commitResponse.json();

    await ghFetch("/repos/" + repoFullName + "/git/refs/heads/" + encodeURIComponent(branch), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha: commitPayload.sha, force: false })
    });

    return { commitSha: commitPayload.sha, fileBlobShas };
}

async function commitSelectedFiles() {
    if (!state.repo || !state.repoFullName) {
        setOutput("Connect to your GitHub repository before committing changes.", "error");
        return;
    }

    const selectedFiles = [...state.selectedKeys].map((key) => getFileRecord(key)).filter(Boolean);
    if (selectedFiles.length === 0) {
        setOutput("Select at least one file to commit.", "error");
        return;
    }

    const branch = state.repo.default_branch || "main";
    const commitMessage = (document.getElementById("commitMessage")?.value || "Update FC template data via manager").trim() || "Update FC template data via manager";

    const payloadFiles = [];
    for (const file of selectedFiles) {
        const draftValue = file.draftContent || JSON.stringify(file.json || createDefaultJsonForKey(file.key), null, 2);
        try {
            JSON.parse(draftValue);
        } catch (_error) {
            setOutput("Invalid JSON in " + file.label + ". Fix it before committing.", "error");
            state.activeKey = file.key;
            renderActiveEditor();
            return;
        }
        payloadFiles.push({ path: file.path, content: draftValue });
    }

    try {
        setStatusChip(elements.repoStatus, "Committing…", "warn");
        setOutput("Creating a single commit for " + payloadFiles.length + " FC template files…", "info");

        const result = await commitFilesTogether(state.repoFullName, branch, commitMessage, payloadFiles);
        const refreshed = [];
        for (const file of selectedFiles) {
            const response = await ghFetch("/repos/" + state.repoFullName + "/contents/" + file.path.replace(/^\//, ""));
            const payload = await response.json();
            const nextJson = parseJsonOrNull(decodeBase64Content(payload.content), createDefaultJsonForKey(file.key));
            file.sha = payload.sha;
            file.json = nextJson;
            file.draftContent = JSON.stringify(nextJson, null, 2);
            refreshed.push(file);
        }

        state.files = state.files.map((file) => {
            const refreshedMatch = refreshed.find((entry) => entry.key === file.key);
            return refreshedMatch || file;
        });

        persistLocalDrafts();
        renderFileList();
        renderActiveEditor();
        setStatusChip(elements.repoStatus, "Committed", "ok");
        setOutput("Committed " + refreshed.length + " file(s) in one GitHub commit. Commit SHA: " + (result.commitSha || "").slice(0, 10), "ok");
    } catch (error) {
        console.error(error);
        setStatusChip(elements.repoStatus, "Commit failed", "bad");
        setOutput(error.message || "Commit failed.", "error");
    }
}

function attachEventHandlers() {
    elements.connectBtn.addEventListener("click", connectRepository);
    elements.saveLocalBtn.addEventListener("click", () => {
        setCurrentDraftFromEditor();
        persistLocalDrafts();
        setOutput("Draft saved locally for this browser session.", "ok");
    });
    elements.commitBtn.addEventListener("click", commitSelectedFiles);

    elements.editorArea.addEventListener("input", () => {
        setCurrentDraftFromEditor();
        const file = getFileRecord(state.activeKey);
        if (file) {
            file.draftContent = elements.editorArea.value;
        }
    });

    elements.repoInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            connectRepository();
        }
    });
}

function init() {
    elements.fileList = document.getElementById("fileList");
    elements.editorTitle = document.getElementById("editorTitle");
    elements.editorArea = document.getElementById("editorArea");
    elements.output = document.getElementById("output");
    elements.repoStatus = document.getElementById("repoStatus");
    elements.branchStatus = document.getElementById("branchStatus");
    elements.connectBtn = document.getElementById("connectBtn");
    elements.saveLocalBtn = document.getElementById("saveLocalBtn");
    elements.commitBtn = document.getElementById("commitBtn");
    elements.repoInput = document.getElementById("repoInput");
    const commitMessageField = document.createElement("input");
    commitMessageField.id = "commitMessage";
    commitMessageField.type = "text";
    commitMessageField.value = "Update FC template data";
    commitMessageField.style.display = "none";
    document.body.appendChild(commitMessageField);
    elements.commitMessage = commitMessageField;

    attachEventHandlers();

    const storedAuth = readStoredAuthSession();
    if (storedAuth) {
        state.authSession = storedAuth;
        state.token = storedAuth.accessToken;
        setStatusChip(elements.repoStatus, "Session ready", "ok");
        setOutput("Saved GitHub session detected. Connect to reload the FC files.", "info");
    } else {
        setStatusChip(elements.repoStatus, "Not connected", "info");
        setOutput("Connect to GitHub to load and edit the FC template data files.", "info");
    }

    state.files = FC_MANAGER_CONFIG.files.map((fileMeta) => ({
        ...fileMeta,
        sha: "",
        json: createDefaultJsonForKey(fileMeta.key),
        draftContent: JSON.stringify(createDefaultJsonForKey(fileMeta.key), null, 2)
    }));

    renderFileList();
    renderActiveEditor();
}

document.addEventListener("DOMContentLoaded", init);
