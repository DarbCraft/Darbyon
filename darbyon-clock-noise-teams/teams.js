// Teams page: one card per team, with its members and combined totals.
Darbyon.ready(() => {
    const { el } = Darbyon;
    const container = document.getElementById('teamsContainer');

    const PLACES = ['🥇', '🥈', '🥉'];
    const totalXp = members => members.reduce((sum, c) => sum + c.xp, 0);

    function addCard(title, members, place) {
        const card = el('section', null, 'panel team-card' + (place === 0 ? ' first' : ''));
        const heading = el('h2', null, 'team-heading');
        if (place !== undefined) heading.appendChild(el('span', PLACES[place] || String(place + 1), 'place'));
        heading.appendChild(el('span', title));
        card.appendChild(heading);

        const count = members.length + (members.length === 1 ? ' player' : ' players');
        card.appendChild(el('p', count + ', ' + totalXp(members).toLocaleString() + ' XP in total', 'totals'));
        members = members.slice().sort((a, b) => b.xp - a.xp);

        const table = document.createElement('table');
        const headRow = document.createElement('tr');
        [['Name', ''], ['Type', ''], ['Level', ''], ['XP', 'num'], ['AP', 'num'], ['HP', 'num']]
            .forEach(([text, cls]) => headRow.appendChild(el('th', text, cls)));
        const thead = document.createElement('thead');
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        if (!members.length) Darbyon.emptyRow(tbody, 6, 'No players in this team yet.');
        members.forEach(c => {
            const row = document.createElement('tr');
            if (c.hp === 0) row.className = 'fallen';
            row.appendChild(Darbyon.nameCell(c));
            row.appendChild(Darbyon.cell(Darbyon.typeTag(c.type)));
            row.appendChild(Darbyon.cell(Darbyon.levelBadge(c.xp)));
            row.appendChild(el('td', c.xp, 'num'));
            row.appendChild(el('td', c.ap, 'num'));
            row.appendChild(el('td', c.hp, 'num'));
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        card.appendChild(table);
        container.appendChild(card);
    }

    function render() {
        container.innerHTML = '';
        const characters = Darbyon.getCharacters();
        const teams = Darbyon.getTeams();
        if (!teams.length) {
            container.appendChild(el('p', 'No teams yet. Create them on the Settings page.', 'panel'));
            return;
        }
        Darbyon.announceLevelUps();
        const teamNames = teams.map(t => t.name);
        const ranked = teams.map(team => ({ name: team.name, members: characters.filter(c => c.team === team.name) }))
                            .sort((a, b) => totalXp(b.members) - totalXp(a.members));

        // Leaderboard: every team's total XP as a bar, biggest first.
        const board = el('section', null, 'panel leaderboard');
        board.appendChild(el('h2', 'Team Leaderboard'));
        const top = Math.max(1, totalXp(ranked[0].members));
        ranked.forEach((team, place) => {
            const row = el('div', null, 'leader-row');
            row.appendChild(el('span', PLACES[place] || String(place + 1), 'place'));
            row.appendChild(el('span', team.name, 'leader-name'));
            const bar = el('div', null, 'leader-bar');
            const fill = el('div', null, 'leader-fill');
            fill.style.width = Math.round(100 * totalXp(team.members) / top) + '%';
            bar.appendChild(fill);
            row.appendChild(bar);
            row.appendChild(el('span', totalXp(team.members).toLocaleString() + ' XP', 'leader-xp'));
            board.appendChild(row);
        });
        container.appendChild(board);

        ranked.forEach((team, place) => addCard(team.name, team.members, place));

        const unassigned = characters.filter(c => teamNames.indexOf(c.team) === -1);
        if (unassigned.length) addCard('No team', unassigned);
    }

    Darbyon.onChange(render, { poll: true });
    render();
});
