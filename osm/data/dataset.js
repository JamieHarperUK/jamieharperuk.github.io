// Data For OSM Teams I Manage
const teams = {
    "e2d_manchester_united": {
        "name": "Manchester United", // Team name
        "league": "England 2nd Division", // League name
        "stage": "Pre-Season", // Current stage in the league
        "position": 14,
        "points": 0,
        "matches_played": 0,
        "wins": 0,
        "draws": 0,
        "losses": 0,
        "squad_value": 228, // (millions)
        "squad_count": 24,
        "squad": [
            // Shirt Number - Name - Age - Position - Nationality - Value (in millions) - Cards Count (Yellow, Red)

            // Forwards
            ["19", "Mbeumo", 26, "RW", "Cameroon", 21.7, [0, 0]],
            ["10", "M. Cunha", 27, "LW", "Brazil", 16.5, [0, 0]],
            ["30", "Sesko", 23, "ST", "Slovenia", 19.4, [0, 0]],
            ["11", "Zirkzee", 25, "ST", "Netherlands", 12.6, [0, 0]],
            ["16", "Diallo", 23, "RW", "Ivory Coast", 10.0, [0, 0]],
            ["13", "Dorgu", 21, "LW", "Denmark", 7.7, [0, 0]],
            ["32", "Obi", 18, "ST", "Denmark", 5.0, [0, 0]],

            // Midfielders
            ["8", "B. Fernandes", 31, "CAM", "Portugal", 15.7, [0, 0]],
            ["37", "Mainoo", 21, "CM", "England", 12.8, [0, 0]],
            ["9", "McTominay", 29, "CM", "Scotland", 10.0, [0, 0]],
            ["18", "Casemiro", 34, "CDM", "Brazil", 8.8, [0, 0]],
            ["7", "Mount", 27, "CAM", "England", 8.7, [0, 0]],
            ["25", "Ugarte", 25, "CDM", "Uruguay", 8.9, [0, 0]],

            // Defenders
            ["6", "L. Martinez", 28, "CB", "Argentina", 9.9, [0, 0]],
            ["5", "Maguire", 33, "CB", "England", 6.4, [0, 0]],
            ["2", "Dalot", 27, "RB", "Portugal", 8.4, [0, 0]],
            ["4", "de Ligt", 26, "CB", "Netherlands", 8.4, [0, 0]],
            ["15", "Yoro", 20, "CB", "France", 8.9, [0, 0]],
            ["23", "Shaw", 30, "LB", "England", 7.5, [0, 0]],
            ["3", "Mazraoui", 28, "RB", "Morocco", 5.6, [0, 0]],
            ["26", "Heaven", 19, "CB", "England", 4.4, [0, 0]],

            // Goalkeepers
            ["31", "Lammens", 23, "GK", "Belgium", 6.3, [0, 0]],
            ["1", "Bayindir", 28, "GK", "Turkey", 3.4, [0, 0]]
        ]
    },
    "w2026_England": {
        "name": "England", // Team name
        "league": "World 2026", // League name
        "stage": "Group Stage", // Current stage in the league
        "position": 1,
        "points": 3,
        "matches_played": 1,
        "wins": 1,
        "draws": 0,
        "losses": 0,
        "squad_value": 314, // (millions)
        "squad_count": 26,
        "squad": [
            // Shirt Number - Name - Age - Position - Nationality - Value (in millions) - Cards Count (Yellow, Red)

            // Forwards
            ["7", "Saka", 24, "ST", "England", 23.6, [0, 0]],
            ["9", "Kane", 32, "ST", "England", 16.7, [0, 0]],
            ["11", "Rashford", 28, "LW", "England", 16.2, [0, 0]],
            ["18", "Gordon", 25, "LW", "England", 15.8, [0, 0]],
            ["20", "Madueke", 24, "RW", "England", 13.0, [0, 0]],
            ["22", "Toney", 30, "ST", "England", 11.8, [0, 0]],
            ["19", "Watkins", 30, "ST", "England", 9.9, [0, 0]],

            // Midfielders
            ["10", "Bellingham", 22, "CAM", "England", 21.4, [0, 0]],
            ["4", "Rice", 27, "CM", "England", 17.9, [0, 0]],
            ["17", "Rogers", 23, "CAM", "England", 17.7, [0, 0]],
            ["21", "Eze", 27, "CDM", "England", 14.6, [0, 0]],
            ["8", "Anderson", 23, "CM", "England", 12.5, [0, 0]],
            ["16", "Mainoo", 21, "CM", "England", 11.1, [0, 0]],
            ["14", "Henderson", 35, "CDM", "England", 4.5, [0, 0]],

            // Defenders
            ["6", "Gu&eacute;hi", 25, "CB", "England", 27.0, [0, 0]],
            ["24", "James", 26, "RB", "England", 11.2, [1, 0]],
            ["2", "Konsa", 28, "LB", "England", 7.9, [0, 0]],
            ["5", "Stones", 32, "CB", "England", 7.5, [1, 0]],
            ["3", "O'Reilly", 21, "LB", "England", 8.4, [0, 0]],
            ["25", "Spence", 25, "LB", "England", 8.2, [0, 0]],
            ["26", "Quansah", 23, "CB", "England", 6.3, [0, 0]],
            ["12", "Livramento", 23, "RB", "England", 6.5, [0, 0]],
            ["15", "Burn", 34, "CB", "England", 3.6, [0, 0]],

            // Goalkeepers
            ["1", "Pickford", 32, "GK", "England", 7.3, [0, 0]],
            ["13", "Henderson", 29, "GK", "England", 6.2, [0, 0]],
            ["23", "Trafford", 23, "GK", "England", 5.8, [0, 0]]
        ]
    },
};




