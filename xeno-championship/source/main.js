// Production flag - set to false to hide the construction banner
const SITE_UNDER_CONSTRUCTION = true;

// SPA Navigation with Hash Routing
document.addEventListener('DOMContentLoaded', function() {
    // Initialize construction banner
    initConstructionBanner();
    
    // Initialize mobile menu
    initMobileMenu();

    const navLinks = document.querySelectorAll('.nav-menu a');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            navigateToPage(targetId);
        });
    });

    // Handle footer links
    document.querySelectorAll('footer a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            navigateToPage(targetId);
        });
    });

    // Listen for hash changes
    window.addEventListener('hashchange', function() {
        const hash = window.location.hash.substring(1) || 'home';
        showPage(hash);
    });

    // Initial page load
    const initialHash = window.location.hash.substring(1) || 'home';
    showPage(initialHash);

    // Load data
    loadCurrentChampionship();
    populateHallOfFame();
    setupPastResultsSelector();
    populateXC2026();
});

function initConstructionBanner() {
    const banner = document.getElementById('construction-banner');
    const closeBtn = document.getElementById('banner-close');
    const header = document.querySelector('header');

    if (!SITE_UNDER_CONSTRUCTION) {
        banner.classList.add('hidden');
        header.classList.add('banner-hidden');
        return;
    }

    header.classList.add('banner-visible');

    closeBtn.addEventListener('click', function() {
        banner.classList.add('hidden');
        header.classList.remove('banner-visible');
        header.classList.add('banner-hidden');
        localStorage.setItem('bannerDismissed', 'true');
    });

    // Check if user has previously dismissed the banner
    if (localStorage.getItem('bannerDismissed') === 'true') {
        banner.classList.add('hidden');
        header.classList.remove('banner-visible');
        header.classList.add('banner-hidden');
    }
}

function initMobileMenu() {
    const hamburger = document.getElementById('hamburger-menu');
    const mobileModal = document.getElementById('mobile-menu-modal');
    const mobileLinks = document.querySelectorAll('.mobile-nav-menu a, .mobile-dropbtn');
    const mobileDropdowns = document.querySelectorAll('.mobile-dropdown');

    // Toggle menu on hamburger click
    hamburger.addEventListener('click', function() {
        hamburger.classList.toggle('active');
        mobileModal.classList.toggle('active');
    });

    // Close menu when a link is clicked
    mobileLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Check if it's a dropdown toggle
            if (this.classList.contains('mobile-dropbtn')) {
                const parent = this.parentElement;
                parent.classList.toggle('active');
                return;
            }
            // Otherwise close the menu
            hamburger.classList.remove('active');
            mobileModal.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('header') && !e.target.closest('.mobile-menu-modal')) {
            hamburger.classList.remove('active');
            mobileModal.classList.remove('active');
        }
    });
}

function navigateToPage(pageId) {
    window.location.hash = '#' + pageId;
    showPage(pageId);
}

function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
    });
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

async function loadCurrentChampionship() {
    const currentRecord = records.find(r => !r.past);
    if (!currentRecord || !currentRecord.resultsJson) return;

    try {
        const response = await fetch(currentRecord.resultsJson);
        const data = await response.json();
        populateHomePage(data, currentRecord);
    } catch (error) {
        console.error('Error loading current championship data:', error);
        populateHomePage(null, currentRecord);
    }
}

