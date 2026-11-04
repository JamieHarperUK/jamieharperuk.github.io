// Site configuration for SewerMaxxing
const site_config = {
    site_title: "SewerMaxxing Guide Book",
    site_description: "A comprehensive guide to maximizing your success while SewerMaxxing in the Varrock Sewers of RuneScape.",
    site_author: "Jamie Harper",
    site_url: "https://jhuk.co.uk/sewermaxxing/",
    site_language: "en",
};


// Site Data Loading
const data_source = site_config.site_url+"data/";
const rs_data = {
    OSRS: {
        title: "Old School RuneScape",
        url: "https://oldschool.runescape.com/",
        guide_data: data_source+"osrs.json",
        drops_data: data_source+"osrs_drops.json"
    },
    RS3: {
        title: "RuneScape 3",
        url: "https://www.runescape.com/",
        guide_data: data_source+"rs3.json",
        drops_data: data_source+"rs3_drops.json"
    }
};
const rs_account_types = [
    "Normal", 
    "Ironman", 
    "Hardcore Ironman", 
    "Ultimate Ironman", 
    "Group Ironman"
];
const rs_account_tiers = [
    "Free To Play",
    "Member"
];
const featured_sewermaxxers = data_source+"accounts.json";


// Site Pages (# routed)
const site_pages = [
    ["home", "Home"], // A brief overview of SewerMaxxing
    ["rs3", "RuneScape"], // The RS3 SewerMaxxing Guide
    ["osrs", "Old School RuneScape"], // The OSRS SewerMaxxing Guide
    ["disclaimer", "Disclaimer"] // Disclaimer page stating no official affiliation or support from or by Jagex
    // Additional custom page routing needed for a 'Featured Accounts' page, as well as subsequent dedicated pages for each account when clicked.
];


// Initialize the site
function loadSiteData() {
    // Load the site data for both OSRS and RS3
};

document.addEventListener("DOMContentLoaded", function() {
    loadSiteData();
});