// My Manager Data
const manager = {
    "name": "JamieHarperUK",
    "rank": [2, "Amateur"],
    "medals": 600,
    "world_rank": 228103
};




// Upcoming Fixtures
const upcoming_fixtures = [
    {
        "metadata": {
            "league": "World 2026",
            "stage": "Group Stage"
        },
        "my_team": {
            "name": "England",
            "lineup": {
                "formation": "4-3-3-A",
                "on_field": [
                    ["Pickford"],
                    ["Konsa", "Stones", "Gu&eacute;hi", "James"],
                    ["Rogers", "Bellingham", "Rice"],
                    ["Rashford", "Saka", "Kane"]
                ],
                "substitutes": [
                    "Gordon", "Madueke", 
                    "Eze", "Anderson", 
                    "Spence", "O'Reilly", 
                    "Henderson"
                ]
            }
        },
        "opponent_team": {
            "name": "Ghana",
            "lineup": {
                "formation": "4-5-1",
                "on_field": [
                    ["Ati Zigi"],
                    ["Peprah Oppong", "Seidu", "Adjetey", "Opoku"],
                    ["Yirenkyi", "Boakye", "Owusu", "Partey", "Sibo"],
                    ["Semenyo"]
                ],
                "substitutes": [
                    "Fatawu", "Sulemana", 
                    "Mumin", "Senaya", 
                    "Anang"
                ]
            }
        },
        "date_time": ["28-06-2026", "19:39"],
        "venue": "Home",
        // A null result indicates that the match has not been played yet
        "result": {
            "England": null,
            "Ghana": null
        }
    },



    {
        "metadata": {
            "league": "England 2nd Division",
            "stage": "Pre-Season"
        },
        "my_team": {
            "name": "Manchester United",
            "lineup": null
        },
        "opponent_team": {
            "name": "Manchester City",
            "lineup": null
        },
        "date_time": ["01-07-2026", "18:00"],
        "venue": "Away",
        // A null result indicates that the match has not been played yet
        "result": {
            "Manchester United": null,
            "Manchester City": null
        }
    },

    

    {
        "metadata": {
            "league": "World 2026",
            "stage": "Group Stage"
        },
        "my_team": {
            "name": "England",
            "lineup": {
                "formation": "4-4-2-B",
                "on_field": [
                    ["Pickford"],
                    ["Spence", "Gu&eacute;hi", "Stones", "James"],
                    ["Rice", "Eze", "Rogers", "Bellingham"],
                    ["Saka", "Kane"]
                ],
                "substitutes": [
                    "Gordon", "Rashford", 
                    "Anderson", "Mainoo", 
                    "Konsa", "O'Reilly", 
                    "Henderson"
                ]
            }
        },
        "opponent_team": {
            "name": "Croatia",
            "lineup": null // Lineup not available
        },
        "date_time": ["27-06-2026", "19:39"],
        "venue": "Home",
        // A null result indicates that the match has not been played yet
        "result": {
            "England": 4,
            "Croatia": 2
        }
    }
]
