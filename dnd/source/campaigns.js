const campaignJournals = [
    {
        title: "Upcoming Campaign",
        description: "",
        character: {
            name: "Ander Grimshaw",
            class: "Warlock",
            level: 3,
            image: "https://jamieharperuk.github.io/dnd/source/images/ander_grimshaw.jpg"
        },
        dates: {
            started: ["--/--/----", "--:--"],
            updated: ["--/--/----", "--:--"],
            completed: ["--/--/----", "--:--"]
        },
        entries: []
    }
];

function formatDate([date, time]) {
    return `${date} · ${time}`;
}

function renderCampaignList() {
    const listContainer = document.querySelector('.campaign-list');
    const detailsContainer = document.getElementById('campaign-data');

    if (!listContainer || !detailsContainer) {
        return;
    }

    listContainer.innerHTML = '';
    campaignJournals.forEach((campaign, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'campaign-item';
        item.innerHTML = `
            <div class="campaign-item-title">${campaign.title}</div>
            <div class="campaign-item-meta">${campaign.dates.started[0]} · ${campaign.character.class}</div>
        `;
        item.addEventListener('click', () => showCampaign(index));
        listContainer.appendChild(item);
    });

    if (campaignJournals.length) {
        showCampaign(0);
    } else {
        detailsContainer.innerHTML = '<div class="error">No campaigns available.</div>';
    }
}

function showCampaign(index) {
    const detailsContainer = document.getElementById('campaign-data');
    const listItems = document.querySelectorAll('.campaign-item');
    const campaign = campaignJournals[index];

    if (!campaign || !detailsContainer) {
        return;
    }

    listItems.forEach((item, itemIndex) => {
        item.classList.toggle('active', itemIndex === index);
    });

    let characterImage = '';
    if (campaign.character.image !== "#") {
        characterImage = `<img src="${campaign.character.image}" alt="${campaign.character.name}" class="campaign-portrait">`;
    }

    detailsContainer.innerHTML = `
        <div class="campaign-header">
            <div class="campaign-portrait">${characterImage}</div>
            <div>
                <h2>${campaign.title}</h2>
                <p class="campaign-description">${campaign.description}</p>
                <div class="campaign-meta">
                    <span><strong>Character:</strong> ${campaign.character.name}</span><br>
                    <span><strong>Class:</strong> ${campaign.character.class}</span>&nbsp;&nbsp;&nbsp;&nbsp;<span><strong>Level:</strong> ${campaign.character.level}</span>
                </div>
                <hr style="border: 1px solid var(--accent);">
                <div class="campaign-dates" style="display: flex; gap: 1rem; justify-content: space-between;">
                    <span><strong>Started:</strong><br>${formatDate(campaign.dates.started)}</span>
                    <span><strong>Updated:</strong><br>${formatDate(campaign.dates.updated)}</span>
                </div>
            </div>
        </div>
        <div class="journal-entries">
            ${campaign.entries.map(entry => `
                <article class="journal-entry">
                    <div class="entry-title">${entry.title}</div>
                    <div class="entry-date">${formatDate(entry.date)}</div>
                    ${entry.paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('')}
                </article>
            `).join('')}
        </div>
    `;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCampaignList);
} else {
    renderCampaignList();
}
