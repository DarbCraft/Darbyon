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
        renderCodes();      // the picture password list shows the same students
        renderSignup();
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
                button('Powers', 'soft', () => choosePowers(char)),
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

    // ---- Which powers a player has ----

    let powersDialog = null;

    function choosePowers(char) {
        if (!powersDialog) {
            powersDialog = document.createElement('dialog');
            powersDialog.className = 'avatar-picker';
            document.body.appendChild(powersDialog);
        }
        powersDialog.innerHTML = '';
        powersDialog.appendChild(el('h2', 'Powers for ' + char.name));
        const powers = Darbyon.getPowers();
        powersDialog.appendChild(el('p', powers.length
            ? 'Tick the powers this player has. With none ticked they can use every power.'
            : 'There are no powers yet. Add some further down this page.', 'hint'));
        const boxes = [];
        powers.forEach(power => {
            const label = el('label', null, 'check');
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.value = power.id;
            box.checked = char.powers.indexOf(power.id) !== -1;
            boxes.push(box);
            label.appendChild(box);
            label.appendChild(document.createTextNode(' ' + power.name + ' (' + power.apCost + ' AP)'));
            powersDialog.appendChild(label);
        });
        const actions = el('div', null, 'actions');
        const save = el('button', 'Save');
        save.type = 'button';
        save.addEventListener('click', () => {
            Darbyon.updateCharacter(char.id, { powers: boxes.filter(b => b.checked).map(b => b.value) });
            powersDialog.close();
            renderCharacters();
        });
        const cancel = el('button', 'Cancel', 'soft');
        cancel.type = 'button';
        cancel.addEventListener('click', () => powersDialog.close());
        actions.appendChild(save);
        actions.appendChild(cancel);
        powersDialog.appendChild(actions);
        powersDialog.showModal();
    }

    // ---- Add many students ----

    Object.keys(Darbyon.CLASSES).forEach(type => byId('importDefaultType').appendChild(option(type, type)));
    const importNotice = byId('importNotice');
    let importDialog = null;

    function showImportNotice(text, kind) {
        importNotice.textContent = text;
        importNotice.className = 'notice ' + kind;
    }

    function previewImport(rows) {
        const result = Darbyon.Import.plan(rows, { defaultType: byId('importDefaultType').value });
        if (result.error) {
            showImportNotice(result.error, 'error');
            return;
        }
        if (!result.students.length) {
            showImportNotice('No students were found in that list.', 'error');
            return;
        }
        showImportNotice('', '');
        const existing = Darbyon.getCharacters();
        const existingNames = existing.map(c => c.name.toLowerCase());
        const powers = Darbyon.getPowers();

        if (!importDialog) {
            importDialog = document.createElement('dialog');
            importDialog.className = 'avatar-picker import-preview';
            document.body.appendChild(importDialog);
        }
        importDialog.innerHTML = '';
        importDialog.appendChild(el('h2', 'Check these ' + result.students.length + ' students'));

        const wrap = el('div', null, 'table-wrap');
        const table = document.createElement('table');
        const head = document.createElement('tr');
        ['Name', 'Class', 'First power', 'Team', 'Notes'].forEach(text => head.appendChild(el('th', text)));
        const thead = document.createElement('thead');
        thead.appendChild(head);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        const noteCells = [];
        result.students.forEach(student => {
            const row = document.createElement('tr');
            row.appendChild(Darbyon.nameCell(student));
            row.appendChild(Darbyon.cell(Darbyon.typeTag(student.type)));
            row.appendChild(el('td', student.powers.map(id => (powers.find(p => p.id === id) || {}).name).join(', ') || '–'));
            row.appendChild(el('td', student.team || '–'));
            const noteCell = el('td', '', 'import-notes');
            noteCells.push(noteCell);
            row.appendChild(noteCell);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        importDialog.appendChild(wrap);

        const replaceLabel = el('label', null, 'check');
        const replaceBox = document.createElement('input');
        replaceBox.type = 'checkbox';
        replaceLabel.appendChild(replaceBox);
        replaceLabel.appendChild(document.createTextNode(' Remove the ' + existing.length + ' existing characters first'));
        if (existing.length) importDialog.appendChild(replaceLabel);

        const actions = el('div', null, 'actions');
        const confirmButton = el('button', '');
        confirmButton.type = 'button';
        const cancel = el('button', 'Cancel', 'soft');
        cancel.type = 'button';
        cancel.addEventListener('click', () => importDialog.close());
        actions.appendChild(confirmButton);
        actions.appendChild(cancel);
        importDialog.appendChild(actions);

        // Students already in the class are skipped unless the class is being replaced.
        function refresh() {
            let adding = 0;
            result.students.forEach((student, index) => {
                const clash = !replaceBox.checked && existingNames.indexOf(student.name.toLowerCase()) !== -1;
                if (!clash) adding++;
                noteCells[index].textContent = (clash ? ['Already in the class, will be skipped'] : student.notes).join('. ');
            });
            confirmButton.textContent = 'Add ' + adding + (adding === 1 ? ' Student' : ' Students');
            confirmButton.disabled = adding === 0;
        }
        replaceBox.addEventListener('change', refresh);
        refresh();

        confirmButton.addEventListener('click', () => {
            if (replaceBox.checked && !confirm('This deletes all ' + existing.length +
                    ' existing characters and their XP, AP and HP. Continue?')) return;
            const added = Darbyon.importCharacters(result.students, replaceBox.checked);
            importDialog.close();
            byId('importText').value = '';
            renderAll();
            showImportNotice(added + (added === 1 ? ' student added.' : ' students added.'), 'success');
        });
        importDialog.showModal();
    }

    byId('importPreviewButton').addEventListener('click', () => {
        previewImport(Darbyon.Import.parseText(byId('importText').value));
    });
    byId('importFileButton').addEventListener('click', () => byId('importFile').click());
    byId('importFile').addEventListener('change', async event => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        try {
            previewImport(await Darbyon.Import.readFile(file));
        } catch (err) {
            showImportNotice('That file could not be read. ' + (err && err.message ? err.message : ''), 'error');
        }
    });

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
        const type = byId('powerType').value;
        const special = type === 'team' ? byId('powerSpecial').value : '';
        document.querySelectorAll('.team-only').forEach(field => { field.hidden = type !== 'team'; });
        // Protect has no stat change for the teammate; Revive only sets their HP.
        document.querySelectorAll('.others-only').forEach(field => {
            field.hidden = type === 'self' || special === 'protect' || (special === 'revive' && !field.contains(byId('otherHp')));
        });
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
        byId('powerClass').value = power.class;
        byId('powerLevel').value = power.level;
        byId('powerType').value = power.type;
        byId('powerApCost').value = power.apCost;
        byId('powerXp').value = power.xp;
        byId('powerHp').value = power.hp;
        byId('powerSpecial').value = power.special;
        byId('otherXp').value = power.otherXp;
        byId('otherAp').value = power.otherAp;
        byId('otherHp').value = power.otherHp;
        byId('powerReward').value = power.reward;
        byId('powerAbout').value = power.about;
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
            Darbyon.emptyRow(tbody, 7, 'No powers yet. Add the Power Pack or make your own above.');
            return;
        }
        const order = { '': 0, Warrior: 1, Healer: 2, Mage: 3 };
        powers.slice().sort((a, b) => order[a.class] - order[b.class] || a.level - b.level).forEach(power => {
            const row = document.createElement('tr');
            row.appendChild(el('td', power.name));
            row.appendChild(power.class ? Darbyon.cell(Darbyon.typeTag(power.class)) : el('td', 'Any'));
            row.appendChild(el('td', power.level, 'num'));
            row.appendChild(el('td', Darbyon.REACH[power.type]));
            row.appendChild(el('td', power.apCost, 'num'));
            const what = el('td', null, 'power-what');
            const lines = Darbyon.describePower(power);
            (lines.length ? lines : ['No effect']).forEach(line => what.appendChild(el('span', line)));
            row.appendChild(what);
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
    byId('powerSpecial').addEventListener('change', showTeamFields);
    byId('powerCancel').addEventListener('click', resetPowerForm);

    byId('powerPackButton').addEventListener('click', () => {
        const added = Darbyon.addPowerPack();
        const notice = byId('powerPackNotice');
        notice.textContent = added ? 'Added ' + added + ' powers. Scroll down to see them, and change any levels or costs to suit your class.'
                                   : 'You already have every power in the pack.';
        notice.className = 'notice ' + (added ? 'success' : '');
        renderPowers();
    });

    byId('powerForm').addEventListener('submit', event => {
        event.preventDefault();
        const name = byId('powerName').value.trim();
        if (!name) return;
        const type = byId('powerType').value;
        const special = type === 'team' ? byId('powerSpecial').value : '';
        const keepOthers = type !== 'self' && special !== 'protect';
        Darbyon.savePower({
            id: editingPowerId || undefined,
            name: name,
            class: byId('powerClass').value,
            level: byId('powerLevel').value,
            type: type,
            special: special,
            apCost: byId('powerApCost').value,
            xp: byId('powerXp').value,
            hp: byId('powerHp').value,
            otherXp: keepOthers && special !== 'revive' ? byId('otherXp').value : 0,
            otherAp: keepOthers && special !== 'revive' ? byId('otherAp').value : 0,
            otherHp: keepOthers ? byId('otherHp').value : 0,
            reward: byId('powerReward').value,
            about: byId('powerAbout').value
        });
        resetPowerForm();
        renderPowers();
    });

    // ---- Wheel of Destiny ----

    let editingEventId = null;

    function showEventFields() {
        document.querySelectorAll('.event-stat').forEach(f => { f.hidden = byId('eventWho').value === 'none'; });
    }

    function resetEventForm() {
        editingEventId = null;
        byId('eventForm').reset();
        byId('eventFormTitle').textContent = 'Add New Event';
        byId('eventSubmit').textContent = 'Add Event';
        byId('eventCancel').hidden = true;
        showEventFields();
    }

    function eventStats(event) {
        if (event.who === 'none' || !event.amount) return '–';
        const change = (event.amount > 0 ? '+' : '') + event.amount + ' ' + event.stat.toUpperCase();
        return change + ' ' + { all: 'everyone', one: 'one player', team: 'one team' }[event.who];
    }

    function renderEvents() {
        const today = Darbyon.todaysEvent();
        byId('destinyToday').textContent = today ? 'Today the wheel landed on ' + today.name + '.'
                                                 : 'The wheel has not been spun today.';
        byId('destinyClear').hidden = !today;
        const tbody = byId('eventsTableBody');
        tbody.innerHTML = '';
        const events = Darbyon.getEvents();
        if (!events.length) {
            Darbyon.emptyRow(tbody, 5, 'No events yet. The wheel needs at least one.');
            return;
        }
        events.forEach((event, index) => {
            const row = document.createElement('tr');
            row.appendChild(el('td', event.name));
            row.appendChild(el('td', Darbyon.EVENT_KINDS[event.kind]));
            row.appendChild(el('td', event.text));
            row.appendChild(el('td', eventStats(event)));
            row.appendChild(actionsCell(
                button('Edit', 'secondary', () => {
                    editingEventId = event.id;
                    byId('eventName').value = event.name;
                    byId('eventKind').value = event.kind;
                    byId('eventWho').value = event.who;
                    byId('eventStat').value = event.stat;
                    byId('eventAmount').value = event.amount;
                    byId('eventText').value = event.text;
                    byId('eventFormTitle').textContent = 'Edit Event: ' + event.name;
                    byId('eventSubmit').textContent = 'Save Event';
                    byId('eventCancel').hidden = false;
                    showEventFields();
                    byId('eventFormTitle').scrollIntoView({ behavior: 'smooth' });
                }),
                button('Delete', 'danger', () => {
                    if (!confirm('Delete "' + event.name + '" from the Wheel of Destiny?')) return;
                    events.splice(index, 1);
                    Darbyon.saveEvents(events);
                    if (editingEventId === event.id) resetEventForm();
                    renderEvents();
                })
            ));
            tbody.appendChild(row);
        });
    }

    byId('eventWho').addEventListener('change', showEventFields);
    byId('eventCancel').addEventListener('click', resetEventForm);
    byId('destinyClear').addEventListener('click', () => {
        if (!confirm('Clear today\'s event so you can spin again? Any stats it changed stay changed (use Undo on Update Values to reverse them).')) return;
        Darbyon.clearTodaysEvent();
        renderEvents();
    });
    byId('eventForm').addEventListener('submit', event => {
        event.preventDefault();
        const events = Darbyon.getEvents();
        const entry = {
            id: editingEventId || undefined,
            name: byId('eventName').value,
            kind: byId('eventKind').value,
            who: byId('eventWho').value,
            stat: byId('eventStat').value,
            amount: byId('eventAmount').value,
            text: byId('eventText').value
        };
        const index = events.findIndex(e => e.id === editingEventId);
        if (index === -1) events.push(entry); else events[index] = Object.assign(entry, { id: editingEventId });
        Darbyon.saveEvents(events);
        resetEventForm();
        renderEvents();
    });

    // ---- Quick Damage ----

    function renderDamages() {
        const tbody = byId('damagesTableBody');
        tbody.innerHTML = '';
        const damages = Darbyon.getDamages();
        if (!damages.length) {
            Darbyon.emptyRow(tbody, 3, 'No reasons yet.');
            return;
        }
        damages.forEach((damage, index) => {
            const row = document.createElement('tr');
            row.appendChild(el('td', damage.text));
            row.appendChild(el('td', '−' + damage.hp, 'num'));
            row.appendChild(actionsCell(
                button('Edit', 'secondary', () => {
                    const text = prompt('Reason:', damage.text);
                    if (text === null || !text.trim()) return;
                    const hp = parseInt(prompt('HP lost:', damage.hp), 10);
                    if (!(hp > 0)) return;
                    damages[index] = { id: damage.id, text: text.trim(), hp: hp };
                    Darbyon.saveDamages(damages);
                    renderDamages();
                }),
                button('Delete', 'danger', () => {
                    if (!confirm('Delete "' + damage.text + '"?')) return;
                    damages.splice(index, 1);
                    Darbyon.saveDamages(damages);
                    renderDamages();
                })
            ));
            tbody.appendChild(row);
        });
    }

    byId('damageForm').addEventListener('submit', event => {
        event.preventDefault();
        const text = byId('damageText').value.trim();
        const hp = parseInt(byId('damageHp').value, 10);
        if (!text || !(hp > 0)) return;
        const damages = Darbyon.getDamages();
        damages.push({ text: text, hp: hp });
        Darbyon.saveDamages(damages);
        byId('damageForm').reset();
        renderDamages();
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

    // ---- Student sign-up ----

    function renderSignup() {
        const on = Darbyon.signupIsOpen();
        const toggle = byId('signupSwitch');
        toggle.textContent = on ? 'On' : 'Off';
        toggle.setAttribute('aria-checked', on ? 'true' : 'false');
        toggle.disabled = !Darbyon.isServer();
        if (!Darbyon.isServer()) toggle.title = 'Sign-up needs DårbCRÅFT running on the class server.';
    }
    byId('signupSwitch').addEventListener('click', () => {
        Darbyon.setSignup(!Darbyon.signupIsOpen());
        renderSignup();
    });

    // ---- Student logins ----

    function pictureText(code) {
        return code.map(i => Darbyon.PICTURES[i].full).join('  →  ');
    }

    function renderCodes() {
        const tbody = byId('codesTableBody');
        tbody.innerHTML = '';
        const characters = Darbyon.getCharacters();
        const missing = characters.filter(c => !Darbyon.pictureCodeFor(c.id)).length;
        byId('makeCodesButton').textContent = missing
            ? 'Make Picture Passwords for ' + missing + (missing === 1 ? ' Student' : ' Students')
            : 'Everyone Has a Picture Password';
        byId('makeCodesButton').disabled = !missing;
        if (!characters.length) {
            Darbyon.emptyRow(tbody, 3, 'No students yet.');
            return;
        }
        characters.forEach(char => {
            const code = Darbyon.pictureCodeFor(char.id);
            const row = document.createElement('tr');
            row.appendChild(Darbyon.nameCell(char));
            row.appendChild(el('td', code ? pictureText(code) : 'None yet', code ? 'picture-code' : 'empty'));
            row.appendChild(actionsCell(button(code ? 'New Pictures' : 'Make Pictures', 'soft', () => {
                if (code && !confirm('Give ' + char.name + ' new pictures? Their old ones will stop working.')) return;
                Darbyon.makePictureCodes([char.id]);
                renderCodes();
            })));
            tbody.appendChild(row);
        });
    }

    byId('makeCodesButton').addEventListener('click', () => {
        const made = Darbyon.makePictureCodes();
        renderCodes();
        byId('codesNotice').textContent = made + (made === 1 ? ' picture password made.' : ' picture passwords made.');
        byId('codesNotice').className = 'notice success';
    });

    byId('printCardsButton').addEventListener('click', () => {
        const holder = byId('printCards');
        holder.innerHTML = '';
        const address = location.origin + location.pathname.replace(/[^/]*$/, '') + 'me.html';
        Darbyon.getCharacters().forEach(char => {
            const code = Darbyon.pictureCodeFor(char.id);
            if (!code) return;
            const card = el('div', null, 'login-card');
            const top = el('div', null, 'who');
            top.appendChild(Darbyon.avatarImage(char));
            top.appendChild(el('strong', char.name));
            card.appendChild(top);
            const pictures = el('div', null, 'login-card-pictures');
            code.forEach((i, n) => {
                const picture = Darbyon.PICTURES[i];
                const pic = el('div', null, 'login-card-picture');
                pic.appendChild(el('span', String(n + 1), 'login-card-step'));
                const tile = el('span', null, 'login-card-tile');
                tile.style.background = picture.colour;
                tile.style.color = picture.text;
                tile.appendChild(Darbyon.iconText(picture.sport, '', 'span', 'login-card-emoji'));
                tile.appendChild(el('span', picture.name));
                pic.appendChild(tile);
                pictures.appendChild(pic);
            });
            card.appendChild(pictures);
            card.appendChild(el('p', 'Go to ' + address + ', tap your name, then tap these teams in order.', 'login-card-help'));
            holder.appendChild(card);
        });
        if (!holder.children.length) {
            alert('Make picture passwords first.');
            return;
        }
        document.body.classList.add('printing-cards');
        window.print();
        document.body.classList.remove('printing-cards');
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
        renderEvents();
        renderDamages();
    }

    if (Darbyon.isServer()) {
        byId('backupHint').textContent = 'The class is saved on the DårbCRÅFT server, which also keeps its own ' +
            'daily copies. A backup downloaded here is an extra copy you can keep somewhere else.';
    }

    // New students may sign up while this page is open, so keep up with them.
    Darbyon.onChange(renderAll, { poll: Darbyon.isServer(), every: 8000 });
    // ---- Tabs ----
    // The last tab used is remembered on this device. A link like
    // settings.html#powers opens that tab.

    const TAB_KEY = 'darbyon-settings-tab';
    const tabButtons = Array.from(document.querySelectorAll('.tabs [data-tab]'));

    function showTab(name) {
        if (!tabButtons.some(b => b.dataset.tab === name)) name = 'players';
        tabButtons.forEach(b => {
            b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false');
            b.tabIndex = b.dataset.tab === name ? 0 : -1;
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.hidden = name !== 'all' && panel.dataset.tab !== name;
        });
        try { localStorage.setItem(TAB_KEY, name); } catch (err) { /* private browsing */ }
    }

    tabButtons.forEach((b, i) => {
        b.addEventListener('click', () => showTab(b.dataset.tab));
        b.addEventListener('keydown', event => {
            const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
            if (!step) return;
            const next = tabButtons[(i + step + tabButtons.length) % tabButtons.length];
            next.focus();
            showTab(next.dataset.tab);
        });
    });

    let firstTab = location.hash.slice(1);
    if (!firstTab) {
        try { firstTab = localStorage.getItem(TAB_KEY); } catch (err) { firstTab = ''; }
    }
    showTab(firstTab || 'players');

    resetPowerForm();
    resetEventForm();
    renderAll();
});
