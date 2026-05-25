const characterProfiles = {
    "Ander Grimshaw": {
        name: "Ander Grimshaw",
        class: "Warlock",
        image: "https://jamieharperuk.github.io/dnd/source/images/ander_grimshaw.jpg",
        dndBeyondLink: "https://www.dndbeyond.com/characters/165875968/o65yeI",
        backstory: [
            "Ander started his career as a regular bounty hunter. He followed the code of Tempus and fought honourably, relying on his physical weapons, never backing down from a challenge, and often viewing combat as an art form.",
            "While tracking a highly dangerous target into the frozen wastes outside Luskan, the job went horribly wrong. The target trapped Ander inside ancient and forgotten ruins, leaving him for dead. Bleeding out, facing a dishonourable death in the dark, he prayed to Tempus for the strength to stand and fight.",
            "Though his prayer was sincere, Tempus does not grant magical pacts, but something else was listening within those ruins. An ancient power instead answered Ander's plea. It offered him the power to not only survive, but inflict revenge upon his enemies.",
            "The price asked for such power seemed minimal, one day this ancient power would give him a task, but his refusal would cost him his life. Until that time his life would be his own. Having nothing to lose he accepted the terms, initially believing it was a blessing from his deity, only to realise too late that he had bound his soul to the otherworldly undead power of a Lich.",
            "The ensuing hunt for revenge claimed the life of the previously 'highly dangerous' target that had trapped him. Ander then set off to travel the lands in search of new purpose, all the while choosing to channel this forbidden magic for both personal gain and helping others when he could.",
            "After all, there was no knowing when his patron would set him to work, or what the task would be."
        ]
    }
};

const campaignJournals = [
    {
        title: "Upcoming Campaign",
        description: "A new adventure is coming here soon.",
        character: {
            id: "Ander Grimshaw",
            level: 3,
            abilityScores: {
                strength: [14, "+2"],
                dexterity: [14, "+2"],
                constitution: [13, "+1"],
                intelligence: [10, "+0"],
                wisdom: [8, "-1"],
                charisma: [17, "+3"]
            }
        },
        dates: {
            started: ["TBD"],
            updated: ["TBD"],
            completed: ["TBD"]
        },
        entries: []
    }
];

function formatDate([date, time]) {
    return `${date} · ${time}`;
}

function getCharacterProfile(campaign) {
    const profile = characterProfiles[campaign.character.id] || {};
    return {
        name: profile.name || campaign.character.id || 'Unknown',
        class: profile.class || campaign.character.class || 'Unknown',
        image: profile.image || campaign.character.image || '#',
        backstory: profile.backstory || [],
        level: campaign.character.level || '—',
        abilityScores: campaign.character.abilityScores || profile.abilityScores || {},
        dndBeyondLink: profile.dndBeyondLink || campaign.character.dndBeyondLink || '#'
    };
}

