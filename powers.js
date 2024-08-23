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

        // Player details
        const details = ['name', 'type', 'level', 'xp', 'ap', 'hp'];
        details.forEach(detail => {
            const cell = document.createElement('td');
            cell.textContent = player[detail];
            row.appendChild(cell);
        });

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
    powersTableBody.innerHTML = '';  // Clear the table before adding new rows

    const powers = JSON.parse(localStorage.getItem('powers')) || [];
    
    powers.forEach(power => {
        const row = document.createElement('tr');

        // Create the name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = power.name;
        row.appendChild(nameCell);

        // Create the effects cell
        const effectCell = document.createElement('td');
        effectCell.textContent = `XP Gain: ${power.xp || 0}, AP Cost: ${power.ap || 0}, HP Effect: ${power.hp || 0}`;
        row.appendChild(effectCell);

        // Create the cell for effects on other players
        const otherEffectCell = document.createElement('td');
        otherEffectCell.textContent = `Other XP: ${power.otherPlayerXP || 0}, Other AP: ${power.otherPlayerAP || 0}, Other HP: ${power.otherPlayerHP || 0}`;
        row.appendChild(otherEffectCell);

        // Append the row to the table
        powersTableBody.appendChild(row);
    });
}

function applyPowerToPlayer(playerIndex, powerIndex) {
    const players = JSON.parse(localStorage.getItem('characters')) || [];
    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    const player = players[playerIndex];
    const power = powers[powerIndex];

    const playerAP = parseInt(player.ap, 10) || 0;
    const powerAPCost = parseInt(power.ap, 10) || 0;

    if (playerAP >= powerAPCost) {
        // Apply power effects to the player
        player.ap = playerAP - powerAPCost;  // Subtract AP cost
        player.xp = (parseInt(player.xp, 10) + (power.xp || 0));  // Add XP
        player.hp = (parseInt(player.hp, 10) + (power.hp || 0));  // Modify HP
        player.ap = (parseInt(player.ap, 10) + (power.otherPlayerAP || 0));  // Modify AP, after cost

        // Check if the power affects other players and apply effects if applicable
        if (power.otherPlayerXP || power.otherPlayerHP || power.otherPlayerAP) {
            // You can implement logic to apply effects to another player if needed.
            // Example: applyPowerToAnotherPlayer(playerIndex, power);
        }

        // Save updated player data to localStorage
        localStorage.setItem('characters', JSON.stringify(players));

        // Update the player row in the table
        const playerRow = document.querySelector(`#playersTableBody tr:nth-child(${playerIndex + 1})`);
        const cells = playerRow.getElementsByTagName('td');
        cells[3].textContent = player.xp;  // XP
        cells[4].textContent = player.ap;  // AP
        cells[5].textContent = player.hp;  // HP
    } else {
        alert("Not enough AP to use this power!");
    }
}

