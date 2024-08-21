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

        // Player Type
        const typeCell = document.createElement('td');
        typeCell.textContent = player.type;
        row.appendChild(typeCell);

        // Player Level
        const levelCell = document.createElement('td');
        levelCell.textContent = player.level;
        row.appendChild(levelCell);

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

        // Powers dropdown
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

        powersCell.appendChild(powersSelect);
        row.appendChild(powersCell);

        // Actions column with "Apply Power" button
        const actionsCell = document.createElement('td');
        const applyButton = document.createElement('button');
        applyButton.textContent = 'Apply Power';

        // Add event listener to apply the selected power
        applyButton.addEventListener('click', function() {
            const selectedPowerIndex = powersSelect.value;
            if (selectedPowerIndex) {
                applyPowerToPlayer(index, selectedPowerIndex);
            } else {
                alert("Please select a power first!");
            }
        });

        actionsCell.appendChild(applyButton);
        row.appendChild(actionsCell);

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
        effectCell.textContent = `AP Cost: ${power.apCost || 0}, XP Gain: ${power.gainxp || 0}, HP Effect: ${power.gainhp || 0}, AP Effect: ${power.gainap || 0}`;
        row.appendChild(effectCell);

        powersTableBody.appendChild(row);
    });
}

function applyPowerToPlayer(playerIndex, powerIndex) {
    const players = JSON.parse(localStorage.getItem('characters')) || [];
    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    const player = players[playerIndex];
    const power = powers[powerIndex];

    const playerAP = parseInt(player.ap, 10) || 0;
    const powerAPCost = parseInt(power.apCost, 10) || 0;

    if (playerAP >= powerAPCost) {
        // Subtract AP cost and apply power effects
        player.ap = (playerAP - powerAPCost).toString();
        player.xp = (parseInt(player.xp, 10) + (power.gainxp || 0)).toString();
        player.hp = (parseInt(player.hp, 10) + (power.gainhp || 0)).toString();
        player.ap = (parseInt(player.ap, 10) + (power.gainap || 0)).toString();

        // Check and apply power effects to other players if needed
        if (power.affectPlayer) {
            const affectedPlayer = players.find(p => p.name === power.affectPlayer);
            if (affectedPlayer) {
                const effectAmount = parseInt(power.effectAmount, 10) || 0;

                switch (power.effectType) {
                    case 'hp':
                        affectedPlayer.hp = (parseInt(affectedPlayer.hp, 10) + effectAmount).toString();
                        break;
                    case 'ap':
                        affectedPlayer.ap = (parseInt(affectedPlayer.ap, 10) + effectAmount).toString();
                        break;
                    case 'xp':
                        affectedPlayer.xp = (parseInt(affectedPlayer.xp, 10) + effectAmount).toString();
                        break;
                }
            } else {
                console.error(`Player ${power.affectPlayer} not found!`);
            }
        }

        // Save updated player data to localStorage
        localStorage.setItem('characters', JSON.stringify(players));

        // Reload the players table to reflect the changes
        loadPlayers();
    } else {
        alert("Not enough AP to use this power!");
    }
}
