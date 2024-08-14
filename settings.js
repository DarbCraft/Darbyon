document.addEventListener('DOMContentLoaded', function() {
    loadPowers();
    document.getElementById('addPowerButton').addEventListener('click', addPower);
});

function loadPowers() {
    const powersTableBody = document.querySelector('#powersTable tbody');
    powersTableBody.innerHTML = '';

    const powers = JSON.parse(localStorage.getItem('powers')) || [];

    powers.forEach((power, index) => {
        const row = document.createElement('tr');

        // Power Name
        const nameCell = document.createElement('td');
        nameCell.textContent = power.name;
        row.appendChild(nameCell);

        // AP Cost
        const apCostCell = document.createElement('td');
        apCostCell.textContent = power.apCost;
        row.appendChild(apCostCell);

        // Gain XP
        const gainXpCell = document.createElement('td');
        gainXpCell.textContent = power.gainXp;
        row.appendChild(gainXpCell);

        // Gain AP
        const gainApCell = document.createElement('td');
        gainApCell.textContent = power.gainAp;
        row.appendChild(gainApCell);

        // Gain HP
        const gainHpCell = document.createElement('td');
        gainHpCell.textContent = power.gainHp;
        row.appendChild(gainHpCell);

        // Affect Other Player?
        const affectCell = document.createElement('td');
        const affectSelect = document.createElement('select');
        affectSelect.classList.add('affect-select');

        // Add a default option
        const defaultOption = document.createElement('option');
        defaultOption.text = 'Select player and effect';
        defaultOption.value = '';
        affectSelect.appendChild(defaultOption);

        // Populate player options
        const players = JSON.parse(localStorage.getItem('characters')) || [];
        players.forEach(player => {
            const option = document.createElement('option');
            option.value = player.name;
            option.text = player.name;
            if (power.affectPlayer === player.name) {
                option.selected = true;
            }
            affectSelect.appendChild(option);
        });

        // Add fields to define how it will affect the selected player
        const effectDetails = document.createElement('div');
        effectDetails.classList.add('effect-details');
        effectDetails.innerHTML = `
            <label for="effectType">Effect Type:</label>
            <select class="effect-type">
                <option value="none" ${power.effectType === 'none' ? 'selected' : ''}>None</option>
                <option value="hp" ${power.effectType === 'hp' ? 'selected' : ''}>Add HP</option>
                <option value="ap" ${power.effectType === 'ap' ? 'selected' : ''}>Add AP</option>
            </select>
            <label for="effectAmount">Amount:</label>
            <input type="number" class="effect-amount" min="0" value="${power.effectAmount || 0}">
        `;
        affectCell.appendChild(affectSelect);
        affectCell.appendChild(effectDetails);

        // Actions
        const actionsCell = document.createElement('td');

        // Edit button
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => editPower(index));
        actionsCell.appendChild(editButton);

        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deletePower(index));
        actionsCell.appendChild(deleteButton);

        row.appendChild(actionsCell);
        powersTableBody.appendChild(row);
    });
}

function addPower() {
    const name = prompt("Enter power name:");
    const apCost = parseInt(prompt("Enter AP cost:"), 10);
    const gainXp = parseInt(prompt("Enter XP gain:"), 10);
    const gainAp = parseInt(prompt("Enter AP gain:"), 10);
    const gainHp = parseInt(prompt("Enter HP gain:"), 10);

    if (name && !isNaN(apCost) && !isNaN(gainXp) && !isNaN(gainAp) && !isNaN(gainHp)) {
        const newPower = { name, apCost, gainXp, gainAp, gainHp, affectPlayer: '', effectType: 'none', effectAmount: 0 };
        let powers = JSON.parse(localStorage.getItem('powers')) || [];
        powers.push(newPower);
        localStorage.setItem('powers', JSON.stringify(powers));
        loadPowers();
    } else {
        alert("Invalid input!");
    }
}

function editPower(index) {
    const powers = JSON.parse(localStorage.getItem('powers')) || [];
    const power = powers[index];

    const newName = prompt("Edit Power Name:", power.name);
    const newAPCost = prompt("Edit AP Cost:", power.apCost);
    const newGainXP = prompt("Edit Gain XP:", power.gainXp);
    const newGainAP = prompt("Edit Gain AP:", power.gainAp);
    const newGainHP = prompt("Edit Gain HP:", power.gainHp);

    if (newName !== null && !isNaN(newAPCost) && !isNaN(newGainXP) && !isNaN(newGainAP) && !isNaN(newGainHP)) {
        power.name = newName.trim();
        power.apCost = parseInt(newAPCost, 10);
        power.gainXp = parseInt(newGainXP, 10);
        power.gainAp = parseInt(newGainAP, 10);
        power.gainHp = parseInt(newGainHP, 10);
        powers[index] = power;
        localStorage.setItem('powers', JSON.stringify(powers));
        loadPowers();
    }
}

function deletePower(index) {
    const confirmation = confirm("Are you sure you want to delete this power?");
    if (confirmation) {
        let powers = JSON.parse(localStorage.getItem('powers')) || [];
        powers.splice(index, 1);
        localStorage.setItem('powers', JSON.stringify(powers));
        loadPowers();
    }
}
