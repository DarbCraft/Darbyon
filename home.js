// Home page: the class table and the random player picker.
document.addEventListener('DOMContentLoaded', () => {
    const { el } = Darbyon;
    const tbody = document.querySelector('#playerTable tbody');
    const playerName = document.getElementById('playerName');
    const counter = document.getElementById('selectionCounter');

    function renderTable() {
        tbody.innerHTML = '';
        const players = Darbyon.getCharacters();
        if (!players.length) {
            Darbyon.emptyRow(tbody, 6, 'No players yet. Add them on the Settings page.');
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
            tbody.appendChild(row);
        });
    }

    function showCounter(progress) {
        counter.textContent = progress.shown + '/' + progress.total;
    }

    document.getElementById('pickRandomPlayerButton').addEventListener('click', () => {
        const result = Darbyon.pickPlayer();
        if (!result) {
            playerName.textContent = 'No players available.';
            return;
        }
        playerName.textContent = result.player.name;
        showCounter(result);
    });

    document.getElementById('resetPickerButton').addEventListener('click', () => {
        Darbyon.resetPicker();
        playerName.textContent = 'None';
        showCounter(Darbyon.pickerProgress());
    });

    renderTable();
    const progress = Darbyon.pickerProgress();
    showCounter(progress);
    if (!progress.total) playerName.textContent = 'No players available.';
});