function populateHomePage(data, record) {
    const homePage = document.getElementById('page-home');
    homePage.innerHTML = `
        <!-- <h1>Welcome to the NMS Xeno Championship</h1> -->
        <div class="card hero-card">
            <img src="https://www.nomanssky.com/media/eohnnwwy/no-mans-sky-xeno-arena-screenshot-3-5mb.jpg" alt="Xeno Championship Image" class="home-hero-image">
        </div>
        <div class="card home-hero">
            <div class="home-content">
                <h2 class="para-h1">Discover Xeno Arena Battles</h2>
                <p style="margin-bottom: 1rem;" class="para-txt">Experience the thrill of competitive No Man's Sky gameplay! Watch epic 1v1 battles in the Xeno Arena, where players showcase their skills in intense, strategic combat.</p>
                <p class="para-txt">Whether you're a seasoned explorer or new to the universe, there's something for everyone. Learn about the championship, watch live streams, and join the community!</p>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button class="btn site-btn" onclick="navigateToPage('about')"><i class="fas fa-info-circle"></i> Learn More</button>
                    <button class="btn site-btn" onclick="navigateToPage('xc2026')"><i class="fas fa-trophy"></i> Current Championship</button>
                </div>
            </div>
            <div class="home-image">
                <i class="fas fa-rocket"></i>
            </div>
        </div>
        <div class="card">
            <h2 class="para-h1">Featured Content</h2>
            <ul class="para-ul" style="margin-bottom: 0px;">
                <li><strong><i class="fas fa-gamepad"></i> Xeno Arena Basics:</strong> Learn the fundamentals of competitive play</li>
                <li><strong><i class="fas fa-video"></i> Live Streams:</strong> Watch ongoing matches and tournaments</li>
                <li><strong><i class="fas fa-crown"></i> Hall of Fame:</strong> Celebrate past champions and their achievements</li>
                <li><strong><i class="fas fa-users"></i> Community:</strong> Connect with fellow explorers and players</li>
            </ul>
        </div>
        <div class="card">
            <h2 class="para-h1">Quick Links</h2>
            <p class="para-txt">Ready to dive in? Check out these popular sections:</p>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem;">
                <button class="btn site-btn" onclick="navigateToPage('rules')"><i class="fas fa-book"></i> Tournament Rules</button>
                <button class="btn site-btn" onclick="navigateToPage('hof')"><i class="fas fa-star"></i> Hall of Fame</button>
                <button class="btn site-btn" onclick="navigateToPage('results')"><i class="fas fa-history"></i> Past Results</button>
                <button class="btn site-btn" onclick="navigateToPage('contact')"><i class="fas fa-envelope"></i> Get Involved</button>
            </div>
        </div>
    `;
}

function populateHallOfFame() {
    const hofPage = document.getElementById('page-hof');
    const pastRecords = records.filter(r => r.past).slice().sort((a, b) => getRecordYear(b) - getRecordYear(a));

    hofPage.innerHTML = `
        <h1>Hall of Fame</h1>
        <p class="hof-subtitle para-txt">Only the champions make it here. Every year a single player wins the right to be immortalized in the Xeno Championship Hall of Fame.</p>
        <div class="hof-grid">
            ${pastRecords.map(record => `
                <div class="card hof-winner-card">
                    <div class="hof-year">${record.title}</div>
                    <div class="hof-winner-badge"><i class="fas fa-trophy" style="color: rgb(251 171 0);"></i></div>
                    <div class="hof-winner-name">${record.top3[0]}</div>
                    <div class="hof-winner-label">Champion</div>
                </div>
            `).join('')}
        </div>
    `;
}

function setupPastResultsSelector() {
    const resultsPage = document.getElementById('page-results');
    const pastRecords = records.filter(r => r.past);
    const sortedPastRecords = pastRecords.slice().sort((a, b) => getRecordYear(b) - getRecordYear(a));

    resultsPage.innerHTML = `
        <h1>Past Results</h1>
        <div class="card pr-search-card">
            <label for="past-select" class="pr-search-label">Select Championship</label>
            <select id="past-select" class="select pr-search-select">
                <option value="">Choose a championship...</option>
                ${sortedPastRecords.map((record, index) => `<option value="${index}">${record.title}</option>`).join('')}
            </select>
        </div>
        <div id="past-results"></div>
    `;

    const resultsDiv = document.getElementById('past-results');
    resultsDiv.innerHTML = renderAllPastRecords(sortedPastRecords);

    document.getElementById('past-select').addEventListener('change', function() {
        const index = this.value;
        if (index !== '') {
            showPastResults(sortedPastRecords[index]);
        } else {
            resultsDiv.innerHTML = renderAllPastRecords(sortedPastRecords);
        }
    });
}

