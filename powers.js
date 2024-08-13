document.addEventListener('DOMContentLoaded', () => {
    populatePlayerTable();
    loadPowers();
});

function populatePlayerTable() {
    const tbody = document.querySelector('#playerTable tbody');
    tbody.innerHTML = '';

    const players = JSON.parse(localStorage.getItem('characters')) || [];
    players.forEach(player => {
        const row = document.createElement('tr');
        
        const selectCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        selectCell.appendChild(checkbox);
        row.appendChild(selectCell);

        const nameCell = document.createElement('td');
        nameCell.textContent = player.name;
        row.appendChild(nameCell);

        const typeCell = document.createElement('td');
        typeCell.textContent = player.type;
        row.appendChild(typeCell);

        const levelCell = document.createElement('td');
        levelCell.textContent = getLevel(player.xp);
        row.appendChild(levelCell);

        const xpCell = document.createElement('td');
        xpCell.textContent = player.xp;
        row.appendChild(xpCell);

        const apCell = document.createElement('td');
        apCell.textContent = player.ap;
        row.appendChild(apCell);

        const hpCell = document.createElement('td');
        hpCell.textContent = player.hp;
        row.appendChild(hpCell);

        const powersCell = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'power-select';
        select.addEventListener('change', () => usePower(player.name, select.value));
        powersCell.appendChild(select);
        row.appendChild(powersCell);

        tbody.appendChild(row);
    });
}

function loadPowers() {
    const selects = document.querySelectorAll('.power-select');
    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    selects.forEach(select => {
        select.innerHTML = '<option value="">Select a power</option>';
        powers.forEach((power, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = power.name;
            select.appendChild(option);
        });
    });
}

function usePower(playerName, powerIndex) {
    const powers = JSON.parse(localStorage.getItem('powers')) || [];
    const power = powers[powerIndex];
    if (!power) return;

    let characters = JSON.parse(localStorage.getItem('characters')) || [];
    characters = characters.map(char => {
        if (char.name === playerName) {
            if (char.ap >= power.apCost) {
                char.ap -= power.apCost;
                char.xp += power.xpGain || 0;
                char.ap += power.apGain || 0;
                char.hp += power.hpGain || 0;
            } else {
                alert('Not enough AP to use this power.');
            }
        }
        return char;
    });

    localStorage.setItem('characters', JSON.stringify(characters));
    populatePlayerTable();
}

function getLevel(xp) {
    if (xp < 5000) return 1;
    if (xp < 9999) return 2;
    return Math.floor(xp / 5000) + 1;
}
