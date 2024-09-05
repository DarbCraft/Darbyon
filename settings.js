document.addEventListener('DOMContentLoaded', function() {
    loadPowers();
    document.getElementById('powerForm').addEventListener('submit', addPower);
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
        apCostCell.textContent = power.apEffect;
        row.appendChild(apCostCell);

        // Gain XP
        const gainxpCell = document.createElement('td');
        gainxpCell.textContent = power.xpEffect;
        row.appendChild(gainxpCell);

        // Gain AP
        const gainApCell = document.createElement('td');
        gainApCell.textContent = power.apEffect;
        row.appendChild(gainApCell);

        // Gain HP
        const gainHpCell = document.createElement('td');
        gainHpCell.textContent = power.hpEffect;
        row.appendChild(gainHpCell);

        // Affect Other Player?
        const affectCell = document.createElement('td');
        affectCell.textContent = power.otherPlayerxp ? `Affects other player xp: ${power.otherPlayerxp}` : 'None';
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

function addPower(event) {
    event.preventDefault();

    const name = document.getElementById('powerName').value.trim();
    const type = document.getElementById('powerType').value;
    const xp = parseInt(document.getElementById('xpEffect').value) || 0;
    const ap = parseInt(document.getElementById('apEffect').value) || 0;
    const hp = parseInt(document.getElementById('hpEffect').value) || 0;
    const otherXP = type === 'team' ? parseInt(document.getElementById('otherPlayerxp').value) || 0 : undefined;
    const otherAP = type === 'team' ? parseInt(document.getElementById('otherPlayerAP').value) || 0 : undefined;
    const otherHP = type === 'team' ? parseInt(document.getElementById('otherPlayerHP').value) || 0 : undefined;

    if (name && !isNaN(xp) && !isNaN(ap) && !isNaN(hp)) {
        const newPower = { 
            name, 
            type, 
            xpEffect: xp, 
            apEffect: ap, 
            hpEffect: hp, 
            otherPlayerxp: otherXP, 
            otherPlayerAP: otherAP, 
            otherPlayerHP: otherHP 
        };

        const powers = JSON.parse(localStorage.getItem('powers')) || [];
        powers.push(newPower);
        localStorage.setItem('powers', JSON.stringify(powers));

        document.getElementById('powerForm').reset();
        loadPowers();

        console.log("New Power Data: ", newPower);
    } else {
        alert("Please fill out all required fields correctly.");
    }
}

function editPower(index) {
    const powers = JSON.parse(localStorage.getItem('powers')) || [];
    const power = powers[index];

    const newName = prompt("Edit Power Name:", power.name);
    const newAPCost = prompt("Edit AP Cost:", power.apEffect);
    const newGainXP = prompt("Edit Gain XP:", power.xpEffect);
    const newGainAP = prompt("Edit Gain AP:", power.apEffect);
    const newGainHP = prompt("Edit Gain HP:", power.hpEffect);
    const newAffectPlayer = prompt("Affects which player (leave blank if none):", power.otherPlayerxp);

    if (newName !== null && !isNaN(newAPCost) && !isNaN(newGainXP) && !isNaN(newGainAP) && !isNaN(newGainHP)) {
        power.name = newName.trim();
        power.apEffect = parseInt(newAPCost, 10);
        power.xpEffect = parseInt(newGainXP, 10);
        power.apEffect = parseInt(newGainAP, 10);
        power.hpEffect = parseInt(newGainHP, 10);
        power.otherPlayerxp = newAffectPlayer || undefined;

        powers[index] = power;
        localStorage.setItem('powers', JSON.stringify(powers));
        loadPowers();
    }
}

function deletePower(index) {
    const confirmation = confirm("Are you sure you want to delete this power?");
    if (confirmation) {
        const powers = JSON.parse(localStorage.getItem('powers')) || [];
        powers.splice(index, 1);
        localStorage.setItem('powers', JSON.stringify(powers));
        loadPowers();
    }
}
