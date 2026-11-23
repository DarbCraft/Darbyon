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
        const fresh = newPlayerButton();
        if (fresh) main.appendChild(fresh);
        if (!players.length) {
            main.appendChild(el('p', fresh ? 'Nobody has made a character yet. Be the first!' : 'There are no players yet.', 'panel me-message'));
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

    function newPlayerButton() {
        if (!Darbyon.signupIsOpen()) return null;
        const box = el('div', null, 'panel new-player');
        box.appendChild(el('p', 'Not on the list yet?'));
        const fresh = button('', '', () => startSignup());
        fresh.appendChild(Darbyon.iconText('sparkle', 'I am new: make my character'));
        box.appendChild(fresh);
        return box;
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
                    slot.appendChild(Darbyon.iconText(picture.sport, '', 'span', 'slot-emoji'));
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
            key.appendChild(Darbyon.iconText(picture.sport, '', 'span', 'picture-emoji'));
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

    // ---- New students make their own character ---------------------------

    function startSignup() {
        const CLASS_INFO = {
            Mage: 'Uses magic. Has the most AP for powers, but the least HP.',
            Warrior: 'Strong and tough. Has the most HP.',
            Healer: 'Looks after the team. Good HP and AP.'
        };
        const answers = { first: '', initial: '', type: '', avatar: '', powerId: '', code: [] };
        // First powers: ones any level 1 player of the chosen class can use.
        const starters = type => Darbyon.getPowers().filter(p => p.level <= 1 && (!p.class || p.class === type));
        const hasStarters = Object.keys(Darbyon.CLASSES).some(type => starters(type).length);
        let powers = [];
        let steps = [];
        const setSteps = () => {
            powers = answers.type ? starters(answers.type) : [];
            steps = ['name', 'initial', 'class', 'avatar']
                .concat((answers.type ? powers.length : hasStarters) ? ['power'] : [], ['code', 'check', 'done']);
        };
        setSteps();
        let step = 0;
        let checking = [];
        const taken = name => Darbyon.getCharacters().some(c => c.name.toLowerCase() === name.toLowerCase());
        const fullName = () => answers.first + ' ' + answers.initial + '.';

        function frame(heading, help) {
            title.textContent = 'New Player';
            main.innerHTML = '';
            const panel = el('section', null, 'panel signup');
            const dots = el('div', null, 'signup-dots');
            steps.forEach((s, i) => dots.appendChild(el('span', '', 'dot' + (i < step ? ' done' : i === step ? ' now' : ''))));
            dots.setAttribute('aria-label', 'Step ' + (step + 1) + ' of ' + steps.length);
            panel.appendChild(dots);
            panel.appendChild(el('h2', heading));
            if (help) panel.appendChild(el('p', help, 'hint'));
            main.appendChild(panel);
            return panel;
        }

        function navigation(panel, canGoOn, nextText, onNext) {
            const notice = el('p', '', 'notice error');
            notice.setAttribute('role', 'alert');
            const actions = el('div', null, 'actions signup-actions');
            actions.appendChild(button(step === 0 ? 'Cancel' : 'Back', 'secondary', () => {
                if (step === 0) { showWhoAreYou(); return; }
                step--;
                if (steps[step] === 'check') step--;      // going back from the summary re-does the code
                draw();
            }));
            const next = button(nextText || 'Next', '', onNext || (() => { step++; draw(); }));
            next.disabled = !canGoOn;
            actions.appendChild(next);
            panel.appendChild(notice);
            panel.appendChild(actions);
            return { next: next, notice: notice };
        }

        function pickGrid(className) {
            return el('div', null, className);
        }

        function draw() {
            const kind = steps[step];

            if (kind === 'name') {
                const panel = frame('What is your first name?');
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 20;
                input.autocomplete = 'off';
                input.autocapitalize = 'words';
                input.className = 'signup-input';
                input.setAttribute('aria-label', 'First name');
                input.value = answers.first;
                panel.appendChild(input);
                const nav = navigation(panel, false);
                const check = () => {
                    const text = input.value.trim().replace(/\s+/g, ' ');
                    const ok = text.length > 0 && /^[\p{L}' -]+$/u.test(text);
                    answers.first = ok ? text.charAt(0).toUpperCase() + text.slice(1) : '';
                    nav.next.disabled = !ok;
                    nav.notice.textContent = text && !ok ? 'Use letters only.' : '';
                };
                input.addEventListener('input', check);
                input.addEventListener('keydown', e => { if (e.key === 'Enter' && !nav.next.disabled) nav.next.click(); });
                check();
                input.focus();
            }

            if (kind === 'initial') {
                const panel = frame('What letter does your last name start with?', 'This tells apart two students with the same first name.');
                const grid = pickGrid('letter-grid');
                const preview = el('p', '', 'signup-preview');
                let nav;
                const choose = letter => {
                    answers.initial = letter;
                    grid.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.textContent === letter ? 'true' : 'false'));
                    const clash = taken(fullName());
                    preview.textContent = clash ? 'There is already a ' + fullName() + ' in the class. If that is you, go back and log in. If not, ask your teacher.'
                                                : 'You will be called ' + fullName();
                    preview.classList.toggle('clash', clash);
                    nav.next.disabled = clash;
                };
                'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => grid.appendChild(button(letter, 'letter', () => choose(letter))));
                panel.appendChild(grid);
                panel.appendChild(preview);
                nav = navigation(panel, false);
                if (answers.initial) choose(answers.initial);
            }

            if (kind === 'class') {
                const panel = frame('Choose your class');
                const grid = pickGrid('class-grid');
                Object.keys(Darbyon.CLASSES).forEach((type, i) => {
                    const stats = Darbyon.CLASSES[type];
                    const card = button('', 'class-card', () => {
                        if (answers.type !== type) { answers.avatar = ''; answers.powerId = ''; }
                        answers.type = type;
                        setSteps();
                        step++;
                        draw();
                    });
                    card.setAttribute('aria-pressed', answers.type === type ? 'true' : 'false');
                    card.appendChild(Darbyon.avatarImage({ avatar: type.toLowerCase() + (i % 2 ? '-f1' : '-m1') }, 'avatar-big'));
                    card.appendChild(el('strong', type));
                    card.appendChild(el('span', CLASS_INFO[type] || '', 'class-text'));
                    const statLine = el('span', null, 'class-stats');
                    statLine.appendChild(Darbyon.iconText('heart', stats.hp + ' HP'));
                    statLine.appendChild(Darbyon.iconText('gem', stats.ap + ' AP'));
                    card.appendChild(statLine);
                    grid.appendChild(card);
                });
                panel.appendChild(grid);
                navigation(panel, !!answers.type);
            }

            if (kind === 'avatar') {
                const panel = frame('Choose your avatar');
                const grid = pickGrid('signup-avatars');
                (Darbyon.AVATARS[answers.type] || []).forEach((avatar, i) => {
                    const choice = button('', 'avatar-option', () => { answers.avatar = avatar; step++; draw(); });
                    choice.setAttribute('aria-label', answers.type + ' avatar ' + (i + 1));
                    choice.setAttribute('aria-pressed', answers.avatar === avatar ? 'true' : 'false');
                    choice.appendChild(Darbyon.avatarImage({ avatar: avatar }));
                    grid.appendChild(choice);
                });
                panel.appendChild(grid);
                navigation(panel, !!answers.avatar);
            }

            if (kind === 'power') {
                const panel = frame('Choose your first power', 'Powers cost AP. Your teacher can give you more later.');
                const grid = pickGrid('power-grid');
                powers.forEach(power => {
                    const card = powerCard(power, answers.powerId === power.id);
                    card.appendChild(button(answers.powerId === power.id ? 'Chosen' : 'Choose', answers.powerId === power.id ? '' : 'secondary', () => {
                        answers.powerId = power.id;
                        step++;
                        draw();
                    }));
                    grid.appendChild(card);
                });
                panel.appendChild(grid);
                navigation(panel, !!answers.powerId);
            }

            if (kind === 'code' || kind === 'check') {
                const first = kind === 'code';
                const panel = frame(first ? 'Choose your 3 secret teams' : 'Tap your 3 teams again',
                                    first ? 'You will tap these, in this order, every time you log in. Remember them!'
                                          : 'This checks you remember them.');
                const picked = first ? [] : checking;
                picked.length = 0;
                const slots = el('div', null, 'picture-slots');
                const drawSlots = () => {
                    slots.innerHTML = '';
                    for (let i = 0; i < 3; i++) {
                        const picture = Darbyon.PICTURES[picked[i]];
                        const slot = el('span', null, 'picture-slot' + (picture ? ' filled' : ''));
                        if (picture) {
                            slot.style.background = picture.colour;
                            slot.style.color = picture.text;
                            slot.appendChild(Darbyon.iconText(picture.sport, '', 'span', 'slot-emoji'));
                            slot.appendChild(el('span', picture.name, 'slot-name'));
                        }
                        slots.appendChild(slot);
                    }
                };
                drawSlots();
                panel.appendChild(slots);
                const pad = el('div', null, 'picture-pad');
                let nav;
                Darbyon.PICTURES.forEach((picture, index) => {
                    const key = button('', 'picture-key', () => {
                        if (picked.length >= 3 || (first && picked.indexOf(index) !== -1)) return;
                        picked.push(index);
                        drawSlots();
                        if (picked.length < 3) return;
                        if (first) {
                            answers.code = picked.slice();
                            nav.next.disabled = false;
                        } else if (picked.join() === answers.code.join()) {
                            step++;
                            draw();
                        } else {
                            nav.notice.textContent = 'Those do not match. Choose your 3 teams again.';
                            setTimeout(() => { step--; draw(); }, 1600);
                        }
                    });
                    key.setAttribute('aria-label', picture.full);
                    key.style.background = picture.colour;
                    key.style.color = picture.text;
                    key.appendChild(Darbyon.iconText(picture.sport, '', 'span', 'picture-emoji'));
                    key.appendChild(el('span', picture.name, 'picture-name'));
                    pad.appendChild(key);
                });
                panel.appendChild(pad);
                panel.appendChild(button('Start Again', 'soft small', () => { picked.length = 0; drawSlots(); if (first) nav.next.disabled = true; }));
                nav = navigation(panel, false, first ? 'Next' : 'Check');
                if (!first) nav.next.hidden = true;
            }

            if (kind === 'done') {
                const panel = frame('Is this right?');
                const card = el('div', null, 'signup-summary');
                card.appendChild(Darbyon.avatarImage({ avatar: answers.avatar }, 'avatar-hero'));
                const about = el('div');
                about.appendChild(el('p', fullName(), 'signup-name'));
                about.appendChild(Darbyon.typeTag(answers.type));
                const power = powers.find(p => p.id === answers.powerId);
                if (power) about.appendChild(el('p', 'First power: ' + power.name));
                about.appendChild(el('p', 'Secret teams: ' + answers.code.map(i => Darbyon.PICTURES[i].name).join(', then ')));
                card.appendChild(about);
                panel.appendChild(card);
                const nav = navigation(panel, true, 'Make My Character', async () => {
                    nav.next.disabled = true;
                    const result = await Darbyon.signup(answers);
                    if (result.ok) {
                        location.reload();
                        return;
                    }
                    nav.notice.textContent = result.error;
                    nav.next.disabled = false;
                });
            }
        }

        draw();
    }

    // A power's card: name, cost, who it reaches and what it does.
    function powerCard(power, chosen, locked) {
        const card = el('div', null, 'power-card' + (chosen ? ' chosen' : '') + (locked ? ' locked' : ''));
        card.appendChild(locked ? Darbyon.iconText('lock', power.name, 'h3') : el('h3', power.name));
        const tags = el('p', null, 'power-tags');
        tags.appendChild(el('span', power.apCost + ' AP', 'power-cost'));
        tags.appendChild(el('span', Darbyon.REACH[power.type], 'power-reach'));
        card.appendChild(tags);
        if (power.about) card.appendChild(el('p', power.about, 'power-about'));
        Darbyon.describePower(power).forEach(line => card.appendChild(line.startsWith('Reward: ')
            ? Darbyon.iconText('gift', line.slice(8), 'p', 'power-reward') : el('p', line)));
        return card;
    }

    // ---- The student's own character -------------------------------------

    let chosenPower = null;      // kept while the page redraws itself
    let chosenTarget = null;
    let notice = { text: '', kind: '' };
    const dismissed = new Set();

    function statTile(iconName, label, value, extra) {
        const tile = el('div', null, 'stat-tile');
        const art = el('span', null, 'stat-emoji');
        art.appendChild(Darbyon.icon(iconName));
        tile.appendChild(art);
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
        const levelTitle = el('p', null, 'level-up-title');
        levelTitle.appendChild(Darbyon.icon('star'));
        levelTitle.appendChild(document.createTextNode(' Level up! '));
        levelTitle.appendChild(Darbyon.icon('star'));
        card.appendChild(levelTitle);
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
        stats.appendChild(statTile('star', 'XP', me.xp));
        stats.appendChild(statTile('gem', 'AP', me.ap));
        stats.appendChild(statTile('heart', 'HP', me.hp, me.hp === 0 ? 'in Battle' : ''));
        about.appendChild(stats);
        hero.appendChild(about);
        main.appendChild(hero);
        celebrateLevel(me);

        // What happened to my last request
        const pending = info.requests.find(r => r.status === 'pending');
        const latest = info.requests.filter(r => r.status !== 'pending' && !dismissed.has(r.id)).pop();
        if (pending) {
            const box = el('section', null, 'panel request-status waiting');
            box.appendChild(Darbyon.iconText('hourglass', 'Waiting for your teacher to say yes to ' + pending.powerName +
                (pending.targetName ? ' on ' + pending.targetName : '') + '.', 'p'));
            box.appendChild(button('Cancel', 'secondary small', async () => {
                await Darbyon.cancelRequest();
                await Darbyon.refresh(true);
            }));
            main.appendChild(box);
        } else if (latest && Date.now() / 1000 - (latest.resolved || 0) < 15 * 60) {
            const approved = latest.status === 'approved';
            const box = el('section', null, 'panel request-status ' + (approved ? 'approved' : 'declined'));
            box.appendChild(approved ? Darbyon.iconText('check', latest.powerName + ' worked!', 'p')
                : Darbyon.iconText('cross', latest.powerName + ' was not used this time.' + (latest.note ? ' ' + latest.note : ''), 'p'));
            box.appendChild(button('OK', 'secondary small', () => { dismissed.add(latest.id); render(); }));
            main.appendChild(box);
        }

        // Class poll
        const poll = Darbyon.getPoll();
        if (poll && poll.open) {
            const box = el('section', null, 'panel poll-vote');
            box.appendChild(Darbyon.iconText('ballot', poll.question, 'h2'));
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
        const order = p => (Darbyon.powerLock(me, p) ? 100 : 0) + p.level;
        powers.slice().sort((x, y) => order(x) - order(y)).forEach(power => {
            const lock = Darbyon.powerLock(me, power);
            const card = powerCard(power, chosenPower === power.id, !!lock);
            const needsMate = power.type !== 'self';
            const fallenMates = teammates.filter(m => m.hp === 0);
            let reason = '';
            if (lock) reason = lock;
            else if (pending) reason = 'Wait for your teacher first';
            else if (me.ap < power.apCost) reason = 'You need ' + (power.apCost - me.ap) + ' more AP';
            else if (needsMate && !teammates.length) reason = 'You need a teammate for this';
            else if (power.special === 'revive' && !fallenMates.length) reason = 'Nobody on your team has 0 HP';
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
            const choices = power.special === 'revive' ? teammates.filter(m => m.hp === 0) : teammates;
            if (power.type === 'team') {
                box.appendChild(el('h2', 'Who gets ' + power.name + '?'));
                const grid = el('div', null, 'who-grid small');
                choices.forEach(mate => {
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
            if (power.type === 'everyone') box.appendChild(el('h2', power.name + ' reaches your whole team'));
            const target = choices.find(m => m.id === chosenTarget);
            const ready = power.type !== 'team' || target;
            const ask = button(ready ? 'Ask to use ' + power.name + (target ? ' on ' + target.name : '')
                                     : 'Choose a teammate first', '', async () => {
                ask.disabled = true;
                const result = await Darbyon.requestPower(power.id, power.type === 'team' ? chosenTarget : '');
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
