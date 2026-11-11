// Update Values page: award XP, AP and HP, and show the daily news.
document.addEventListener('DOMContentLoaded', () => {
    const { el } = Darbyon;
    const tbody = document.querySelector('#playerTable tbody');
    const selectAll = document.getElementById('selectAllCheckbox');
    const undoButton = document.getElementById('undoButton');
    const logEntries = document.getElementById('logEntries');
    const selected = new Set();          // ids of ticked players, kept across redraws
    let sort = { key: null, ascending: true };

    // ---- Player table ----

    function sortedPlayers() {
        const players = Darbyon.getCharacters();
        if (!sort.key) return players;
        const valueOf = p => sort.key === 'level' ? Darbyon.getLevel(p.xp) : p[sort.key];
        players.sort((a, b) => {
            const x = valueOf(a), y = valueOf(b);
            const order = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
            return sort.ascending ? order : -order;
        });
        return players;
    }

    function askAmount(stat) {
        const answer = prompt('Enter ' + stat.toUpperCase() + ' value (positive/negative):');
        if (answer === null) return 0;
        const amount = parseInt(answer, 10);
        return isNaN(amount) ? 0 : amount;
    }

    function award(ids, stat) {
        if (!ids.length) {
            alert('Tick at least one player first.');
            return;
        }
        const amount = askAmount(stat);
        if (!amount) return;
        const fallen = Darbyon.adjustStat(ids, stat, amount);
        render();
        Darbyon.Battle.start(fallen, renderLog);
    }

    function statButton(playerId, stat, label) {
        const button = el('button', label, 'small');
        button.type = 'button';
        button.addEventListener('click', () => award([playerId], stat));
        return button;
    }

    function renderTable() {
        tbody.innerHTML = '';
        const players = sortedPlayers();
        const ids = players.map(p => p.id);
        Array.from(selected).forEach(id => { if (ids.indexOf(id) === -1) selected.delete(id); });

        if (!players.length) {
            Darbyon.emptyRow(tbody, 8, 'No players yet. Add them on the Settings page.');
        }
        players.forEach(player => {
            const row = document.createElement('tr');
            if (player.hp === 0) row.className = 'fallen';

            const selectCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selected.has(player.id);
            checkbox.setAttribute('aria-label', 'Select ' + player.name);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) selected.add(player.id); else selected.delete(player.id);
                selectAll.checked = players.length > 0 && selected.size === players.length;
            });
            selectCell.appendChild(checkbox);
            row.appendChild(selectCell);

            const updateCell = document.createElement('td');
            const buttons = el('div', null, 'actions');
            buttons.appendChild(statButton(player.id, 'xp', '🏅 XP'));
            buttons.appendChild(statButton(player.id, 'ap', '💎 AP'));
            buttons.appendChild(statButton(player.id, 'hp', '❤️ HP'));
            updateCell.appendChild(buttons);
            row.appendChild(updateCell);

            row.appendChild(el('td', player.name));
            row.appendChild(el('td', player.type));
            row.appendChild(el('td', Darbyon.getLevel(player.xp), 'num'));
            row.appendChild(el('td', player.xp, 'num'));
            row.appendChild(el('td', player.ap, 'num'));
            row.appendChild(el('td', player.hp, 'num'));
            tbody.appendChild(row);
        });
        selectAll.checked = players.length > 0 && selected.size === players.length;

        document.querySelectorAll('th.sortable').forEach(th => {
            if (th.dataset.sort === sort.key) {
                th.setAttribute('aria-sort', sort.ascending ? 'ascending' : 'descending');
            } else {
                th.removeAttribute('aria-sort');
            }
        });
    }

    function renderLog() {
        logEntries.innerHTML = '';
        const log = Darbyon.getLog();
        if (!log.length) logEntries.appendChild(el('p', 'Nothing yet.', 'hint'));
        log.slice().reverse().forEach(entry => {
            const item = el('p', entry.text, 'log-entry');
            item.appendChild(el('time', entry.time));
            logEntries.appendChild(item);
        });
    }

    function renderUndo() {
        const label = Darbyon.peekUndo();
        undoButton.disabled = !label;
        undoButton.title = label ? 'Undo: ' + label : 'Nothing to undo';
    }

    function render() {
        renderTable();
        renderLog();
        renderUndo();
    }

    selectAll.addEventListener('change', () => {
        selected.clear();
        if (selectAll.checked) Darbyon.getCharacters().forEach(p => selected.add(p.id));
        renderTable();
    });

    document.querySelectorAll('[data-bulk]').forEach(button => {
        button.addEventListener('click', () => award(Array.from(selected), button.dataset.bulk));
    });

    function sortBy(key) {
        // First click sorts A to Z or highest first; clicking again reverses it.
        const startAscending = key === 'name' || key === 'type';
        sort = sort.key === key ? { key: key, ascending: !sort.ascending }
                                : { key: key, ascending: startAscending };
        renderTable();
    }
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => sortBy(th.dataset.sort));
        th.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                sortBy(th.dataset.sort);
            }
        });
    });

    undoButton.addEventListener('click', () => {
        Darbyon.undo();
        render();
    });

    document.getElementById('clearLogButton').addEventListener('click', () => {
        Darbyon.clearLog();
        renderLog();
    });

    // ---- Daily news ----

    const currentMessage = document.getElementById('currentMessage');
    const messageCounter = document.getElementById('messageCounter');

    function showCounter(progress) {
        messageCounter.textContent = progress.shown + '/' + progress.total;
    }

    document.getElementById('generateMessageButton').addEventListener('click', () => {
        const result = Darbyon.nextMessage();
        currentMessage.innerHTML = '';
        if (!result) {
            currentMessage.textContent = 'No messages available.';
            return;
        }
        currentMessage.appendChild(el('strong', result.message.name));
        currentMessage.appendChild(document.createTextNode(': ' + result.message.description));
        showCounter(result);
    });

    document.getElementById('resetDailyEventsButton').addEventListener('click', () => {
        Darbyon.resetMessages();
        currentMessage.textContent = 'Generate Daily News';
        showCounter(Darbyon.messageProgress());
    });

    showCounter(Darbyon.messageProgress());
    render();
});
