// Hash-based routing system to navigate between different pages and views (here)
const pages = ["home", "characters", "ships", "companion", "about"];
function showPage(page) {
    pages.forEach(p => {
        document.getElementById(`page-${p}`).style.display = (p === page) ? "block" : "none";
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${page}`);
    });
}
function handleHash() {
    const hash = location.hash.replace('#', '').toLowerCase();
    if (pages.includes(hash)) {
        showPage(hash);
    } else {
        showPage("home");
    }
}
window.addEventListener('hashchange', handleHash);
document.addEventListener('DOMContentLoaded', () => {
    handleHash();
    initializeApp();
});

// --- Dynamic Data Loading and Page Population ---
const configUrl = "source/config.json";
let configData = null;
let characterData = {};
let shipData = {};

async function initializeApp() {
    try {
        // Load config.json
        const configResp = await fetch(configUrl);
        configData = await configResp.json();

        // Load all campaigns
        let campaignData = {};
        if (Array.isArray(configData.campaigns)) {
            await Promise.all(configData.campaigns.map(async (filename) => {
                const url = `source/campaigns/${filename}`;
                const resp = await fetch(url);
                if (resp.ok) {
                    campaignData[filename] = await resp.json();
                }
            }));
        }

        // Load all characters
        if (Array.isArray(configData.characters)) {
            await Promise.all(configData.characters.map(async (filename) => {
                const url = `source/campaigns/characters/${filename}`;
                const resp = await fetch(url);
                if (resp.ok) {
                    characterData[filename] = await resp.json();
                }
            }));
        }

        // Load all ships
        if (Array.isArray(configData.ships)) {
            await Promise.all(configData.ships.map(async (filename) => {
                const url = `source/campaigns/ships/${filename}`;
                const resp = await fetch(url);
                if (resp.ok) {
                    shipData[filename] = await resp.json();
                }
            }));
        }

        populateCampaignsPage(campaignData);
        populateCharactersPage();
        populateShipsPage();
    } catch (e) {
        document.getElementById('campaignsContainer').innerHTML = '<p class="error">Failed to load campaign data.</p>';
        document.getElementById('charactersContainer').innerHTML = '<p class="error">Failed to load character data.</p>';
        document.getElementById('shipsContainer').innerHTML = '<p class="error">Failed to load ship data.</p>';
    }
}

function populateCampaignsPage(campaignData) {
    const container = document.getElementById('campaignsContainer');
    if (!configData || !configData.campaigns || Object.keys(campaignData).length === 0) {
        container.innerHTML = '<p>No campaign data found.</p>';
        return;
    }
    container.innerHTML = '';
    configData.campaigns.forEach(filename => {
        const camp = campaignData[filename];
        if (!camp) return;
        const div = document.createElement('div');
        div.className = 'campaign-card';
        // Render summary as paragraphs, and logs if present
        let summaryHtml = '';
        if (Array.isArray(camp.summary) && camp.summary.length > 0) {
            summaryHtml = camp.summary.filter(s => s && s.trim()).map(s => `<p class="campaign-summary">${s}</p>`).join('');
        } else {
            summaryHtml = '<p class="campaign-summary"><em>No summary available.</em></p>';
        }

        let logsHtml = '';
        if (Array.isArray(camp.logs) && camp.logs.length > 0) {
            logsHtml = `<div class="campaign-logs">
                    <details>
                        <summary>Logs</summary>
                        ${camp.logs.map(log => `
                            <details class="log-details">
                                <summary><span class="log-stardate">Stardate: ${log.stardate || ''}</span> &mdash; <span class="log-crew">${log.crewMember || ''}</span></summary>
                                <div class="log-entry">${log.logEntry || ''}</div>
                            </details>
                        `).join('')}
                    </details>
                </div>`;
        }

        div.innerHTML = `
                <h3>${camp.campaignName || filename}</h3>
                <p><strong>Type:</strong> ${camp.campaignType || ''}</p>
                <p><strong>Location:</strong> ${camp.information?.location || ''}</p>
                <p><strong>Mission:</strong> ${camp.information?.mission || ''}</p>
                <p><strong>Outcome:</strong> ${camp.information?.outcome || ''}</p>
                <p><strong>Stardate:</strong> ${camp.information?.startStardate || ''} - ${camp.information?.endStardate || ''}</p>
                <details><summary>Character(s)</summary>
                    <ul>
                        ${(camp.characters || []).map(charFile => {
            const char = characterData[charFile];
            return char ? `<li>${char.name} <small>(${char.rank})</small></li>` : `<li>${charFile}</li>`;
        }).join('')}
                    </ul>
                </details>
                <details><summary>Ship</summary>
                    <ul>
                        <li>${shipData[camp.ship]?.name || camp.ship || ''}</li>
                    </ul>
                </details>
                <details open><summary>Summary</summary>
                    ${summaryHtml}
                </details>
                ${logsHtml}
            `;
        container.appendChild(div);
    });
}

function populateCharactersPage() {
    const container = document.getElementById('charactersContainer');
    if (!configData || !configData.characters || Object.keys(characterData).length === 0) {
        container.innerHTML = '<p>No character data found.</p>';
        return;
    }
    container.innerHTML = '';
    configData.characters.forEach(filename => {
        const char = characterData[filename];
        if (!char) return;
        const div = document.createElement('div');
        div.className = 'character-card';
        div.innerHTML = `
            <h3>${char.name} <small>(${char.rank})</small></h3>
            <p><strong>Role:</strong> ${char.characterRole || ''}</p>
            <p><strong>Assignment:</strong> ${char.assignment || ''}</p>
            <p><strong>Species:</strong> ${char.speciesTraits || ''}</p>
            <p><strong>Reputation:</strong> ${char.reputation ?? ''}</p>
            <details><summary>Attributes</summary>
                <ul>
                    ${Object.entries(char.attributes || {}).map(([k, v]) => `<li><strong>${capitalize(k)}:</strong> ${v}</li>`).join('')}
                </ul>
            </details>
            <details><summary>Departments</summary>
                <ul>
                    ${Object.entries(char.departments || {}).map(([k, v]) => `<li><strong>${capitalize(k)}:</strong> ${v}</li>`).join('')}
                </ul>
            </details>
            <details><summary>Values</summary>
                <ul>${(char.values || []).map(v => `<li>${v}</li>`).join('')}</ul>
            </details>
            <details><summary>Focuses</summary>
                <ul>${(char.focuses || []).map(f => `<li>${f}</li>`).join('')}</ul>
            </details>
            <details><summary>Talents</summary>
                <ul>${(char.talents || []).map(t => `<li>${t}</li>`).join('')}</ul>
            </details>
            <details><summary>Equipment</summary>
                <ul>${(char.equipment || []).map(e => `<li>${e}</li>`).join('')}</ul>
            </details>
        `;
        container.appendChild(div);
    });
}

function populateShipsPage() {
    const container = document.getElementById('shipsContainer');
    if (!configData || !configData.ships || Object.keys(shipData).length === 0) {
        container.innerHTML = '<p>No ship data found.</p>';
        return;
    }
    container.innerHTML = '';
    configData.ships.forEach(filename => {
        const ship = shipData[filename];
        if (!ship) return;
        const div = document.createElement('div');
        div.className = 'ship-card';
        div.innerHTML = `
            <h3>${ship.name} <small>(${ship.registry})</small></h3>
            <p><strong>Class:</strong> ${ship.shipClass || ''}</p>
            <p><strong>Mission Profile:</strong> ${ship.missionProfile || ''}</p>
            <p><strong>Traits:</strong> ${ship.traits || ''}</p>
            <details><summary>Core Stats</summary>
                <ul>
                    ${Object.entries(ship.coreStats || {}).map(([k, v]) => `<li><strong>${capitalize(k)}:</strong> ${v}</li>`).join('')}
                    ${ship.shields ? `<li><strong>Shields:</strong> ${ship.shields}</li>` : ''}
                </ul>
            </details>
            <details><summary>Shuttlebay</summary>
                <ul>${(ship.shuttleBay || []).map(s => `<li>${s}</li>`).join('') || `<li><i>None</i></li>`}</ul>
            </details>
            <details><summary>Systems</summary>
                <ul>
                    ${Object.entries(ship.systems || {}).map(([k, v]) => `<li><strong>${capitalize(k)}:</strong> ${v}</li>`).join('')}
                </ul>
            </details>
            <details><summary>Departments</summary>
                <ul>
                    ${Object.entries(ship.departments || {}).map(([k, v]) => `<li><strong>${capitalize(k)}:</strong> ${v}</li>`).join('')}
                </ul>
            </details>
            <details><summary>Talents</summary>
                <ul>${(ship.talents || []).map(t => `<li><strong>${t.name}:</strong> ${t.details}</li>`).join('')}</ul>
            </details>
            <details><summary>Special Rules</summary>
                <ul>${(ship.specialRules || []).map(r => `<li><strong>${r.name}:</strong> ${r.details}</li>`).join('')}</ul>
            </details>
        `;
        container.appendChild(div);
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Modal menu logic
const menuBtn = document.getElementById('menuBtn');
const modalMenu = document.getElementById('modalMenu');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const modalLinks = document.querySelectorAll('.modal-link');
menuBtn.addEventListener('click', () => {
    modalMenu.classList.add('open');
});
closeMenuBtn.addEventListener('click', () => {
    modalMenu.classList.remove('open');
});
modalLinks.forEach(link => link.addEventListener('click', () => {
    modalMenu.classList.remove('open');
}));

// Hide menu button on desktop, show on mobile
function handleMenuBtnDisplay() {
    if (window.innerWidth <= 700) {
        menuBtn.style.display = 'inline-block';
    } else {
        menuBtn.style.display = 'none';
        modalMenu.classList.remove('open');
    }
}
window.addEventListener('resize', handleMenuBtnDisplay);
document.addEventListener('DOMContentLoaded', handleMenuBtnDisplay);

// Companion page logic
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
let momentum = 0, threat = 0;
const momentumValue = document.getElementById('momentumValue');
const threatValue = document.getElementById('threatValue');
const notesArea = document.getElementById('companionNotes');
// Load from localStorage if available
function loadCompanionFromStorage() {
    momentum = parseInt(localStorage.getItem('staCompanionMomentum')) || 0;
    threat = parseInt(localStorage.getItem('staCompanionThreat')) || 0;
    momentumValue.textContent = momentum;
    threatValue.textContent = threat;
    notesArea.value = localStorage.getItem('staCompanionNotes') || '';
}
loadCompanionFromStorage();
document.getElementById('momentumInc').onclick = () => {
    momentum = clamp(momentum + 1, 0, 6);
    momentumValue.textContent = momentum;
    localStorage.setItem('staCompanionMomentum', momentum);
};
document.getElementById('momentumDec').onclick = () => {
    momentum = clamp(momentum - 1, 0, 6);
    momentumValue.textContent = momentum;
    localStorage.setItem('staCompanionMomentum', momentum);
};
document.getElementById('threatInc').onclick = () => {
    threat = clamp(threat + 1, 0, 20);
    threatValue.textContent = threat;
    localStorage.setItem('staCompanionThreat', threat);
};
document.getElementById('threatDec').onclick = () => {
    threat = clamp(threat - 1, 0, 20);
    threatValue.textContent = threat;
    localStorage.setItem('staCompanionThreat', threat);
};
// Persist notes in localStorage
notesArea.addEventListener('input', () => {
    localStorage.setItem('staCompanionNotes', notesArea.value);
});

// Export/Import functionality
document.getElementById('exportCompanion').onclick = () => {
    const data = {
        momentum,
        threat,
        notes: notesArea.value
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sta-companion-settings.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
};
document.getElementById('importCompanion').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (typeof data.momentum === 'number') {
                momentum = clamp(data.momentum, 0, 6);
                momentumValue.textContent = momentum;
                localStorage.setItem('staCompanionMomentum', momentum);
            }
            if (typeof data.threat === 'number') {
                threat = clamp(data.threat, 0, 20);
                threatValue.textContent = threat;
                localStorage.setItem('staCompanionThreat', threat);
            }
            if (typeof data.notes === 'string') {
                notesArea.value = data.notes;
                localStorage.setItem('staCompanionNotes', data.notes);
            }
            alert('Companion settings loaded!');
        } catch (err) {
            alert('Failed to load settings: Invalid file format.');
        }
    };
    reader.readAsText(file);
    // Reset file input so same file can be loaded again if needed
    e.target.value = '';
});
// Reset functionality
document.getElementById('resetCompanion').onclick = () => {
    if (confirm('Reset all companion fields? This will clear Momentum, Threat, and Notes.')) {
        momentum = 0;
        threat = 0;
        momentumValue.textContent = momentum;
        threatValue.textContent = threat;
        notesArea.value = '';
        localStorage.setItem('staCompanionMomentum', momentum);
        localStorage.setItem('staCompanionThreat', threat);
        localStorage.setItem('staCompanionNotes', '');
    }
};
