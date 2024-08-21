document.addEventListener('DOMContentLoaded', function() {
    loadTeams();
});

function loadTeams() {
    const teamsContainer = document.getElementById('teamsContainer');
    teamsContainer.innerHTML = '';

    // Load characters and teams from localStorage
    const characters = JSON.parse(localStorage.getItem('characters')) || [];
    const teams = JSON.parse(localStorage.getItem('teams')) || [];

    teams.forEach(team => {
        // Create a table for each team
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        // Set up the table headers
        const headerRow = document.createElement('tr');
        const headers = ['Name', 'Type', 'XP', 'AP', 'HP'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Add the players assigned to this team
        characters.forEach(char => {
            if (char.team === team.name) {
                const row = document.createElement('tr');
                
                // Name
                const nameCell = document.createElement('td');
                nameCell.textContent = char.name;
                row.appendChild(nameCell);

                // Type
                const typeCell = document.createElement('td');
                typeCell.textContent = char.type;
                row.appendChild(typeCell);

                // XP
                const xpCell = document.createElement('td');
                xpCell.textContent = char.xp;
                row.appendChild(xpCell);

                // AP
                const apCell = document.createElement('td');
                apCell.textContent = char.ap;
                row.appendChild(apCell);

                // HP
                const hpCell = document.createElement('td');
                hpCell.textContent = char.hp;
                row.appendChild(hpCell);

                tbody.appendChild(row);
            }
        });

        // Add a title above each team's table
        const teamTitle = document.createElement('h2');
        teamTitle.textContent = `Team: ${team.name}`;
        teamsContainer.appendChild(teamTitle);

        // Assemble the table and add to the container
        table.appendChild(thead);
        table.appendChild(tbody);
        teamsContainer.appendChild(table);
    });
}
