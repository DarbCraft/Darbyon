// My Character: students log in with their picture password, see their
// character, ask to use their powers, and vote in class polls.
Darbyon.ready(() => {
    const { el } = Darbyon;
    const main = document.getElementById('me');
    const title = document.getElementById('meTitle');

    function button(text, className, onClick) {
        const node = el('button', text, className);
        node.type = 'button';
        node.addEventListener('click', onClick);
        return node;
    }

    function message(text) {
        main.innerHTML = '';
        main.appendChild(el('p', text, 'panel me-message'));
    }

    if (!Darbyon.isServer()) {
        message('Students can log in to their own character when DårbCRÅFT runs on the class server.');
        return;
    }
    if (Darbyon.role() === 'teacher') {
        message('You are logged in as the teacher. Students open this page on their own devices, ' +
                'tap their name and then their three pictures.');
        return;
    }
    if (Darbyon.role() !== 'student') {
        showWhoAreYou();
        return;
    }

    // ---- Logging in ------------------------------------------------------

    function showWhoAreYou() {
        title.textContent = 'Who are you?';
        main.innerHTML = '';
        const players = Darbyon.getCharacters().slice().sort((a, b) => a.name.localeCompare(b.name));
        if (!players.length) {
            message('There are no players yet.');
            return;
        }
        const grid = el('div', null, 'who-grid');
        players.forEach(player => {
            const choice = button('', 'who-choice', () => showPictures(player));
            choice.appendChild(Darbyon.avatarImage(player));
            choice.appendChild(el('span', player.name));
            grid.appendChild(choice);
        });
        main.appendChild(grid);
    }

    function showPictures(player) {
        title.textContent = 'Hi ' + player.name + '!';
        main.innerHTML = '';
        const panel = el('section', null, 'panel picture-login');
        panel.appendChild(el('p', 'Tap your 3 teams in order.', 'picture-help'));

        const slots = el('div', null, 'picture-slots');
        const code = [];
        const drawSlots = () => {
            slots.innerHTML = '';
            for (let i = 0; i < 3; i++) {
                const picture = Darbyon.PICTURES[code[i]];
                const slot = el('span', null, 'picture-slot' + (picture ? ' filled' : ''));
                if (picture) {
                    slot.style.background = picture.colour;
                    slot.style.color = picture.text;
                    slot.appendChild(el('span', picture.emoji, 'slot-emoji'));
                    slot.appendChild(el('span', picture.name, 'slot-name'));
                }
                slots.appendChild(slot);
            }
        };
        drawSlots();
        panel.appendChild(slots);

        const notice = el('p', '', 'notice error');
        notice.setAttribute('role', 'alert');
        const pad = el('div', null, 'picture-pad');
        Darbyon.PICTURES.forEach((picture, index) => {
            const key = button('', 'picture-key', async () => {
                if (code.length >= 3) return;
                code.push(index);
                drawSlots();
                if (code.length < 3) return;
                pad.classList.add('waiting');
                const result = await Darbyon.studentLogin(player.id, code);
                if (result.ok) {
                    location.reload();
                    return;
                }
                notice.textContent = result.error;
                code.length = 0;
                drawSlots();
                pad.classList.remove('waiting');
                slots.classList.remove('shake');
                void slots.offsetWidth;          // restart the shake animation
                slots.classList.add('shake');
            });
            key.setAttribute('aria-label', picture.full);
            key.style.background = picture.colour;
            key.style.color = picture.text;
            key.appendChild(el('span', picture.emoji, 'picture-emoji'));
            key.appendChild(el('span', picture.name, 'picture-name'));
            pad.appendChild(key);
        });
        panel.appendChild(pad);
        panel.appendChild(notice);

        const actions = el('div', null, 'actions');
        actions.appendChild(button('Start Again', 'secondary', () => { code.length = 0; drawSlots(); notice.textContent = ''; }));
        actions.appendChild(button('That Is Not Me', 'soft', showWhoAreYou));
        panel.appendChild(actions);
        main.appendChild(panel);
    }

    // ---- The student's own character -------------------------------------

    let chosenPower = null;      // kept while the page redraws itself
    let chosenTarget = null;
    let notice = { text: '', kind: '' };
    const dismissed = new Set();

    function statTile(emoji, label, value, extra) {
        const tile = el('div', null, 'stat-tile');
        tile.appendChild(el('span', emoji, 'stat-emoji'));
        tile.appendChild(el('span', value, 'stat-value'));
        tile.appendChild(el('span', label + (extra ? ' · ' + extra : ''), 'stat-label'));
        return tile;
    }

    function celebrateLevel(character) {
        const key = 'darbyon-level-' + character.id;
        const level = Darbyon.getLevel(character.xp);
        let before = null;
        try { before = parseInt(localStorage.getItem(key), 10); localStorage.setItem(key, level); } catch (err) { /* storage off */ }
        if (!before || level <= before) return;
        const overlay = el('div', null, 'level-up');
        overlay.setAttribute('role', 'alert');
        const card = el('div', null, 'level-up-card');
        card.appendChild(el('p', '⭐ Level up! ⭐', 'level-up-title'));
        card.appendChild(el('p', 'You are now level ' + level + '!', 'level-up-text'));
        card.appendChild(button('Awesome!', '', () => overlay.remove()));
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    function render() {
        const info = Darbyon.me();
        if (!info || !info.character) {
            message('Your character could not be found. Ask your teacher.');
            return;
        }
        const me = info.character;
        title.textContent = me.name;
        main.innerHTML = '';

        // Character card
        const hero = el('section', null, 'panel hero');
        hero.appendChild(Darbyon.avatarImage(me, 'avatar-hero'));
        const about = el('div', null, 'hero-about');
        const tags = el('div', null, 'actions');
        tags.appendChild(Darbyon.typeTag(me.type));
        if (me.team) tags.appendChild(el('span', 'Team ' + me.team, 'tag'));
        about.appendChild(tags);

        const level = Darbyon.getLevel(me.xp);
        const levelRow = el('div', null, 'hero-level');
        levelRow.appendChild(Darbyon.levelBadge(me.xp));
        levelRow.appendChild(el('span', 'Level ' + level));
        about.appendChild(levelRow);

        const bar = el('div', null, 'xp-bar');
        const fill = el('div', null, 'xp-fill');
        const atTop = level >= Darbyon.MAX_LEVEL;
        const into = atTop ? Darbyon.XP_PER_LEVEL : me.xp - (level - 1) * Darbyon.XP_PER_LEVEL;
        fill.style.width = Math.round(100 * into / Darbyon.XP_PER_LEVEL) + '%';
        bar.appendChild(fill);
        bar.setAttribute('role', 'img');
        bar.setAttribute('aria-label', atTop ? 'Top level' : into + ' of ' + Darbyon.XP_PER_LEVEL + ' XP');
        about.appendChild(bar);
        about.appendChild(el('p', atTop ? 'You have reached the top level!'
            : (Darbyon.XP_PER_LEVEL - into) + ' XP to level ' + (level + 1), 'hint'));

        const stats = el('div', null, 'stat-row');
        stats.appendChild(statTile('🏅', 'XP', me.xp));
        stats.appendChild(statTile('💎', 'AP', me.ap));
        stats.appendChild(statTile('❤️', 'HP', me.hp, me.hp === 0 ? 'in Battle' : ''));
        about.appendChild(stats);
        hero.appendChild(about);
        main.appendChild(hero);
        celebrateLevel(me);

        // What happened to my last request
        const pending = info.requests.find(r => r.status === 'pending');
        const latest = info.requests.filter(r => r.status !== 'pending' && !dismissed.has(r.id)).pop();
        if (pending) {
            const box = el('section', null, 'panel request-status waiting');
            box.appendChild(el('p', '⏳ Waiting for your teacher to say yes to ' + pending.powerName +
                (pending.targetName ? ' on ' + pending.targetName : '') + '.'));
            box.appendChild(button('Cancel', 'secondary small', async () => {
                await Darbyon.cancelRequest();
                await Darbyon.refresh(true);
            }));
            main.appendChild(box);
        } else if (latest && Date.now() / 1000 - (latest.resolved || 0) < 15 * 60) {
            const approved = latest.status === 'approved';
            const box = el('section', null, 'panel request-status ' + (approved ? 'approved' : 'declined'));
            box.appendChild(el('p', approved ? '✅ ' + latest.powerName + ' worked!'
                : '❌ ' + latest.powerName + ' was not used this time.' + (latest.note ? ' ' + latest.note : '')));
            box.appendChild(button('OK', 'secondary small', () => { dismissed.add(latest.id); render(); }));
            main.appendChild(box);
        }

        // Class poll
        const poll = Darbyon.getPoll();
        if (poll && poll.open) {
            const box = el('section', null, 'panel poll-vote');
            box.appendChild(el('h2', '🗳️ ' + poll.question));
            const choices = el('div', null, 'poll-choices');
            poll.options.forEach((text, index) => {
                const choice = button(text, info.vote === index ? 'poll-choice chosen' : 'poll-choice secondary', async () => {
                    const result = await Darbyon.vote(poll.id, index);
                    if (!result.ok) notice = { text: result.error, kind: 'error' };
                    await Darbyon.refresh(true);
                });
                choice.setAttribute('aria-pressed', info.vote === index ? 'true' : 'false');
                choices.appendChild(choice);
            });
            box.appendChild(choices);
            box.appendChild(el('p', info.vote === null || info.vote === undefined
                ? 'Tap your answer.' : 'You voted. You can change your answer until the poll closes.', 'hint'));
            main.appendChild(box);
        }

        // Powers
        main.appendChild(el('h2', 'My Powers'));
        const powers = Darbyon.powersFor(me);
        const shown = el('p', notice.text, 'notice ' + notice.kind);
        shown.setAttribute('role', 'status');
        if (!powers.length) {
            main.appendChild(el('p', 'You do not have any powers yet.', 'panel me-message'));
            return;
        }
        if (chosenPower && !powers.some(p => p.id === chosenPower)) chosenPower = null;
        const teammates = Darbyon.getCharacters().filter(c => me.team && c.team === me.team && c.id !== me.id);

        const list = el('div', null, 'power-grid');
        powers.forEach(power => {
            const isTeam = power.type === 'team';
            const enough = me.ap >= power.apCost;
            const card = el('div', null, 'power-card' + (chosenPower === power.id ? ' chosen' : ''));
            card.appendChild(el('h3', power.name));
            card.appendChild(el('p', power.apCost + ' AP', 'power-cost'));
            card.appendChild(el('p', 'You: ' + Darbyon.describeEffect(power.xp, 0, power.hp)));
            if (isTeam) card.appendChild(el('p', 'Teammate: ' + Darbyon.describeEffect(power.otherXp, power.otherAp, power.otherHp)));
            let reason = '';
            if (pending) reason = 'Wait for your teacher first';
            else if (!enough) reason = 'You need ' + (power.apCost - me.ap) + ' more AP';
            else if (isTeam && !teammates.length) reason = 'You need a teammate for this';
            const choose = button(reason || (chosenPower === power.id ? 'Chosen' : 'Choose'),
                                  chosenPower === power.id ? '' : 'secondary', () => {
                chosenPower = power.id;
                chosenTarget = null;
                notice = { text: '', kind: '' };
                render();
            });
            choose.disabled = !!reason;
            card.appendChild(choose);
            list.appendChild(card);
        });
        main.appendChild(list);

        const power = powers.find(p => p.id === chosenPower);
        if (power && !pending) {
            const box = el('section', null, 'panel use-power');
            if (power.type === 'team') {
                box.appendChild(el('h2', 'Who gets ' + power.name + '?'));
                const grid = el('div', null, 'who-grid small');
                teammates.forEach(mate => {
                    const choice = button('', 'who-choice' + (chosenTarget === mate.id ? ' chosen' : ''), () => {
                        chosenTarget = mate.id;
                        render();
                    });
                    choice.setAttribute('aria-pressed', chosenTarget === mate.id ? 'true' : 'false');
                    choice.appendChild(Darbyon.avatarImage(mate));
                    choice.appendChild(el('span', mate.name));
                    grid.appendChild(choice);
                });
                box.appendChild(grid);
            }
            const target = teammates.find(m => m.id === chosenTarget);
            const ready = power.type !== 'team' || target;
            const ask = button(ready ? 'Ask to use ' + power.name + (target ? ' on ' + target.name : '')
                                     : 'Choose a teammate first', '', async () => {
                ask.disabled = true;
                const result = await Darbyon.requestPower(power.id, chosenTarget);
                notice = result.ok ? { text: 'Sent! Your teacher will see it now.', kind: 'success' }
                                   : { text: result.error, kind: 'error' };
                if (result.ok) chosenPower = chosenTarget = null;
                await Darbyon.refresh(true);
                render();
            });
            ask.disabled = !ready;
            const actions = el('div', null, 'actions');
            actions.appendChild(ask);
            actions.appendChild(button('Cancel', 'soft', () => { chosenPower = chosenTarget = null; render(); }));
            box.appendChild(actions);
            main.appendChild(box);
        }
        main.appendChild(shown);
    }

    Darbyon.onChange(render, { poll: true, every: 4000 });
    render();
});
