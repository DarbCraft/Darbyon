// Home page: the class table and the random player picker.
Darbyon.ready(() => {
    const { el } = Darbyon;
    const tbody = document.querySelector('#playerTable tbody');
    const playerName = document.getElementById('playerName');
    const counter = document.getElementById('selectionCounter');

    function renderTable() {
        Darbyon.announceLevelUps();
        tbody.innerHTML = '';
        const players = Darbyon.getCharacters();
        if (!players.length) {
            Darbyon.emptyRow(tbody, 6, 'No players yet. Add them on the Settings page.');
            return;
        }
        players.forEach(player => {
            const row = document.createElement('tr');
            if (player.hp === 0) row.className = 'fallen';
            row.appendChild(Darbyon.nameCell(player));
            row.appendChild(Darbyon.cell(Darbyon.typeTag(player.type)));
            row.appendChild(Darbyon.cell(Darbyon.levelBadge(player.xp)));
            row.appendChild(el('td', player.xp, 'num'));
            row.appendChild(el('td', player.ap, 'num'));
            row.appendChild(el('td', player.hp, 'num'));
            tbody.appendChild(row);
        });
    }

    function showCounter(progress) {
        counter.textContent = progress.shown + '/' + progress.total;
    }

    document.getElementById('pickRandomPlayerButton').addEventListener('click', () => {
        const result = Darbyon.pickPlayer();
        if (!result) {
            playerName.textContent = 'No players available.';
            return;
        }
        playerName.textContent = '';
        playerName.appendChild(Darbyon.avatarImage(result.player, 'avatar-big'));
        playerName.appendChild(document.createTextNode(result.player.name));
        showCounter(result);
    });

    document.getElementById('resetPickerButton').addEventListener('click', () => {
        Darbyon.resetPicker();
        playerName.textContent = 'None';
        showCounter(Darbyon.pickerProgress());
    });

    // ---- Wheel of Destiny: one random event a day ----

    const destinyBody = document.getElementById('destinyBody');
    let spinning = false;

    function outcome(event) {
        if (event.who === 'none' || !event.amount) return '';
        const change = (event.amount > 0 ? '+' : '') + event.amount + ' ' + event.stat.toUpperCase();
        if (event.who === 'all') return change + ' for everyone';
        if (event.who === 'team') return event.chosen ? change + ' for each player in team ' + event.chosen : 'No teams to choose from';
        return event.chosen ? change + ' for ' + event.chosen : 'No players to choose from';
    }

    function showEvent(event) {
        destinyBody.innerHTML = '';
        const card = el('div', null, 'destiny-card kind-' + event.kind);
        const top = el('div', null, 'destiny-top');
        top.appendChild(Darbyon.iconText(Darbyon.EVENT_ICONS[event.kind] || 'game', Darbyon.EVENT_KINDS[event.kind] || '', 'span', 'tag destiny-kind'));
        top.appendChild(el('span', 'Today', 'destiny-date'));
        card.appendChild(top);
        card.appendChild(el('p', event.name, 'destiny-name'));
        card.appendChild(el('p', event.text, 'destiny-text'));
        const result = outcome(event);
        if (result) card.appendChild(el('p', result, 'destiny-outcome'));
        if (Darbyon.role() === 'teacher') {
            const notice = el('p', '', 'notice error');
            notice.setAttribute('role', 'alert');
            const undo = el('button', 'Undo this spin', 'soft small destiny-undo');
            undo.type = 'button';
            undo.addEventListener('click', () => {
                const done = Darbyon.undoSpin();
                if (!done.ok) {
                    notice.textContent = done.error;
                    return;
                }
                renderTable();
                renderDestiny();
            });
            card.appendChild(undo);
            card.appendChild(notice);
        }
        destinyBody.appendChild(card);
    }

    function renderDestiny() {
        if (spinning) return;
        const today = Darbyon.todaysEvent();
        if (today) {
            showEvent(today);
            return;
        }
        destinyBody.innerHTML = '';
        if (Darbyon.role() !== 'teacher') {
            destinyBody.appendChild(el('p', 'The wheel has not been spun yet today. Your teacher spins it once a day.', 'destiny-wait'));
            return;
        }
        const events = Darbyon.getEvents();
        if (!events.length) {
            destinyBody.appendChild(el('p', 'There are no events on the wheel. Add some on the Settings page.', 'hint'));
            return;
        }
        const layout = el('div', null, 'destiny-spin');
        const holder = el('div', null, 'wheel-holder destiny-wheel');
        holder.appendChild(el('div', null, 'wheel-pointer'));
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 720;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Wheel of Destiny with ' + events.length + ' events');
        holder.appendChild(canvas);
        Darbyon.Wheel.draw(canvas, events.map(e => e.name));
        const side = el('div', null, 'destiny-side');
        side.appendChild(el('p', 'Spin once a day to see what destiny has in store for the class.'));
        const go = el('button', 'Spin the Wheel of Destiny');
        go.type = 'button';
        go.addEventListener('click', () => {
            const spin = Darbyon.spinDestiny();
            if (!spin) return;
            spinning = true;
            go.disabled = true;
            Darbyon.Wheel.spinTo(canvas, spin.index, events.length, () => {
                spinning = false;
                renderTable();
                showEvent(spin.event);
                Darbyon.Battle.start(spin.fallen);
            });
        });
        side.appendChild(go);
        layout.appendChild(holder);
        layout.appendChild(side);
        destinyBody.appendChild(layout);
    }

    Darbyon.onChange(() => {
        renderDestiny();
        renderTable();
        showCounter(Darbyon.pickerProgress());
    }, { poll: true });

    renderDestiny();
    renderTable();
    const progress = Darbyon.pickerProgress();
    showCounter(progress);
    if (!progress.total) playerName.textContent = 'No players available.';
});
