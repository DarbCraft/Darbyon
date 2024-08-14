document.addEventListener('DOMContentLoaded', function() {
    loadPlayers();
    loadPowers();
});

function loadPlayers() {
    const playersTableBody = document.querySelector('#playersTableBody');
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
    const powersTableBody = document.querySelector('#powersTableBody');
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
        effectCell.textContent = `AP Cost: ${power.apCost || 0}, XP Gain: ${power.gainXp || 0}, HP Effect: ${power.gainHp || 0}, AP Effect: ${power.gainAp || 0}`;
        row.appendChild(effectCell);

        powersTableBody.appendChild(row);
    });
}

function applyPowerToPlayer(playerIndex, powerIndex) {
    const players = JSON.parse(localStorage.getItem('characters')) || [];
    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    const player = players[playerIndex];
    const power = powers[powerIndex];

    // Log retrieved power data
    console.log('Power data:', power);

    // Ensure AP and power cost are numbers
    const playerAP = parseInt(player.ap, 10) || 0;
    const powerAPCost = parseInt(power.apCost, 10) || 0;

    console.log(`Attempting to apply power: ${power.name} to player: ${player.name}`);
    console.log(`Current AP: ${playerAP}, Power Cost: ${powerAPCost}`);

    // Check if the player has enough AP
    if (playerAP >= powerAPCost) {
        // Apply the power
        player.ap -= powerAPCost;
        player.xp += (power.gainXp || 0);
        player.hp += (power.gainHp || 0);
        player.ap += (power.gainAp || 0);

        // Check for any effects on another player
        if (power.affectPlayer) {
            const affectedPlayer = players.find(p => p.name === power.affectPlayer);
            if (affectedPlayer) {
                if (power.effectType === 'hp') {
                    affectedPlayer.hp += power.effectAmount;
                } else if (power.effectType === 'ap') {
                    affectedPlayer.ap += power.effectAmount;
                } else if (power.effectType === 'xp') {
                    affectedPlayer.xp += power.effectAmount;
                }
            }
        }

        // Update the player data in localStorage
        localStorage.setItem('characters', JSON.stringify(players));

        // Reload the players table to reflect the changes
        loadPlayers();
    } else {
        alert("Not enough AP to use this power!");
    }
}