function renderCampaignList() {
    const listContainer = document.querySelector('.campaign-list');
    const detailsContainer = document.getElementById('campaign-data');

    if (!listContainer || !detailsContainer) {
        return;
    }

    listContainer.innerHTML = '';
    campaignJournals.forEach((campaign, index) => {
        const profile = getCharacterProfile(campaign);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'campaign-item';
        item.innerHTML = `
            <div class="campaign-item-title">${campaign.title}</div>
            <div class="campaign-item-meta">${campaign.dates.started[0]} · ${profile.class}</div>
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
    const profile = getCharacterProfile(campaign);

    if (!campaign || !detailsContainer) {
        return;
    }

    listItems.forEach((item, itemIndex) => {
        item.classList.toggle('active', itemIndex === index);
    });

    let characterMarkup = profile.image && profile.image !== '#' ? `<img src="${profile.image}" alt="${profile.name}" class="campaign-portrait">` : profile.name;

    detailsContainer.innerHTML = `
        <div class="campaign-header">
            <div class="campaign-portrait">${characterMarkup}</div>
            <div>
                <h2>${campaign.title}</h2>
                <p class="campaign-description">${campaign.description}</p>
                <div class="campaign-meta">
                    <span><strong>Character:</strong> ${profile.name}</span><br>
                    <span><strong>Class:</strong> ${profile.class}</span>&nbsp;&nbsp;&nbsp;&nbsp;<span><strong>Level:</strong> ${profile.level}</span>
                </div>
                <div class="campaign-btn-group">
                    <button type="button" class="view-bio-button" data-campaign-index="${index}">View Character Bio</button>
                    <a href="${profile.dndBeyondLink}" class="dnd-beyond-link" target="_blank" rel="noopener noreferrer">D&D Character Sheet</a>
                </div>
                <hr style="border: 1px solid var(--accent); margin: 1rem 0;">
                <div class="campaign-dates" style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: space-between;">
                    <span style="text-align: center;"><strong>Started</strong><br>${campaign.dates.started}</span>
                    <span style="text-align: center;"><strong>Last Updated</strong><br>${campaign.dates.updated}</span>
                    <span style="text-align: center;"><strong>Completed</strong><br>${campaign.dates.completed}</span>
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

    document.querySelector('.view-bio-button')?.addEventListener('click', () => openCharacterModal(profile));
}

function openCharacterModal(profile) {
    const modalOverlay = document.getElementById('character-modal');
    const modalContent = document.getElementById('character-modal-content');

    if (!modalOverlay || !modalContent) {
        return;
    }

    modalContent.innerHTML = `
        <h2 class="character-modal-title">${profile.name}</h2>
        <p class="character-modal-subtitle">${profile.class} · Level ${profile.level}</p>
        ${profile.image && profile.image !== '#' ? `<img class="modal-character-img" src="${profile.image}" alt="${profile.name}">` : ''}
        <div class="character-modal-body">
            <div class="campaign-meta">
                <div class="campaign-meta-title">Ability Scores:</div>
                <div class="campaign-meta-ac-box">
                    <span><strong>Strength:</strong> ${profile.abilityScores.strength ? profile.abilityScores.strength.join(' (') : '—'})</span>
                    <span><strong>Dexterity:</strong> ${profile.abilityScores.dexterity ? profile.abilityScores.dexterity.join(' (') : '—'})</span>
                    <span><strong>Constitution:</strong> ${profile.abilityScores.constitution ? profile.abilityScores.constitution.join(' (') : '—'})</span>
                    <span><strong>Intelligence:</strong> ${profile.abilityScores.intelligence ? profile.abilityScores.intelligence.join(' (') : '—'})</span>
                    <span><strong>Wisdom:</strong> ${profile.abilityScores.wisdom ? profile.abilityScores.wisdom.join(' (') : '—'})</span>
                    <span><strong>Charisma:</strong> ${profile.abilityScores.charisma ? profile.abilityScores.charisma.join(' (') : '—'})</span>
                </div>
            </div>
            <hr style="border: 0.5px dashed #5d4b36; margin: 0;">
            ${profile.backstory.map(paragraph => `<p>${paragraph}</p>`).join('')}
        </div>
    `;

    modalOverlay.classList.add('active');
    modalOverlay.setAttribute('aria-hidden', 'false');
}

function closeCharacterModal() {
    const modalOverlay = document.getElementById('character-modal');
    if (!modalOverlay) {
        return;
    }
    modalOverlay.classList.remove('active');
    modalOverlay.setAttribute('aria-hidden', 'true');
}

function attachModalListeners() {
    const modalOverlay = document.getElementById('character-modal');
    const modalClose = document.getElementById('character-modal-close');

    if (!modalOverlay || !modalClose) {
        return;
    }

    modalClose.addEventListener('click', closeCharacterModal);
    modalOverlay.addEventListener('click', event => {
        if (event.target === modalOverlay) {
            closeCharacterModal();
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeCharacterModal();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        renderCampaignList();
        attachModalListeners();
    });
} else {
    renderCampaignList();
    attachModalListeners();
}
