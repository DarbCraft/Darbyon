document.addEventListener('DOMContentLoaded', function() {
    loadPlayers();
});

function loadPlayers() {
    const playersTableBody = document.querySelector('#playersTable tbody');
    playersTableBody.innerHTML = '';

    const players = JSON.parse(localStorage.getItem('characters')) || [];
    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    players.forEach((player, index) => {
        const row = document.createElement('tr');

        // Player Name
        const nameCell = document.createElement('td');
        nameCell.textContent = player.name;
        row.appendChild(nameCell);

        // XP
        const xpCell = document.createElement('td');
        xpCell.textContent = player.xp;
        row.appendChild(xpCell);

        // AP
        const apCell = document.createElement('td');
        apCell.textContent = player.ap;
        row.appendChild(apCell);

        // HP
        const hpCell = document.createElement('td');
        hpCell.textContent = player.hp;
        row.appendChild(hpCell);

        // Powers
        const powersCell = document.createElement('td');
        const powersSelect = document.createElement('select');
        powersSelect.classList.add('powers-select');

        const defaultOption = document.createElement('option');
        defaultOption.text = 'Select power';
        defaultOption.value = '';
        powersSelect.appendChild(defaultOption);

        powers.forEach((power, powerIndex) => {
            const option = document.createElement('option');
            option.value = powerIndex;
            option.text = power.name;
            powersSelect.appendChild(option);
        });

        powersSelect.addEventListener('change', function() {
            const powerIndex = this.value;
            if (powerIndex) {
                applyPowerToPlayer(index, powerIndex);
            }
        });

        powersCell.appendChild(powersSelect);
        row.appendChild(powersCell);

        playersTableBody.appendChild(row);
    });
}

function applyPowerToPlayer(playerIndex, powerIndex) {
    const players = JSON.parse(localStorage.getItem('characters')) || [];
    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    const player = players[playerIndex];
    const power = powers[powerIndex];

    // Ensure the player has enough AP to use the power
    if (player.ap < power.apCost) {
        alert(`${player.name} does not have enough AP to use ${power.name}!`);
        return;
    }

    // Update player's stats based on the power effects
    player.ap -= power.apCost;
    player.xp += power.gainXp;
    player.ap += power.gainAp;
    player.hp += power.gainHp;

    // If the power affects another player
    if (power.affectPlayer) {
        const targetPlayer = players.find(p => p.name === power.affectPlayer);

        if (targetPlayer) {
            if (power.effectType === 'hp') {
                targetPlayer.hp += power.effectAmount;
            } else if (power.effectType === 'ap') {
                targetPlayer.ap += power.effectAmount;
            } else if (power.effectType === 'xp') {
                targetPlayer.xp += power.effectAmount;
            }
        }
    }

    localStorage.setItem('characters', JSON.stringify(players));
    loadPlayers();
}
