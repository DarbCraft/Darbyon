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

    // Ensure AP is an integer
    const playerAP = parseInt(player.ap, 10);
    const powerAPCost = parseInt(power.apCost, 10);

    // Check if the player has enough AP
    if (playerAP < powerAPCost) {
        alert("Not enough AP to use this power!");
        return;
    }

    // Update player's stats based on the power effects
    player.ap -= powerAPCost;
    player.xp += power.gainXp;
    player.ap += power.gainAp;
    player.hp += power.gainHp;

    // If the power affects another player
    const powerEffects = document.querySelectorAll('.affect-select');
    powerEffects.forEach(select => {
        if (select.value) {
            const targetPlayerName = select.value;
            const targetPlayer = players.find(p => p.name === targetPlayerName);

            if (targetPlayer) {
                const effectType = select.nextElementSibling.querySelector('.effect-type').value;
                const effectAmount = parseInt(select.nextElementSibling.querySelector('.effect-amount').value, 10);

                if (effectType === 'hp') {
                    targetPlayer.hp += effectAmount;
                } else if (effectType === 'ap') {
                    targetPlayer.ap += effectAmount;
                }
            }
        }
    });

    localStorage.setItem('characters', JSON.stringify(players));
    loadPlayers();
}
