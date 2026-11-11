// Powers page: players spend AP to use the powers defined on the Settings page.
document.addEventListener('DOMContentLoaded', () => {
    const { el } = Darbyon;
    const playersBody = document.getElementById('playersTableBody');
    const powersBody = document.getElementById('powersTableBody');
    const undoButton = document.getElementById('undoButton');
    const notice = document.getElementById('notice');

    function showNotice(text, kind) {
        notice.textContent = text;
        notice.className = 'notice ' + (kind || '');
    }

    function option(value, text) {
        const node = document.createElement('option');
        node.value = value;
        node.textContent = text;
        return node;
    }

    // Team powers can only be used on the player's own teammates.
    function fillTargets(select, player, players) {
        const teammates = players.filter(p => p.id !== player.id && player.team && p.team === player.team);
        select.appendChild(option('', teammates.length ? 'Select teammate' : 'No teammates'));
        teammates.forEach(p => select.appendChild(option(p.id, p.name)));
        select.disabled = !teammates.length;
    }

    function renderPlayers() {
        playersBody.innerHTML = '';
        const players = Darbyon.getCharacters();
        const powers = Darbyon.getPowers();

        if (!players.length) {
            Darbyon.emptyRow(playersBody, 8, 'No players yet. Add them on the Settings page.');
            return;
        }

        players.forEach(player => {
            const row = document.createElement('tr');
            if (player.hp === 0) row.className = 'fallen';
            row.appendChild(el('td', player.name));
            row.appendChild(el('td', player.type));
            row.appendChild(el('td', Darbyon.getLevel(player.xp), 'num'));
            row.appendChild(el('td', player.xp, 'num'));
            row.appendChild(el('td', player.ap, 'num'));
            row.appendChild(el('td', player.hp, 'num'));

            const powerSelect = document.createElement('select');
            powerSelect.setAttribute('aria-label', 'Power for ' + player.name);
            powerSelect.appendChild(option('', 'Select power'));
            powers.forEach(power => {
                powerSelect.appendChild(option(power.id, power.name + ' (' + power.apCost + ' AP)'));
            });
            const powerCell = document.createElement('td');
            powerCell.appendChild(powerSelect);
            row.appendChild(powerCell);

            const targetSelect = document.createElement('select');
            targetSelect.setAttribute('aria-label', 'Target for ' + player.name);
            fillTargets(targetSelect, player, players);
            targetSelect.hidden = true;   // only shown for team powers

            powerSelect.addEventListener('change', () => {
                const power = powers.find(p => p.id === powerSelect.value);
                targetSelect.hidden = !(power && power.type === 'team');
            });

            const applyButton = el('button', 'Apply Power', 'small');
            applyButton.type = 'button';
            applyButton.addEventListener('click', () => {
                const result = Darbyon.applyPower(player.id, powerSelect.value, targetSelect.value);
                if (result.ok) {
                    render();
                    showNotice(result.summary + '.', 'success');
                    Darbyon.Battle.start(result.fallen);
                } else {
                    showNotice(result.error, 'error');
                }
            });

            const actionsCell = document.createElement('td');
            const actions = el('div', null, 'actions');
            actions.appendChild(targetSelect);
            actions.appendChild(applyButton);
            actionsCell.appendChild(actions);
            row.appendChild(actionsCell);

            playersBody.appendChild(row);
        });
    }

    function renderPowers() {
        powersBody.innerHTML = '';
        const powers = Darbyon.getPowers();
        if (!powers.length) {
            Darbyon.emptyRow(powersBody, 5, 'No powers yet. Create them on the Settings page.');
            return;
        }
        powers.forEach(power => {
            const row = document.createElement('tr');
            row.appendChild(el('td', power.name));
            row.appendChild(el('td', power.type === 'team' ? 'Team-Based' : 'Self-Directed'));
            row.appendChild(el('td', power.apCost, 'num'));
            row.appendChild(el('td', Darbyon.describeEffect(power.xp, 0, power.hp)));
            row.appendChild(el('td', power.type === 'team'
                ? Darbyon.describeEffect(power.otherXp, power.otherAp, power.otherHp) : 'N/A'));
            powersBody.appendChild(row);
        });
    }

    function renderUndo() {
        const label = Darbyon.peekUndo();
        undoButton.disabled = !label;
        undoButton.title = label ? 'Undo: ' + label : 'Nothing to undo';
    }

    function render() {
        renderPlayers();
        renderPowers();
        renderUndo();
    }

    undoButton.addEventListener('click', () => {
        const label = Darbyon.undo();
        render();
        showNotice(label ? 'Undone: ' + label + '.' : 'No actions to undo.', label ? 'success' : 'error');
    });

    render();
});
