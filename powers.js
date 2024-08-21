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
    powersTableBody.innerHTML = '';

    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    powers.forEach(power => {
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
        // Apply power effects
        player.ap = (playerAP - powerAPCost).toString();
        player.xp = (parseInt(player.xp, 10) + (power.gainxp || 0)).toString();
        player.hp = (parseInt(player.hp, 10) + (power.gainhp || 0)).toString();
        player.ap = (parseInt(player.ap, 10) + (power.gainap || 0)).toString();

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
