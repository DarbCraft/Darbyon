document.addEventListener('DOMContentLoaded', () => {
    loadPowers();
});

function loadPowers() {
    const powersTable = document.querySelector('#powersTable tbody');
    powersTable.innerHTML = '';

    const powers = JSON.parse(localStorage.getItem('powers')) || [];
    powers.forEach((power, index) => {
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = power.name;
        row.appendChild(nameCell);

        const apCostCell = document.createElement('td');
        apCostCell.textContent = power.apCost;
        row.appendChild(apCostCell);

        const xpGainCell = document.createElement('td');
        xpGainCell.textContent = power.xpGain || 0;
        row.appendChild(xpGainCell);

        const apGainCell = document.createElement('td');
        apGainCell.textContent = power.apGain || 0;
        row.appendChild(apGainCell);

        const hpGainCell = document.createElement('td');
        hpGainCell.textContent = power.hpGain || 0;
        row.appendChild(hpGainCell);

        const affectOtherCell = document.createElement('td');
        affectOtherCell.textContent = power.affectOther ? 'Yes' : 'No';
        row.appendChild(affectOtherCell);

        const actionsCell = document.createElement('td');
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.onclick = () => editPower(index);
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => deletePower(index);
        actionsCell.appendChild(deleteButton);

        row.appendChild(actionsCell);

        powersTable.appendChild(row);
    });
}

function editPower(index) {
    const powers = JSON.parse(localStorage.getItem('powers')) || [];
    const power = powers[index];
    if (!power) return;

    const name = prompt('Enter new power name:', power.name);
    const apCost = parseInt(prompt('Enter AP cost:', power.apCost), 10);
    const xpGain = parseInt(prompt('Enter XP gain:', power.xpGain || 0), 10);
    const apGain = parseInt(prompt('Enter AP gain:', power.apGain || 0), 10);
    const hpGain = parseInt(prompt('Enter HP gain:', power.hpGain || 0), 10);
    const affectOther = confirm('Affects other player?');

    if (name !== null) power.name = name;
    if (!isNaN(apCost)) power.apCost = apCost;
    if (!isNaN(xpGain)) power.xpGain = xpGain;
    if (!isNaN(apGain)) power.apGain = apGain;
    if (!isNaN(hpGain)) power.hpGain = hpGain;
    power.affectOther = affectOther;

    localStorage.setItem('powers', JSON.stringify(powers));
    loadPowers();
}

function deletePower(index) {
    if (confirm('Are you sure you want to delete this power?')) {
        const powers = JSON.parse(localStorage.getItem('powers')) || [];
        powers.splice(index, 1);
        localStorage.setItem('powers', JSON.stringify(powers));
        loadPowers();
    }
}

document.getElementById('addPowerButton').addEventListener('click', () => {
    const name = prompt('Enter power name:');
    const apCost = parseInt(prompt('Enter AP cost:'), 10);
    const xpGain = parseInt(prompt('Enter XP gain:', 10));
    const apGain = parseInt(prompt('Enter AP gain:', 10));
    const hpGain = parseInt(prompt('Enter HP gain:', 10));
    const affectOther = confirm('Affects other player?');

    if (name && !isNaN(apCost)) {
        const powers = JSON.parse(localStorage.getItem('powers')) || [];
        powers.push({ name, apCost, xpGain, apGain, hpGain, affectOther });
        localStorage.setItem('powers', JSON.stringify(powers));
        loadPowers();
    }
});
