document.addEventListener('DOMContentLoaded', function() {
    loadPlayers();
    loadPowers();
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

function loadPowers() {
    const powersTableBody = document.querySelector('#powersTable tbody');
    powersTableBody.innerHTML = '';

    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    powers.forEach((power) => {
        const row = document.createElement('tr');

        // Power Name
        const nameCell = document.createElement('td');
        nameCell.textContent = power.name;
        row.appendChild(nameCell);

        // Power Effect
        const effectCell = document.createElement('td');
        effectCell.textContent = `AP Cost: ${power.apCost}, XP Gain: ${power.gainXp}, HP Effect: ${power.gainHp}, AP Effect: ${power.gainAp}`;
        row.appendChild(effectCell);

        powersTableBody.appendChild(row);
    });
}

function applyPowerToPlayer(playerIndex, powerIndex) {
    const players = JSON.parse(localStorage.getItem('characters')) || [];
    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    const player = players[playerIndex];
    const power = powers[powerIndex];

    // Ensure AP cost is an integer
    const playerAP = parseInt(player.ap, 10);
    const powerAPCost = parseInt(power.apCost, 10);

    console.log(`Player AP: ${playerAP}`);
    console.log(`Power AP Cost: ${powerAPCost}`);

    // Check if the player has enough AP
    if (playerAP < powerAPCost) {
        alert("Not enough AP to use this power!");
        return;
    }

    // Apply the power effects to the player
    player.ap -= powerAPCost;
    player.xp += (power.gainXp || 0);
    player.hp += (power.gainHp || 0);
    player.ap += (power.gainAp || 0);

    // If the power affects other players
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

    // Save updated players data
    localStorage.setItem('characters', JSON.stringify(players));
    loadPlayers();
}
