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
        <h1>Welcome to the NMS Xeno Championship</h1>
        <div class="card">
            <h2>Discover Xeno Arena Battles</h2>
            <p>Experience the thrill of competitive No Man's Sky gameplay! Watch epic 1v1 battles in the Xeno Arena, where players showcase their skills in intense, strategic combat.</p>
            <p>Whether you're a seasoned explorer or new to the universe, there's something for everyone. Learn about the championship, watch live streams, and join the community!</p>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn" onclick="navigateToPage('about')">Learn More</button>
                <button class="btn" onclick="navigateToPage('xc2026')">View Current Championship</button>
            </div>
        </div>
        <div class="card">
            <h2>Featured Content</h2>
            <ul>
                <li><strong>Xeno Arena Basics:</strong> Learn the fundamentals of competitive play</li>
                <li><strong>Live Streams:</strong> Watch ongoing matches and tournaments</li>
                <li><strong>Hall of Fame:</strong> Celebrate past champions and their achievements</li>
                <li><strong>Community:</strong> Connect with fellow explorers and players</li>
            </ul>
        </div>
        <div class="card">
            <h2>Quick Links</h2>
            <p>Ready to dive in? Check out these popular sections:</p>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button class="btn" onclick="navigateToPage('rules')">Tournament Rules</button>
                <button class="btn" onclick="navigateToPage('hof')">Hall of Fame</button>
                <button class="btn" onclick="navigateToPage('media')">Past Results</button>
                <button class="btn" onclick="navigateToPage('contact')">Get Involved</button>
            </div>
        </div>
    `;
}

function populateHallOfFame() {
    const hofPage = document.getElementById('page-hof');
    const pastRecords = records.filter(r => r.past);

    hofPage.innerHTML = `
        <h1>Hall of Fame</h1>
        ${pastRecords.map(record => `
            <div class="card">
                <h2>${record.title}</h2>
                <ol>
                    <li>${record.top3[0]} (Gold)</li>
                    <li>${record.top3[1]} (Silver)</li>
                    <li>${record.top3[2]} (Bronze)</li>
                </ol>
            </div>
        `).join('')}
    `;
}

function setupPastResultsSelector() {
    const mediaPage = document.getElementById('page-media');
    const pastRecords = records.filter(r => r.past);

    mediaPage.innerHTML = `
        <h1>Past Results</h1>
        <div class="card">
            <label for="past-select">Select Championship:</label>
            <select id="past-select" class="select">
                <option value="">Choose a championship...</option>
                ${pastRecords.map((record, index) => `<option value="${index}">${record.title}</option>`).join('')}
            </select>
        </div>
        <div id="past-results"></div>
    `;

    document.getElementById('past-select').addEventListener('change', function() {
        const index = this.value;
        if (index !== '') {
            showPastResults(pastRecords[index]);
        } else {
            document.getElementById('past-results').innerHTML = '';
        }
    });
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

    xc2026Page.innerHTML = `
        <h1>${currentRecord.title}</h1>
        <div class="card">
            <h2>Current Standings</h2>
            ${data ? `
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
            ` : '<p>Registration is now open! Standings will be updated as matches begin.</p>'}
        </div>
        <div class="card">
            <h2>Championship Podium</h2>
            <ol>
                <li>${currentRecord.top3[0]} (Gold)</li>
                <li>${currentRecord.top3[1]} (Silver)</li>
                <li>${currentRecord.top3[2]} (Bronze)</li>
            </ol>
        </div>
        <div class="card">
            <h2>Tournament Information</h2>
            <p><strong>Format:</strong> 1v1 Best-of-3 Xeno Arena matches</p>
            <p><strong>Stages:</strong> Qualification Round → Top 8 Playoffs</p>
            <p><strong>Schedule:</strong> Weekday fixtures in UK time (UTC+00:00)</p>
            <p><strong>Streaming:</strong> All matches are streamed and monitored</p>
            <button class="btn" onclick="navigateToPage('rules')">View Full Rules</button>
        </div>
    `;
}

async function showPastResults(record) {
    const resultsDiv = document.getElementById('past-results');
    resultsDiv.innerHTML = `
        <div class="card">
            <h2>${record.title} Results</h2>
            ${record.resultsJson ? `
                <p>Loading data...</p>
            ` : `
                <p>No detailed results available for this championship.</p>
                <h3>Top 3:</h3>
                <ol>
                    <li>${record.top3[0]} (Gold)</li>
                    <li>${record.top3[1]} (Silver)</li>
                    <li>${record.top3[2]} (Bronze)</li>
                </ol>
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
                    <ol>
                        <li>${record.top3[0]} (Gold)</li>
                        <li>${record.top3[1]} (Silver)</li>
                        <li>${record.top3[2]} (Bronze)</li>
                    </ol>
                </div>
            `;
        }
    }
}
