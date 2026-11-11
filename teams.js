// Teams page: one card per team, with its members and combined totals.
document.addEventListener('DOMContentLoaded', () => {
    const { el } = Darbyon;
    const container = document.getElementById('teamsContainer');
    const characters = Darbyon.getCharacters();
    const teams = Darbyon.getTeams();

    function addCard(title, members) {
        const card = el('section', null, 'panel team-card');
        card.appendChild(el('h2', title));

        const totalXp = members.reduce((sum, c) => sum + c.xp, 0);
        const count = members.length + (members.length === 1 ? ' player' : ' players');
        card.appendChild(el('p', count + ' · ' + totalXp + ' XP in total', 'totals'));

        const table = document.createElement('table');
        const headRow = document.createElement('tr');
        [['Name', ''], ['Type', ''], ['Level', 'num'], ['XP', 'num'], ['AP', 'num'], ['HP', 'num']]
            .forEach(([text, cls]) => headRow.appendChild(el('th', text, cls)));
        const thead = document.createElement('thead');
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        if (!members.length) Darbyon.emptyRow(tbody, 6, 'No players in this team yet.');
        members.forEach(c => {
            const row = document.createElement('tr');
            if (c.hp === 0) row.className = 'fallen';
            row.appendChild(el('td', c.name));
            row.appendChild(el('td', c.type));
            row.appendChild(el('td', Darbyon.getLevel(c.xp), 'num'));
            row.appendChild(el('td', c.xp, 'num'));
            row.appendChild(el('td', c.ap, 'num'));
            row.appendChild(el('td', c.hp, 'num'));
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        card.appendChild(table);
        container.appendChild(card);
    }

    if (!teams.length) {
        container.appendChild(el('p', 'No teams yet. Create them on the Settings page.', 'panel'));
        return;
    }

    const teamNames = teams.map(t => t.name);
    teams.forEach(team => addCard(team.name, characters.filter(c => c.team === team.name)));

    const unassigned = characters.filter(c => teamNames.indexOf(c.team) === -1);
    if (unassigned.length) addCard('No team', unassigned);
});
