// Settings page: set up players, teams, daily news and powers, and back up the class.
Darbyon.ready(() => {
    const { el } = Darbyon;
    const byId = id => document.getElementById(id);

    function button(label, className, onClick) {
        const node = el('button', label, 'small ' + (className || ''));
        node.type = 'button';
        node.addEventListener('click', onClick);
        return node;
    }

    function actionsCell() {
        const cell = document.createElement('td');
        const group = el('div', null, 'actions');
        Array.from(arguments).forEach(node => group.appendChild(node));
        cell.appendChild(group);
        return cell;
    }

    function option(value, text, selected) {
        const node = document.createElement('option');
        node.value = value;
        node.textContent = text;
        node.selected = !!selected;
        return node;
    }

    // ---- Characters ----

    Object.keys(Darbyon.CLASSES).forEach(type => byId('charType').appendChild(option(type, type)));

    function renderCharacters() {
        const tbody = byId('charactersTableBody');
        tbody.innerHTML = '';
        const characters = Darbyon.getCharacters();
        const teams = Darbyon.getTeams();
        if (!characters.length) {
            Darbyon.emptyRow(tbody, 7, 'No characters yet. Add the first one above.');
            return;
        }
        characters.forEach(char => {
            const row = document.createElement('tr');
            row.appendChild(Darbyon.nameCell(char));

            const typeSelect = document.createElement('select');
            typeSelect.setAttribute('aria-label', 'Class for ' + char.name);
            const types = Object.keys(Darbyon.CLASSES);
            if (types.indexOf(char.type) === -1) types.push(char.type);   // keep any older custom class
            types.forEach(type => typeSelect.appendChild(option(type, type, type === char.type)));
            typeSelect.addEventListener('change', () => {
                // Avatars belong to a class, so a new class means choosing again.
                Darbyon.updateCharacter(char.id, { type: typeSelect.value, avatar: '' });
                renderCharacters();
            });
            const typeCell = document.createElement('td');
            typeCell.appendChild(typeSelect);
            row.appendChild(typeCell);

            row.appendChild(el('td', char.xp, 'num'));
            row.appendChild(el('td', char.ap, 'num'));
            row.appendChild(el('td', char.hp, 'num'));

            const teamSelect = document.createElement('select');
            teamSelect.setAttribute('aria-label', 'Team for ' + char.name);
            teamSelect.appendChild(option('', 'No team'));
            teams.forEach(team => teamSelect.appendChild(option(team.name, team.name, team.name === char.team)));
            teamSelect.addEventListener('change', () => {
                Darbyon.updateCharacter(char.id, { team: teamSelect.value });
                renderTeams();
            });
            const teamCell = document.createElement('td');
            teamCell.appendChild(teamSelect);
            row.appendChild(teamCell);

            row.appendChild(actionsCell(
                button('Avatar', 'soft', () => chooseAvatar(char)),
                button('Rename', 'secondary', () => {
                    const newName = prompt('Edit Character Name:', char.name);
                    if (newName !== null && newName.trim() !== '') {
                        Darbyon.updateCharacter(char.id, { name: newName.trim() });
                        renderCharacters();
                        renderTeams();
                    }
                }),
                button('Delete', 'danger', () => {
                    if (confirm('Are you sure you want to delete ' + char.name + '?')) {
                        Darbyon.deleteCharacter(char.id);
                        renderCharacters();
                        renderTeams();
                    }
                })
            ));
            tbody.appendChild(row);
        });
    }

    // ---- Avatar picker ----

    let avatarDialog = null;

    function chooseAvatar(char) {
        if (!avatarDialog) {
            avatarDialog = document.createElement('dialog');
            avatarDialog.className = 'avatar-picker';
            document.body.appendChild(avatarDialog);
        }
        avatarDialog.innerHTML = '';
        avatarDialog.appendChild(el('h2', 'Choose an avatar for ' + char.name));

        const choose = avatar => {
            Darbyon.updateCharacter(char.id, { avatar: avatar });
            avatarDialog.close();
            renderCharacters();
        };
        const choices = Darbyon.AVATARS[char.type] || [];
        const grid = el('div', null, 'avatar-grid');
        choices.forEach((avatar, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'avatar-option';
            option.setAttribute('aria-label', char.type + ' avatar ' + (index + 1));
            if (avatar === char.avatar) option.setAttribute('aria-pressed', 'true');
            option.appendChild(Darbyon.avatarImage({ avatar: avatar }));
            option.addEventListener('click', () => choose(avatar));
            grid.appendChild(option);
        });
        avatarDialog.appendChild(grid);
        if (!choices.length) avatarDialog.appendChild(el('p', 'There are no avatars for this class.', 'hint'));

        const actions = el('div', null, 'actions');
        const none = el('button', 'No avatar', 'secondary');
        none.type = 'button';
        none.addEventListener('click', () => choose(''));
        const cancel = el('button', 'Cancel', 'soft');
        cancel.type = 'button';
        cancel.addEventListener('click', () => avatarDialog.close());
        actions.appendChild(none);
        actions.appendChild(cancel);
        avatarDialog.appendChild(actions);
        avatarDialog.showModal();
    }

    byId('addCharacterForm').addEventListener('submit', event => {
        event.preventDefault();
        const name = byId('charName').value.trim();
        if (!name) return;
        Darbyon.addCharacter(name, byId('charType').value);
        byId('charName').value = '';
        byId('charName').focus();
        renderCharacters();
    });

    // ---- Teams ----

    function renderTeams() {
        const tbody = byId('teamsTableBody');
        tbody.innerHTML = '';
        const teams = Darbyon.getTeams();
        const characters = Darbyon.getCharacters();
        if (!teams.length) {
            Darbyon.emptyRow(tbody, 3, 'No teams yet.');
            return;
        }
        teams.forEach(team => {
            const members = characters.filter(c => c.team === team.name).map(c => c.name);
            const row = document.createElement('tr');
            row.appendChild(el('td', team.name));
            row.appendChild(el('td', members.length ? members.join(', ') : 'No members yet'));
            row.appendChild(actionsCell(
                button('Rename', 'secondary', () => {
                    const newName = prompt('Edit Team Name:', team.name);
                    if (newName === null) return;
                    const error = Darbyon.renameTeam(team.name, newName);
                    if (error) alert(error);
                    renderTeams();
                    renderCharacters();
                }),
                button('Delete', 'danger', () => {
                    if (confirm('Delete team ' + team.name + '? Its players will have no team.')) {
                        Darbyon.deleteTeam(team.name);
                        renderTeams();
                        renderCharacters();
                    }
                })
            ));
            tbody.appendChild(row);
        });
    }

    byId('teamForm').addEventListener('submit', event => {
        event.preventDefault();
        const error = Darbyon.addTeam(byId('teamName').value);
        if (error) {
            alert(error);
            return;
        }
        byId('teamForm').reset();
        renderTeams();
        renderCharacters();
    });

    // ---- Daily news ----

    function renderMessages() {
        const tbody = byId('messagesTableBody');
        tbody.innerHTML = '';
        const messages = Darbyon.getMessages();
        if (!messages.length) {
            Darbyon.emptyRow(tbody, 3, 'No news items yet.');
            return;
        }
        messages.forEach((msg, index) => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.appendChild(el('strong', msg.name));
            row.appendChild(nameCell);
            row.appendChild(el('td', msg.description));
            row.appendChild(actionsCell(
                button('Edit', 'secondary', () => {
                    const newName = prompt('Edit Name:', msg.name);
                    if (newName === null) return;
                    const newDescription = prompt('Edit Description:', msg.description);
                    if (newDescription === null) return;
                    messages[index] = { name: newName.trim(), description: newDescription.trim() };
                    Darbyon.saveMessages(messages);
                    renderMessages();
                }),
                button('Delete', 'danger', () => {
                    if (confirm('Are you sure you want to delete this news item?')) {
                        messages.splice(index, 1);
                        Darbyon.saveMessages(messages);
                        renderMessages();
                    }
                })
            ));
            tbody.appendChild(row);
        });
    }

    byId('messageForm').addEventListener('submit', event => {
        event.preventDefault();
        const messages = Darbyon.getMessages();
        messages.push({
            name: byId('messageName').value.trim(),
            description: byId('messageDescription').value.trim()
        });
        Darbyon.saveMessages(messages);
        byId('messageForm').reset();
        renderMessages();
    });

    // ---- Powers ----

    let editingPowerId = null;

    function showTeamFields() {
        const isTeam = byId('powerType').value === 'team';
        document.querySelectorAll('.team-only').forEach(field => { field.hidden = !isTeam; });
    }

    function resetPowerForm() {
        editingPowerId = null;
        byId('powerForm').reset();
        byId('powerFormTitle').textContent = 'Add New Power';
        byId('powerSubmit').textContent = 'Add Power';
        byId('powerCancel').hidden = true;
        showTeamFields();
    }

    function editPower(power) {
        editingPowerId = power.id;
        byId('powerName').value = power.name;
        byId('powerType').value = power.type;
        byId('powerApCost').value = power.apCost;
        byId('powerXp').value = power.xp;
        byId('powerHp').value = power.hp;
        byId('otherXp').value = power.otherXp;
        byId('otherAp').value = power.otherAp;
        byId('otherHp').value = power.otherHp;
        byId('powerFormTitle').textContent = 'Edit Power: ' + power.name;
        byId('powerSubmit').textContent = 'Save Power';
        byId('powerCancel').hidden = false;
        showTeamFields();
        byId('powerFormTitle').scrollIntoView({ behavior: 'smooth' });
        byId('powerName').focus();
    }

    function renderPowers() {
        const tbody = byId('powersTableBody');
        tbody.innerHTML = '';
        const powers = Darbyon.getPowers();
        if (!powers.length) {
            Darbyon.emptyRow(tbody, 9, 'No powers yet. Add the first one above.');
            return;
        }
        powers.forEach(power => {
            const isTeam = power.type === 'team';
            const row = document.createElement('tr');
            row.appendChild(el('td', power.name));
            row.appendChild(el('td', isTeam ? 'Team-Based' : 'Self-Directed'));
            row.appendChild(el('td', power.apCost, 'num'));
            row.appendChild(el('td', power.xp, 'num'));
            row.appendChild(el('td', power.hp, 'num'));
            row.appendChild(el('td', isTeam ? power.otherXp : '–', 'num'));
            row.appendChild(el('td', isTeam ? power.otherAp : '–', 'num'));
            row.appendChild(el('td', isTeam ? power.otherHp : '–', 'num'));
            row.appendChild(actionsCell(
                button('Edit', 'secondary', () => editPower(power)),
                button('Delete', 'danger', () => {
                    if (confirm('Are you sure you want to delete ' + power.name + '?')) {
                        Darbyon.deletePower(power.id);
                        if (editingPowerId === power.id) resetPowerForm();
                        renderPowers();
                    }
                })
            ));
            tbody.appendChild(row);
        });
    }

    byId('powerType').addEventListener('change', showTeamFields);
    byId('powerCancel').addEventListener('click', resetPowerForm);

    byId('powerForm').addEventListener('submit', event => {
        event.preventDefault();
        const name = byId('powerName').value.trim();
        if (!name) return;
        Darbyon.savePower({
            id: editingPowerId || undefined,
            name: name,
            type: byId('powerType').value,
            apCost: byId('powerApCost').value,
            xp: byId('powerXp').value,
            hp: byId('powerHp').value,
            otherXp: byId('otherXp').value,
            otherAp: byId('otherAp').value,
            otherHp: byId('otherHp').value
        });
        resetPowerForm();
        renderPowers();
    });

    // ---- Battle punishments ----

    function renderPunishments() {
        const tbody = byId('punishmentsTableBody');
        tbody.innerHTML = '';
        const punishments = Darbyon.getPunishments();
        if (!punishments.length) {
            Darbyon.emptyRow(tbody, 2, 'No punishments yet. The Battle wheel needs at least one.');
            return;
        }
        punishments.forEach((text, index) => {
            const row = document.createElement('tr');
            row.appendChild(el('td', text));
            row.appendChild(actionsCell(
                button('Edit', 'secondary', () => {
                    const newText = prompt('Edit Punishment:', text);
                    if (newText === null || newText.trim() === '') return;
                    punishments[index] = newText.trim();
                    Darbyon.savePunishments(punishments);
                    renderPunishments();
                }),
                button('Delete', 'danger', () => {
                    if (confirm('Delete "' + text + '" from the Battle wheel?')) {
                        punishments.splice(index, 1);
                        Darbyon.savePunishments(punishments);
                        renderPunishments();
                    }
                })
            ));
            tbody.appendChild(row);
        });
    }

    byId('punishmentForm').addEventListener('submit', event => {
        event.preventDefault();
        const text = byId('punishmentText').value.trim();
        if (!text) return;
        const punishments = Darbyon.getPunishments();
        punishments.push(text);
        Darbyon.savePunishments(punishments);
        byId('punishmentForm').reset();
        renderPunishments();
    });

    // ---- Backup and restore ----

    const backupNotice = byId('backupNotice');

    function showBackupNotice(text, kind) {
        backupNotice.textContent = text;
        backupNotice.className = 'notice ' + kind;
    }

    byId('backupButton').addEventListener('click', () => {
        const backup = Darbyon.exportData();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'darbcraft-backup-' + backup.exported.slice(0, 10) + '.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
        showBackupNotice('Backup downloaded: ' + backup.data.characters.length + ' players.', 'success');
    });

    byId('restoreButton').addEventListener('click', () => byId('restoreFile').click());

    byId('restoreFile').addEventListener('change', event => {
        const file = event.target.files[0];
        event.target.value = '';   // so the same file can be chosen again
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            let backup;
            try {
                backup = JSON.parse(reader.result);
            } catch (err) {
                showBackupNotice('That file could not be read as a backup.', 'error');
                return;
            }
            if (!backup || backup.app !== 'Darbyon' || !backup.data || !Array.isArray(backup.data.characters)) {
                showBackupNotice('This file is not a DårbCRÅFT backup.', 'error');
                return;
            }
            const count = backup.data.characters.length;
            if (!confirm('Replace everything on this computer with the backup (' + count +
                         ' players)? The current data will be lost.')) return;
            const error = Darbyon.importData(backup);
            if (error) {
                showBackupNotice(error, 'error');
                return;
            }
            renderAll();
            showBackupNotice('Backup restored: ' + count + ' players.', 'success');
        };
        reader.readAsText(file);
    });

    function renderAll() {
        renderCharacters();
        renderTeams();
        renderMessages();
        renderPowers();
        renderPunishments();
    }

    if (Darbyon.isServer()) {
        byId('backupHint').textContent = 'The class is saved on the DårbCRÅFT server, which also keeps its own ' +
            'daily copies. A backup downloaded here is an extra copy you can keep somewhere else.';
    }

    Darbyon.onChange(renderAll);
    resetPowerForm();
    renderAll();
});