function sortPlayersByStandings(players) {
    return players.slice().sort((a, b) => {
        const pointsA = Number(a.results.points ?? 0);
        const pointsB = Number(b.results.points ?? 0);
        if (pointsB !== pointsA) return pointsB - pointsA;

        const omwA = Number(a.results.omw ?? 0);
        const omwB = Number(b.results.omw ?? 0);
        if (omwB !== omwA) return omwB - omwA;

        const winsA = Number(a.results.wins ?? 0);
        const winsB = Number(b.results.wins ?? 0);
        if (winsB !== winsA) return winsB - winsA;

        return a.name.localeCompare(b.name);
    });
}

function togglePlayerDetails(index) {
    const card = document.getElementById(`player-card-${index}`);
    if (!card) return;
    card.classList.toggle('expanded');
    const summary = card.querySelector('.player-summary');
    if (summary) {
        summary.setAttribute('aria-expanded', card.classList.contains('expanded') ? 'true' : 'false');
    }
}

async function populateXC2026() {
    const currentRecord = records.find(r => !r.past);
    if (!currentRecord) return;

    const xc2026Page = document.getElementById('page-xc2026');

    let data = null;
    if (currentRecord.resultsJson) {
        try {
            const response = await fetch(currentRecord.resultsJson);
            data = await response.json();
        } catch (error) {
            console.error('Error loading XC 2026 data:', error);
        }
    }

    const registrationHtml = data ? renderRegistrationCard(data.metadata) : '';
    const standingsHtml = (!data || !data.players || data.players.length === 0) 
        ? '<div class="card" style="margin-bottom: 0px;"><p class="para-txt">No players registered yet. Check back soon!</p></div>'
        : (() => {
            const hasScores = data.players.some(p => p.results.points > 0 || p.results.played > 0);
            return `
                <div class="standings-accordion">
                    ${sortPlayersByStandings(data.players).map((player, index) => `
                        <div class="player-card" id="player-card-${index}">
                            <button class="player-summary" type="button" onclick="togglePlayerDetails(${index})" aria-expanded="false" style="grid-template-columns: ${hasScores ? 'auto 1fr auto' : '1fr auto'};">
                                ${hasScores ? `<span class="rank-badge">${index + 1}</span>` : ''}
                                <span class="player-title">
                                    <span class="player-name">${player.name}</span>
                                    <span class="player-platform">${player.platform}</span>
                                </span>
                                <span class="player-stats">
                                    <span class="points">${player.results.points} pts</span>
                                    <span class="omw">OMW ${player.results.omw ?? '—'}%</span>
                                </span>
                            </button>
                            <div class="player-details">
                                <div class="detail-row"><span>Played</span><span>${player.results.played}</span></div>
                                <div class="detail-row"><span>Wins</span><span>${player.results.wins}</span></div>
                                <div class="detail-row"><span>Losses</span><span>${player.results.losses}</span></div>
                                <div class="detail-row"><span>Forfeits</span><span>${player.results.forfeits ?? 0}</span></div>
                                ${player.results.omw !== undefined ? `<div class="detail-row"><span>OMW%</span><span>${player.results.omw}%</span></div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        })();

    xc2026Page.innerHTML = `
        <h1 style="margin-bottom: 0;">${currentRecord.title}</h1>
        <p class="para-txt" style="margin-top: 0; margin-bottom: 1rem; font-style: italic;">(${currentRecord.dates})</p>
        ${registrationHtml}
        <div class="card">
            <h2 class="para-h1">Current Standings</h2>
            ${standingsHtml}
        </div>
        <div class="card podium-card">
            <h2 class="para-h1">Championship Podium</h2>
            <div class="podium-grid">
                <div class="podium-item silver">
                    <span class="medal-badge">2</span>
                    <div>${currentRecord.top3[1]}</div>
                    <div class="podium-label">Silver</div>
                </div>
                <div class="podium-item gold">
                    <span class="medal-badge">1</span>
                    <div>${currentRecord.top3[0]}</div>
                    <div class="podium-label">Gold</div>
                </div>
                <div class="podium-item bronze">
                    <span class="medal-badge">3</span>
                    <div>${currentRecord.top3[2]}</div>
                    <div class="podium-label">Bronze</div>
                </div>
            </div>
        </div>
        <div class="card">
            <h2 class="para-h1">Tournament Information</h2>
            <p class="para-txt"><strong>Format:</strong> 1v1 Best-of-3 Xeno Arena matches</p>
            <p class="para-txt"><strong>Stages:</strong> Qualification Round → Top 8 Playoffs</p>
            <p class="para-txt"><strong>Schedule:</strong> Weekday fixtures in UK time (UTC+01:00)</p>
            <p class="para-txt"><strong>Streaming:</strong> All matches are streamed and monitored</p>
            <button class="btn site-btn" onclick="navigateToPage('rules')" style="margin-top: 1rem;">View Full Rules</button>
        </div>
    `;
}

function renderPodium(top3) {
    return `
        <div class="podium-grid">
            <div class="podium-item silver">
                <span class="medal-badge">2</span>
                <div class="para-txt">${top3[1]}</div>
                <div class="podium-label">Silver</div>
            </div>
            <div class="podium-item gold">
                <span class="medal-badge">1</span>
                <div class="para-txt">${top3[0]}</div>
                <div class="podium-label">Gold</div>
            </div>
            <div class="podium-item bronze">
                <span class="medal-badge">3</span>
                <div class="para-txt">${top3[2]}</div>
                <div class="podium-label">Bronze</div>
            </div>
        </div>
    `;
}

function renderRegistrationCard(metadata) {
    if (!metadata || !metadata.registration) return '';

    const registration = metadata.registration;
    const status = Number(registration.open);

    if (status === 3) return ''; // Tournament started, no card

    let statusText = '';
    let buttonHtml = '';
    let extraLine = '';

    switch (status) {
        case 0:
            statusText = 'Registration is not open yet. Check back soon for the sign-up window.';
            if (registration.opensOn) {
                extraLine = `<p class="para-txt"><strong>Opens:</strong> ${registration.opensOn}</p>`;
            }
            break;
        case 1:
            statusText = 'Registration is now open. Secure your place in the current tournament before slots fill up.';
            if (registration.formLink) {
                buttonHtml = `<a href="${registration.formLink}" class="btn registration-btn" target="_blank" rel="noopener">Register Now</a>`;
            }
            break;
        case 2:
            statusText = 'Registration is now closed. The tournament will begin soon!';
            break;
        default:
            return ''; // Invalid status, don't show card
    }

    return `
        <div class="card registration-card">
            <h2 class="para-h1">Registration</h2>
            <p class="para-txt">${statusText}</p>
            ${extraLine}
            ${buttonHtml}
        </div>
    `;
}

function getRecordYear(record) {
    const match = record.title.match(/(\d{4})/);
    return match ? Number(match[1]) : 0;
}

function renderAllPastRecords(records) {
    return records.map(record => `
        <div class="card">
            <h2 class="para-h1">${record.title}</h2>
            ${renderPodium(record.top3)}
        </div>
    `).join('');
}

async function showPastResults(record) {
    const resultsDiv = document.getElementById('past-results');
    resultsDiv.innerHTML = `
        <div class="card">
            <h2 class="para-h1">${record.title} Results</h2>
            ${record.resultsJson ? `
                <p class="para-txt">Loading data...</p>
            ` : `
                <p class="para-txt">No detailed results available for this championship.</p>
                ${renderPodium(record.top3)}
            `}
        </div>
    `;

    if (record.resultsJson) {
        try {
            const response = await fetch(record.resultsJson);
            const data = await response.json();
            resultsDiv.innerHTML = `
                <div class="card">
                    <h2>${record.title} Results</h2>
                    ${renderPodium(record.top3)}
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Platform</th>
                                <th>Played</th>
                                <th>Wins</th>
                                <th>Losses</th>
                                <th>Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.players.map(player => `
                                <tr>
                                    <td>${player.name}</td>
                                    <td>${player.platform}</td>
                                    <td>${player.results.played}</td>
                                    <td>${player.results.wins}</td>
                                    <td>${player.results.losses}</td>
                                    <td>${player.results.points}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Error loading past results:', error);
            resultsDiv.innerHTML = `
                <div class="card">
                    <h2>${record.title} Results</h2>
                    <p>Error loading data. Showing top 3 only.</p>
                    ${renderPodium(record.top3)}
                </div>
            `;
        }
    }
}
