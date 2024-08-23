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

function addPower(event) {
    event.preventDefault();

    const name = document.getElementById('powerName').value.trim();
    const type = document.getElementById('powerType').value;
    const xp = parseInt(document.getElementById('xpEffect').value) || 0;
    const ap = parseInt(document.getElementById('apEffect').value) || 0;
    const hp = parseInt(document.getElementById('hpEffect').value) || 0;
    const otherXP = parseInt(document.getElementById('otherPlayerXP').value) || 0;
    const otherAP = parseInt(document.getElementById('otherPlayerAP').value) || 0;
    const otherHP = parseInt(document.getElementById('otherPlayerHP').value) || 0;

    if (name && !isNaN(xp) && !isNaN(ap) && !isNaN(hp)) {
        const newPower = { 
            name, 
            type, 
            xpEffect: xp, 
            apEffect: ap, 
            hpEffect: hp, 
            otherPlayerXP: type === 'team' ? otherXP : undefined, 
            otherPlayerAP: type === 'team' ? otherAP : undefined, 
            otherPlayerHP: type === 'team' ? otherHP : undefined 
        };

        const powers = JSON.parse(localStorage.getItem('powers')) || [];
        powers.push(newPower);
        localStorage.setItem('powers', JSON.stringify(powers));

        document.getElementById('powerForm').reset();
        loadPowers();
    } else {
        alert("Please fill out all required fields correctly.");
    }
}

function editPower(index) {
    const powers = JSON.parse(localStorage.getItem('powers')) || [];
    const power = powers[index];

    const newName = prompt("Edit Power Name:", power.name);
    const newType = prompt("Edit Power Type:", power.type);
    const newXP = prompt("Edit XP Effect:", power.xpEffect);
    const newAP = prompt("Edit AP Effect:", power.apEffect);
    const newHP = prompt("Edit HP Effect:", power.hpEffect);
    const newOtherXP = prompt("Edit Other Player XP:", power.otherPlayerXP);
    const newOtherAP = prompt("Edit Other Player AP:", power.otherPlayerAP);
    const newOtherHP = prompt("Edit Other Player HP:", power.otherPlayerHP);

    if (newName !== null && !isNaN(newXP) && !isNaN(newAP) && !isNaN(newHP)) {
        power.name = newName.trim();
        power.type = newType;
        power.xpEffect = parseInt(newXP, 10);
        power.apEffect = parseInt(newAP, 10);
        power.hpEffect = parseInt(newHP, 10);
        power.otherPlayerXP = newType === 'team' ? parseInt(newOtherXP, 10) : undefined;
        power.otherPlayerAP = newType === 'team' ? parseInt(newOtherAP, 10) : undefined;
        power.otherPlayerHP = newType === 'team' ? parseInt(newOtherHP, 10) : undefined;

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
