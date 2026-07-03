const app = document.getElementById('app');

function slugify(value) {
    return value
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const booksBySlug = new Map(bookListings.map(book => [slugify(book.title), book]));

function renderHome() {
    document.title = "Jamie Harper's Bookshelf";
    const html = `
        <section class="intro-panel">
            <div>
                <p class="eyebrow" style="margin-top: 0;">Featured Titles</p>
                <h2>Browse the bookshelf</h2>
                <p style="margin-bottom: 0;">Click any cover to see details, links, and available interactive readers.</p>
            </div>
        </section>

        <section class="bookshelf-panel">
            <div class="shelf-bar"></div>
            <div class="book-grid">
                ${bookListings.map(book => {
                    const slug = slugify(book.title);
                    return `
                        <article class="book-card">
                            <a href="#book/${slug}" class="cover-link" aria-label="View details for ${book.title}">
                                <div class="cover-frame">
                                    <img src="${book.cover}" alt="Cover for ${book.title}" loading="lazy" />
                                </div>
                            </a>
                            <div class="book-copy">
                                <a href="#book/${slug}" class="book-title">${book.title}</a>
                                ${book.subtitle ? `<p class="book-subtitle">${book.subtitle}</p>` : ''}
                                <p class="book-author"><i class="fa-solid fa-user"></i> ${book.author}</p>
                            </div>
                        </article>`;
                }).join('')}
            </div>
        </section>`;

    app.innerHTML = html;
}

function renderBookDetail(book, slug) {
    document.title = `${book.title} · Jamie Harper's Bookshelf`;
    const heyzineLink = book.links.heyzine;
    const hasHeyzine = Boolean(heyzineLink);

    app.innerHTML = `
        <article class="detail-panel">
            <div class="detail-actions">
                <a href="#" class="back-link"><i class="fa-solid fa-arrow-left"></i> Back to bookshelf</a>
            </div>

            <div class="detail-grid">
                <div class="detail-cover">
                    <img src="${book.cover}" alt="Cover of ${book.title}" />
                </div>
                <div class="detail-copy">
                    <span class="eyebrow">${book.releaseDate ? `Released ${book.releaseDate}` : 'Book detail'}</span>
                    <h2>${book.title}</h2>
                    ${book.subtitle ? `<p class="subtitle">${book.subtitle}</p>` : ''}
                    <p class="book-author"><i class="fa-solid fa-user"></i> ${book.author}</p>
                    <div class="book-description">${book.description}</div>

                    <div class="link-panel">
                        ${book.links.wattpad ? `<a href="${book.links.wattpad}" target="_blank" rel="noopener" class="button button-secondary"><img src="data/images/white_wattpad.png" alt="Wattpad" style="width: 25px; height: 25px;"> Wattpad</a>` : ''}
                        ${book.links.ao3 ? `<a href="${book.links.ao3}" target="_blank" rel="noopener" class="button button-secondary"><img src="data/images/white_ao3.png" alt="Archive of Our Own" style="width: 25px; height: 25px;"> Archive of Our Own</a>` : ''}
                        ${hasHeyzine ? `<a href="${heyzineLink}" target="_blank" rel="noopener" class="button button-primary"><img src="data/images/white_book.png" alt="Heyzine" style="width: 25px; height: 25px;"> Open Heyzine</a>` : ''}
                    </div>
                </div>
            </div>

            ${hasHeyzine ? `
                <section class="embed-panel">
                    <div class="embed-header">
                        <h3>Interactive Reader</h3>
                    </div>
                    <div class="embed-frame">
                        <iframe
                            src="${heyzineLink}"
                            title="Heyzine viewer for ${book.title}"
                            allowfullscreen
                            allow="autoplay; fullscreen; clipboard-write"
                            scrolling="no"
                        ></iframe>
                    </div>
                </section>` : ''}
        </article>`;
}

function renderNotFound() {
    document.title = "Title not found · Bookshelf";
    app.innerHTML = `
        <section class="empty-state">
            <h2>Book not found</h2>
            <p>The requested title is not available. Return to the bookshelf to browse available listings.</p>
            <a href="#" class="button button-primary"><i class="fa-solid fa-house"></i> Home</a>
        </section>`;
}

function resolveRoute() {
    const hash = window.location.hash.slice(1);
    if (!hash || hash === 'home') {
        renderHome();
        return;
    }

    const [segment, slug] = hash.split('/');
    if (segment === 'book' && slug) {
        const book = booksBySlug.get(slug);
        if (book) {
            renderBookDetail(book, slug);
            return;
        }
    }

    renderNotFound();
}

window.addEventListener('hashchange', resolveRoute);
window.addEventListener('DOMContentLoaded', resolveRoute);
