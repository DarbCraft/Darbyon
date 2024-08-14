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
        affectCell.textContent = power.affectPlayer ? `Affects ${power.affectPlayer}` : 'None';
        row.appendChild(affectCell);

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
    const affectPlayer = prompt("Affects which player (leave blank if none):");
    const effectType = affectPlayer ? prompt("Effect type (hp, ap, xp):").toLowerCase() : 'none';
    const effectAmount = effectType !== 'none' ? parseInt(prompt("Effect amount:"), 10) : 0;

    if (name && !isNaN(apCost) && !isNaN(gainXp) && !isNaN(gainAp) && !isNaN(gainHp)) {
        const newPower = { name, apCost, gainXp, gainAp, gainHp, affectPlayer, effectType, effectAmount };
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
    const newAffectPlayer = prompt("Affects which player (leave blank if none):", power.affectPlayer);
    const newEffectType = newAffectPlayer ? prompt("Effect type (hp, ap, xp):", power.effectType).toLowerCase() : 'none';
    const newEffectAmount = newEffectType !== 'none' ? parseInt(prompt("Effect amount:", power.effectAmount), 10) : 0;

    if (newName !== null && !isNaN(newAPCost) && !isNaN(newGainXP) && !isNaN(newGainAP) && !isNaN(newGainHP)) {
        power.name = newName.trim();
        power.apCost = parseInt(newAPCost, 10);
        power.gainXp = parseInt(newGainXP, 10);
        power.gainAp = parseInt(newGainAP, 10);
        power.gainHp = parseInt(newGainHP, 10);
        power.affectPlayer = newAffectPlayer;
        power.effectType = newEffectType;
        power.effectAmount = newEffectAmount;
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
