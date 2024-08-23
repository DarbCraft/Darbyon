let historyStack = [];  // Stack to store previous states

document.addEventListener('DOMContentLoaded', function () {
    loadPlayers();
    loadPowers();
    
    // Add undo button functionality
    const undoButton = document.querySelector('#undoButton');
    if (undoButton) {
        undoButton.addEventListener('click', undoLastAction);
    }
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

        // Actions column with "Apply Power" and "Target Player" (if necessary) button
        const actionsCell = document.createElement('td');
        const applyButton = document.createElement('button');
        applyButton.textContent = 'Apply Power';

        const targetPlayerSelect = document.createElement('select');
        targetPlayerSelect.classList.add('target-player-select');

        const defaultTargetOption = document.createElement('option');
        defaultTargetOption.text = 'Select target player';
        defaultTargetOption.value = '';
        targetPlayerSelect.appendChild(defaultTargetOption);

        players.forEach((targetPlayer, targetIndex) => {
            if (targetIndex !== index) {  // Don't allow self-targeting for other powers
                const targetOption = document.createElement('option');
                targetOption.value = targetIndex;
                targetOption.text = targetPlayer.name;
                targetPlayerSelect.appendChild(targetOption);
            }
        });

        applyButton.addEventListener('click', function () {
            const selectedPowerIndex = powersSelect.value;
            const selectedTargetIndex = targetPlayerSelect.value;

            if (selectedPowerIndex) {
                const power = powers[selectedPowerIndex];
                if (power.target === 'self') {
                    applyPowerToPlayer(index, selectedPowerIndex);
                } else if (power.target === 'other' && selectedTargetIndex) {
                    applyPowerToPlayer(index, selectedPowerIndex, selectedTargetIndex);
                } else {
                    alert("Please select a valid target for this power!");
                }
            } else {
                alert("Please select a power first!");
            }
        });

        actionsCell.appendChild(applyButton);
        actionsCell.appendChild(targetPlayerSelect);  // Only display for target powers
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

        const nameCell = document.createElement('td');
        nameCell.textContent = power.name;
        row.appendChild(nameCell);

        const typeCell = document.createElement('td');
        typeCell.textContent = power.type === 'team' ? 'Team-Based' : 'Self-Directed';
        row.appendChild(typeCell);

        const effectCell = document.createElement('td');
        effectCell.textContent = `XP Gain: ${power.xp || 0}, AP Cost: ${power.ap || 0}, HP Effect: ${power.hp || 0}`;
        row.appendChild(effectCell);

        const otherEffectCell = document.createElement('td');
        if (power.type === 'team') {
            otherEffectCell.textContent = `Other XP: ${power.otherPlayerXP || 0}, Other AP: ${power.otherPlayerAP || 0}, Other HP: ${power.otherPlayerHP || 0}`;
        } else {
            otherEffectCell.textContent = 'N/A';
        }
        row.appendChild(otherEffectCell);

        powersTableBody.appendChild(row);
    });
}


function applyPowerToPlayer(playerIndex, powerIndex, targetIndex = null) {
    const players = JSON.parse(localStorage.getItem('characters')) || [];
    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    // Push current state to history stack before applying the power
    historyStack.push(JSON.parse(JSON.stringify(players)));

    const player = players[playerIndex];
    const power = powers[powerIndex];
    
    const playerAP = parseInt(player.ap, 10) || 0;
    const powerAPCost = parseInt(power.ap, 10) || 0;

    if (playerAP >= powerAPCost) {
        // Deduct the AP cost
        player.ap = playerAP - powerAPCost;

        // Apply power effects to the player
        if (power.target === 'self') {
            player.xp = (parseInt(player.xp, 10) + (power.xp || 0));
            player.hp = (parseInt(player.hp, 10) + (power.hp || 0));
        }

        // Apply power effects to the target player (if it's a team-based power)
        if (targetIndex !== null && power.target === 'other') {
            const targetPlayer = players[targetIndex];
            targetPlayer.xp = (parseInt(targetPlayer.xp, 10) + (power.otherPlayerXP || 0));
            targetPlayer.ap = (parseInt(targetPlayer.ap, 10) + (power.otherPlayerAP || 0));
            targetPlayer.hp = (parseInt(targetPlayer.hp, 10) + (power.otherPlayerHP || 0));
        }

        // Save updated player data to localStorage
        localStorage.setItem('characters', JSON.stringify(players));

        // Update the player row in the table
        updatePlayerRow(playerIndex, players[playerIndex]);
        if (targetIndex !== null) {
            updatePlayerRow(targetIndex, players[targetIndex]);
        }
    } else {
        alert("Not enough AP to use this power!");
    }
}


function updatePlayerRow(playerIndex, player) {
    const playerRow = document.querySelector(`#playersTableBody tr:nth-child(${playerIndex + 1})`);
    const cells = playerRow.getElementsByTagName('td');
    cells[3].textContent = player.xp;  // XP
    cells[4].textContent = player.ap;  // AP
    cells[5].textContent = player.hp;  // HP
}

function undoLastAction() {
    if (historyStack.length > 0) {
        const previousState = historyStack.pop();
        localStorage.setItem('characters', JSON.stringify(previousState));

        // Reload players from the previous state
        loadPlayers();
        alert("Last action undone.");
    } else {
        alert("No actions to undo.");
    }
}
