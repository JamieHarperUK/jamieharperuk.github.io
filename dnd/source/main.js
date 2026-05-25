const pages = [
    "home", "media", "campaigns",
    "disclaimer", "404"
];

document.addEventListener('DOMContentLoaded', initializeRouting);
window.addEventListener('hashchange', handleRouteChange);

function initializeRouting() {
    handleRouteChange();
}

function handleRouteChange() {
    const hash = window.location.hash.slice(1) || 'home';
    const validPage = pages.includes(hash) ? hash : '404';
    
    pages.forEach(page => {
        const element = document.getElementById(`page-${page}`);
        if (element) {
            element.classList.remove('active');
        }
    });
    
    const activePage = document.getElementById(`page-${validPage}`);
    if (activePage) {
        activePage.classList.add('active');
    }
    
    document.querySelectorAll('nav.main-navigation a').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href && href.startsWith('#') && href.slice(1) === validPage) {
            link.classList.add('active');
        }
    });

    if (validPage === 'campaigns') {
        if (typeof renderCampaignList === 'function') {
            renderCampaignList();
        }
    }
}
