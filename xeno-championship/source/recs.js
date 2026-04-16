const dataHostUrl = "https://jamieharperuk.github.io/xeno-championship/source/data/";

const records = [
    {
        title: "XC 2026", past: false, // If current or upcoming, set past to false
        top3: ["TBA", "TBA", "TBA"], // 1st (Gold), 2nd (Silver), 3rd (Bronze)
        resultsJson: dataHostUrl+"xc26.json"
    },
    {
        title: "XC 2025", past: true,
        top3: ["Placeholder Winner", "Placeholder 2nd", "Placeholder 3rd"],
        resultsJson: null // No data available
    }
];
