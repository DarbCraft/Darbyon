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

        // ap
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
        effectCell.textContent = `ap Cost: ${power.apCost || 0}, XP Gain: ${power.gainxp || 0}, HP Effect: ${power.gainhp || 0}, ap Effect: ${power.gainap || 0}`;
        row.appendChild(effectCell);

        powersTableBody.appendChild(row);
    });
}

function applyPowerToPlayer(playerIndex, powerIndex) {
    const players = JSON.parse(localStorage.getItem('characters')) || [];
    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    const player = players[playerIndex];
    const power = powers[powerIndex];

    // Ensure ap and power cost are numbers
    const playerap = parseInt(player.ap, 10) || 0;
    const powerapCost = parseInt(power.apCost, 10) || 0;

    console.log(`Attempting to apply power: ${power.name} to player: ${player.name}`);
    console.log(`Current ap: ${playerap}, Power Cost: ${powerapCost}`);

    // Check if the player has enough ap
    if (playerap >= powerapCost) {
        // Apply the power
        player.ap = (playerap - powerapCost).toString(); // Convert back to string for storage
        player.xp = (parseInt(player.xp, 10) + (power.gainXp || 0)).toString();
        player.hp = (player.hp + (power.gainHp || 0)).toString();
        player.ap = (playerap + (power.gainap || 0)).toString();

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
