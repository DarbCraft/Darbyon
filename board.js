/*
 * The classroom board: a full-screen space for the projector where the
 * teacher opens tools (timer, name picker, noise meter and so on) as
 * windows that can be dragged around and resized.
 *
 * Which tools are open, and where, is remembered in this browser.
 */
Darbyon.ready(() => {
    'use strict';
    const { el } = Darbyon;
    const board = document.getElementById('board');
    const area = document.getElementById('boardWidgets');
    const empty = document.getElementById('boardEmpty');
    const LAYOUT_KEY = 'darbyon-board';
    const BACKGROUNDS = ['sky', 'sunrise', 'forest', 'night', 'paper'];

    const open = {};          // tool name -> { node, tool }
    let topLayer = 10;
    const MIN_WIDTH = 240;
    const MIN_HEIGHT = 140;

    // On a phone the tools are stacked down the page instead of floating,
    // so they cannot be dragged or resized there.
    // Projector mode lines the tools up in a grid and makes them big, so
    // they cannot be dragged there either.
    const phone = window.matchMedia('(max-width: 700px)');
    const stacked = () => phone.matches || board.classList.contains('projector');

    // ---- Small helpers ---------------------------------------------------

    function button(text, className, onClick) {
        const node = el('button', text, className);
        node.type = 'button';
        node.addEventListener('click', onClick);
        return node;
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function minutesSeconds(ms) {
        const total = Math.max(0, Math.ceil(ms / 1000));
        return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
    }

    // Beeps through the speakers. The sound is set up on a button press,
    // because browsers only allow sound after someone has clicked.
    let audio = null;
    function readySound() {
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            if (audio.state === 'suspended') audio.resume();
        } catch (err) { audio = null; }
    }
    function beep(times) {
        if (!audio) return;
        for (let i = 0; i < times; i++) {
            const start = audio.currentTime + i * 0.45;
            const tone = audio.createOscillator();
            const volume = audio.createGain();
            tone.frequency.value = 880;
            volume.gain.setValueAtTime(0.0001, start);
            volume.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
            volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
            tone.connect(volume).connect(audio.destination);
            tone.start(start);
            tone.stop(start + 0.4);
        }
    }

    // ---- Remembering the layout ------------------------------------------

    function loadLayout() {
        try {
            return JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {};
        } catch (err) {
            return {};
        }
    }

    function saveLayout() {
        const before = loadLayout().open || [];
        const layout = { background: board.dataset.background, open: [] };
        Object.keys(open).forEach(name => {
            const node = open[name].node;
            if (stacked()) {
                // Keep the positions from the big screen; a phone's stacked layout is not saved.
                layout.open.push(before.find(p => p.name === name) || { name: name });
                return;
            }
            layout.open.push({ name: name, x: node.offsetLeft, y: node.offsetTop,
                               w: node.offsetWidth, h: node.offsetHeight });
        });
        try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch (err) { /* storage off */ }
    }

    // ---- Windows ---------------------------------------------------------

    function bringToFront(node) {
        node.style.zIndex = ++topLayer;
    }

    function keepInside(node) {
        if (stacked()) return;
        const maxX = Math.max(0, area.clientWidth - node.offsetWidth);
        const maxY = Math.max(0, area.clientHeight - node.offsetHeight);
        node.style.left = Math.min(Math.max(0, node.offsetLeft), maxX) + 'px';
        node.style.top = Math.min(Math.max(0, node.offsetTop), maxY) + 'px';
    }

    // Drag the bottom-right corner to resize; the top-left corner stays where it is.
    function makeResizable(node) {
        ['se'].forEach(corner => {
            const grip = el('div', null, 'resize-grip grip-' + corner);
            grip.setAttribute('aria-hidden', 'true');
            node.appendChild(grip);
            grip.addEventListener('pointerdown', event => {
                if (stacked()) return;
                event.preventDefault();
                event.stopPropagation();
                bringToFront(node);
                grip.setPointerCapture(event.pointerId);
                node.classList.add('resizing');
                const start = { x: event.clientX, y: event.clientY, left: node.offsetLeft, top: node.offsetTop,
                                width: node.offsetWidth, height: node.offsetHeight };
                const move = e => {
                    const dx = e.clientX - start.x;
                    const dy = e.clientY - start.y;
                    let { left, top, width, height } = start;
                    if (corner.indexOf('e') !== -1) {
                        width = Math.min(Math.max(MIN_WIDTH, start.width + dx), area.clientWidth - start.left);
                    } else {
                        width = Math.min(Math.max(MIN_WIDTH, start.width - dx), start.left + start.width);
                        left = start.left + start.width - width;
                    }
                    if (corner.indexOf('s') !== -1) {
                        height = Math.min(Math.max(MIN_HEIGHT, start.height + dy), area.clientHeight - start.top);
                    } else {
                        height = Math.min(Math.max(MIN_HEIGHT, start.height - dy), start.top + start.height);
                        top = start.top + start.height - height;
                    }
                    node.style.left = left + 'px';
                    node.style.top = top + 'px';
                    node.style.width = width + 'px';
                    node.style.height = height + 'px';
                };
                const stop = () => {
                    grip.removeEventListener('pointermove', move);
                    grip.removeEventListener('pointerup', stop);
                    grip.removeEventListener('pointercancel', stop);
                    node.classList.remove('resizing');
                    saveLayout();
                };
                grip.addEventListener('pointermove', move);
                grip.addEventListener('pointerup', stop);
                grip.addEventListener('pointercancel', stop);
            });
        });
    }

    function makeDraggable(node, handle) {
        handle.addEventListener('pointerdown', event => {
            if (event.target.closest('button') || stacked()) return;
            event.preventDefault();
            bringToFront(node);
            handle.setPointerCapture(event.pointerId);
            const startX = event.clientX - node.offsetLeft;
            const startY = event.clientY - node.offsetTop;
            const move = e => {
                node.style.left = (e.clientX - startX) + 'px';
                node.style.top = (e.clientY - startY) + 'px';
                keepInside(node);
            };
            const stop = () => {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', stop);
                handle.removeEventListener('pointercancel', stop);
                saveLayout();
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', stop);
            handle.addEventListener('pointercancel', stop);
        });
    }

    // Finds somewhere on the board for a new window that does not cover the
    // ones already open, scanning from the top left. If the board is full it
    // overlaps them slightly instead.
    function freeSpot(width, height) {
        height = Math.min(height, area.clientHeight - 32);     // a tall window still needs a spot
        width = Math.min(width, area.clientWidth - 32);
        const taken = Object.values(open).map(entry => ({
            x: entry.node.offsetLeft, y: entry.node.offsetTop,
            w: entry.node.offsetWidth, h: entry.node.offsetHeight }));
        const clear = (x, y) => taken.every(r => x + width + 12 <= r.x || x >= r.x + r.w + 12 ||
                                               y + height + 12 <= r.y || y >= r.y + r.h + 12);
        for (let y = 16; y + height <= area.clientHeight; y += 24) {
            for (let x = 16; x + width <= area.clientWidth; x += 24) {
                if (clear(x, y)) return { x: x, y: y };
            }
        }
        const n = taken.length;
        return { x: 24 + (n % 8) * 36, y: 20 + (n % 8) * 30 };
    }

    function openTool(name, place) {
        if (open[name]) {
            bringToFront(open[name].node);
            open[name].node.classList.remove('flash');
            void open[name].node.offsetWidth;
            open[name].node.classList.add('flash');
            return;
        }
        const tool = TOOLS[name];
        const node = el('section', null, 'widget widget-' + name);
        node.setAttribute('aria-label', tool.title);
        const head = el('div', null, 'widget-head');
        head.appendChild(el('h2', tool.title));
        head.appendChild(button('×', 'widget-close', () => closeTool(name)));
        head.lastChild.setAttribute('aria-label', 'Close ' + tool.title);
        const body = el('div', null, 'widget-body');
        node.appendChild(head);
        node.appendChild(body);
        area.appendChild(node);

        node.style.width = (place && place.w ? place.w : tool.width) + 'px';
        if (place && place.h) node.style.height = place.h + 'px';
        bringToFront(node);

        const instance = tool.build(body, node) || {};
        const spot = place || freeSpot(node.offsetWidth, node.offsetHeight);
        node.style.left = spot.x + 'px';
        node.style.top = spot.y + 'px';
        open[name] = { node: node, tool: instance };
        countTools();
        if (!stacked()) keepInside(node);
        makeDraggable(node, head);
        makeResizable(node);
        node.addEventListener('pointerdown', () => bringToFront(node));
        empty.hidden = true;
        if (stacked()) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        saveLayout();
    }

    function closeTool(name) {
        const entry = open[name];
        if (!entry) return;
        if (entry.tool.close) entry.tool.close();
        entry.node.remove();
        delete open[name];
        countTools();
        empty.hidden = Object.keys(open).length > 0;
        saveLayout();
    }

    // ---- The tools -------------------------------------------------------

    const TOOLS = {};

    TOOLS.timer = {
        title: 'Timer',
        width: 380,
        build(body, node) {
            let length = 5 * 60 * 1000;      // what the timer is set to
            let left = length;               // what is left when paused
            let endsAt = null;               // set while running
            let ticking = null;

            const face = el('div', minutesSeconds(left), 'big-digits');
            face.setAttribute('role', 'timer');
            const presets = el('div', null, 'actions centred');
            [1, 2, 3, 5, 10, 15].forEach(m => presets.appendChild(button(m + ' min', 'small soft', () => set(m * 60000))));
            const adjust = el('div', null, 'actions centred');
            adjust.appendChild(button('−1 min', 'small secondary', () => set(Math.max(10000, current() - 60000))));
            adjust.appendChild(button('+1 min', 'small secondary', () => set(current() + 60000)));
            adjust.appendChild(button('+10 sec', 'small secondary', () => set(current() + 10000)));
            const go = button('Start', '', () => (endsAt ? pause() : start()));
            const reset = button('Reset', 'secondary', () => { stop(); left = length; draw(); });
            const controls = el('div', null, 'actions centred');
            controls.appendChild(go);
            controls.appendChild(reset);
            [face, presets, adjust, controls].forEach(n => body.appendChild(n));

            function current() { return endsAt ? endsAt - Date.now() : left; }
            function draw() {
                const up = current() <= 0 && endsAt === null && node.classList.contains('alarm');
                face.textContent = up ? "Time's up!" : minutesSeconds(current());
                face.classList.toggle('times-up', up);
                go.textContent = endsAt ? 'Pause' : 'Start';
            }
            function set(ms) {
                stop();
                length = left = Math.min(ms, 99 * 60000);
                draw();
            }
            function start() {
                readySound();
                node.classList.remove('alarm');
                if (left <= 0) left = length;
                endsAt = Date.now() + left;
                ticking = setInterval(tick, 200);
                draw();
            }
            function pause() {
                left = Math.max(0, endsAt - Date.now());
                stop();
                draw();
            }
            function stop() {
                clearInterval(ticking);
                ticking = null;
                endsAt = null;
                node.classList.remove('alarm');
            }
            function tick() {
                if (endsAt - Date.now() > 0) {
                    draw();
                    return;
                }
                clearInterval(ticking);
                endsAt = null;
                left = 0;
                node.classList.add('alarm');
                beep(3);
                draw();
            }
            return { close: stop };
        }
    };

    TOOLS.stopwatch = {
        title: 'Stopwatch',
        width: 340,
        build(body) {
            let total = 0;
            let startedAt = null;
            let ticking = null;
            const face = el('div', '00:00.0', 'big-digits');
            const go = button('Start', '', () => {
                if (startedAt) {
                    total += Date.now() - startedAt;
                    startedAt = null;
                    clearInterval(ticking);
                } else {
                    startedAt = Date.now();
                    ticking = setInterval(draw, 100);
                }
                draw();
            });
            const reset = button('Reset', 'secondary', () => {
                clearInterval(ticking);
                startedAt = null;
                total = 0;
                draw();
            });
            function draw() {
                const ms = total + (startedAt ? Date.now() - startedAt : 0);
                face.textContent = pad(Math.floor(ms / 60000)) + ':' + pad(Math.floor(ms / 1000) % 60) + '.' + Math.floor(ms / 100) % 10;
                go.textContent = startedAt ? 'Stop' : (ms ? 'Continue' : 'Start');
            }
            const controls = el('div', null, 'actions centred');
            controls.appendChild(go);
            controls.appendChild(reset);
            body.appendChild(face);
            body.appendChild(controls);
            return { close: () => clearInterval(ticking) };
        }
    };

    TOOLS.clock = {
        title: 'Clock',
        width: 340,
        build(body) {
            // Always Perth time, whatever time zone the computer is set to.
            const perth = new Intl.DateTimeFormat('en-AU', {
                timeZone: 'Australia/Perth', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
            const perthDay = new Intl.DateTimeFormat('en-AU', {
                timeZone: 'Australia/Perth', weekday: 'long', day: 'numeric', month: 'long' });
            const NS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('viewBox', '0 0 200 200');
            svg.setAttribute('class', 'analogue-clock');
            svg.setAttribute('role', 'img');
            const shape = (tag, attrs) => {
                const node = document.createElementNS(NS, tag);
                Object.keys(attrs).forEach(k => node.setAttribute(k, attrs[k]));
                svg.appendChild(node);
                return node;
            };
            shape('circle', { cx: 100, cy: 100, r: 94, class: 'clock-face' });
            for (let i = 0; i < 60; i++) {
                const big = i % 5 === 0;
                shape('line', { x1: 100, y1: 10, x2: 100, y2: big ? 22 : 15, class: big ? 'tick big' : 'tick',
                                transform: 'rotate(' + i * 6 + ' 100 100)' });
            }
            for (let n = 1; n <= 12; n++) {
                const angle = n * Math.PI / 6;
                const label = shape('text', { x: 100 + 64 * Math.sin(angle), y: 100 - 64 * Math.cos(angle), class: 'clock-number' });
                label.textContent = n;
            }
            const hourHand = shape('line', { x1: 100, y1: 112, x2: 100, y2: 52, class: 'hand hour' });
            const minuteHand = shape('line', { x1: 100, y1: 116, x2: 100, y2: 28, class: 'hand minute' });
            const secondHand = shape('line', { x1: 100, y1: 122, x2: 100, y2: 22, class: 'hand second' });
            shape('circle', { cx: 100, cy: 100, r: 5, class: 'clock-centre' });
            const day = el('p', '', 'clock-date');
            body.appendChild(svg);
            body.appendChild(day);

            function draw() {
                const now = new Date();
                const parts = {};
                perth.formatToParts(now).forEach(p => { parts[p.type] = Number(p.value); });
                const h = parts.hour % 12, m = parts.minute, sec = parts.second;
                hourHand.setAttribute('transform', 'rotate(' + (h * 30 + m * 0.5) + ' 100 100)');
                minuteHand.setAttribute('transform', 'rotate(' + (m * 6 + sec * 0.1) + ' 100 100)');
                secondHand.setAttribute('transform', 'rotate(' + sec * 6 + ' 100 100)');
                svg.setAttribute('aria-label', 'Perth time ' + (h || 12) + ':' + pad(m));
                day.textContent = perthDay.format(now);
            }
            draw();
            const ticking = setInterval(draw, 1000);
            return { close: () => clearInterval(ticking) };
        }
    };

    TOOLS.picker = {
        title: 'Name Picker',
        width: 400,
        build(body) {
            const show = el('div', null, 'picker-show');
            const counter = el('p', '', 'hint centred');
            const go = button('Pick a Name', '', pick);
            const reset = button('Start Again', 'secondary', () => {
                Darbyon.resetPicker();
                show.innerHTML = '';
                draw();
            });
            const controls = el('div', null, 'actions centred');
            controls.appendChild(go);
            controls.appendChild(reset);
            [show, controls, counter].forEach(n => body.appendChild(n));

            function showPlayer(player) {
                show.innerHTML = '';
                show.appendChild(Darbyon.avatarImage(player, 'avatar-hero'));
                show.appendChild(el('p', player.name, 'picker-name'));
            }
            function draw() {
                const progress = Darbyon.pickerProgress();
                counter.textContent = progress.total
                    ? progress.shown + ' of ' + progress.total + ' picked this round'
                    : 'There are no players yet.';
            }
            function pick() {
                const players = Darbyon.getCharacters();
                if (!players.length) return;
                go.disabled = true;
                const quick = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                let spins = quick ? 0 : 14;
                const spin = () => {
                    if (spins-- > 0) {
                        showPlayer(players[Math.floor(Math.random() * players.length)]);
                        setTimeout(spin, 70 + (14 - spins) * 8);
                        return;
                    }
                    const result = Darbyon.pickPlayer();
                    showPlayer(result.player);
                    show.classList.remove('pop');
                    void show.offsetWidth;
                    show.classList.add('pop');
                    go.disabled = false;
                    draw();
                };
                spin();
            }
            draw();
            return { refresh: draw };
        }
    };

    TOOLS.groups = {
        title: 'Groups',
        width: 560,
        build(body) {
            const controls = el('div', null, 'actions');
            const kind = document.createElement('select');
            kind.setAttribute('aria-label', 'How to make groups');
            [['size', 'Groups of'], ['count', 'Number of groups']].forEach(([value, text]) => {
                const option = el('option', text);
                option.value = value;
                kind.appendChild(option);
            });
            const number = document.createElement('input');
            number.type = 'number';
            number.min = 2;
            number.max = 12;
            number.value = 4;
            number.setAttribute('aria-label', 'Number');
            number.className = 'small-number';
            controls.appendChild(kind);
            controls.appendChild(number);
            controls.appendChild(button('Make Groups', '', make));
            controls.appendChild(button('Show Teams', 'secondary', showTeams));
            const out = el('div', null, 'group-grid');
            body.appendChild(controls);
            body.appendChild(out);

            function showGroups(groups) {
                out.innerHTML = '';
                groups.forEach(group => {
                    const card = el('div', null, 'group-card');
                    card.appendChild(el('h3', group.name));
                    group.members.forEach(player => {
                        const who = el('div', null, 'who');
                        who.appendChild(Darbyon.avatarImage(player));
                        who.appendChild(el('span', player.name));
                        card.appendChild(who);
                    });
                    out.appendChild(card);
                });
            }
            function make() {
                const players = Darbyon.getCharacters();
                for (let i = players.length - 1; i > 0; i--) {          // shuffle
                    const j = Math.floor(Math.random() * (i + 1));
                    [players[i], players[j]] = [players[j], players[i]];
                }
                const n = Math.max(1, Math.min(players.length || 1, parseInt(number.value, 10) || 2));
                const count = kind.value === 'size' ? Math.max(1, Math.round(players.length / n)) : n;
                const groups = Array.from({ length: count }, (x, i) => ({ name: 'Group ' + (i + 1), members: [] }));
                players.forEach((player, i) => groups[i % count].members.push(player));
                showGroups(groups);
            }
            function showTeams() {
                const players = Darbyon.getCharacters();
                showGroups(Darbyon.getTeams().map(team => ({
                    name: team.name, members: players.filter(p => p.team === team.name) })));
            }
        }
    };

    TOOLS.noise = {
        title: 'Noise Meter',
        width: 500,
        build(body, node) {
            // The teacher's choices are remembered in this browser.
            const SETTINGS_KEY = 'darbyon-noise';
            const defaults = { limit: 70, sounds: true,
                               penaltyOn: false, penaltyStat: 'hp', penaltyAmount: 1, penaltyAfter: 3, penaltyWait: 60,
                               rewardOn: false, rewardStat: 'xp', rewardAmount: 50, rewardAfter: 5 };
            let settings = defaults;
            try { settings = Object.assign({}, defaults, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch (err) { /* use defaults */ }
            const remember = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (err) { /* storage off */ } };

            let stream = null;
            let looping = null;
            let muted = false;
            let level = 0;
            let loudSince = null;
            let quietSince = null;
            let nextPenaltyAt = 0;

            // ---- The meter
            const face = el('div', null, 'noise-face');
            const setFace = name => face.replaceChildren(Darbyon.icon(name));
            const label = (node, iconName, text) => node.replaceChildren(Darbyon.icon(iconName), document.createTextNode(' ' + text));
            setFace('happy');
            const meter = el('div', null, 'noise-meter');
            const fill = el('div', null, 'noise-fill');
            const line = el('div', null, 'noise-line');
            meter.appendChild(fill);
            meter.appendChild(line);
            const status = el('p', 'Press Start Listening to use the microphone.', 'noise-status');

            const go = button('Start Listening', '', () => (stream ? stopListening() : startListening()));
            const mute = button('', 'secondary', () => setMuted(!muted));
            label(mute, 'mic', 'Mute Mic');
            mute.disabled = true;
            const sounds = button('', 'secondary', () => {
                settings.sounds = !settings.sounds;
                remember();
                drawSounds();
            });
            const drawSounds = () => {
                label(sounds, settings.sounds ? 'bell' : 'bellOff', settings.sounds ? 'Sounds On' : 'Sounds Off');
                sounds.setAttribute('aria-pressed', settings.sounds ? 'true' : 'false');
            };
            drawSounds();
            const controls = el('div', null, 'actions');
            [go, mute, sounds].forEach(b => controls.appendChild(b));

            // ---- How loud is too loud
            const limitRow = el('div', null, 'noise-settings');
            const limitLabel = el('label', 'Too loud above');
            const limit = document.createElement('input');
            limit.type = 'range';
            limit.min = 5;
            limit.max = 95;
            limit.value = settings.limit;
            limit.id = 'noiseLimit';
            limitLabel.htmlFor = 'noiseLimit';
            const drawLine = () => { line.style.left = limit.value + '%'; };
            limit.addEventListener('input', () => { settings.limit = Number(limit.value); remember(); drawLine(); });
            drawLine();
            limitRow.appendChild(limitLabel);
            limitRow.appendChild(limit);

            // ---- Penalty and reward settings
            const STATS = [['hp', 'HP'], ['xp', 'XP'], ['ap', 'AP']];
            function choice(values, current, onChange, label) {
                const select = document.createElement('select');
                select.setAttribute('aria-label', label);
                values.forEach(([value, text]) => {
                    const option = el('option', text);
                    option.value = value;
                    option.selected = String(value) === String(current);
                    select.appendChild(option);
                });
                select.addEventListener('change', () => { onChange(select.value); remember(); drawRules(); });
                return select;
            }
            function amountBox(current, onChange, label) {
                const input = document.createElement('input');
                input.type = 'number';
                input.min = 1;
                input.max = 1000;
                input.value = current;
                input.className = 'small-number';
                input.setAttribute('aria-label', label);
                input.addEventListener('change', () => {
                    const n = Math.max(1, Math.min(1000, parseInt(input.value, 10) || 1));
                    input.value = n;
                    onChange(n);
                    remember();
                    drawRules();
                });
                return input;
            }
            function switchButton(isOn, onToggle, label) {
                const toggle = button('', 'switch', () => { onToggle(); remember(); drawRules(); });
                toggle.setAttribute('role', 'switch');
                toggle.setAttribute('aria-label', label);
                toggle.update = () => {
                    toggle.setAttribute('aria-checked', isOn() ? 'true' : 'false');
                    toggle.textContent = isOn() ? 'On' : 'Off';
                };
                return toggle;
            }

            const penaltyBox = el('div', null, 'rule');
            const penaltySwitch = switchButton(() => settings.penaltyOn,
                () => { settings.penaltyOn = !settings.penaltyOn; nextPenaltyAt = 0; }, 'Penalty');
            const penaltyHead = el('div', null, 'rule-head');
            penaltyHead.appendChild(Darbyon.iconText('upset', 'Penalty when too loud', 'strong'));
            penaltyHead.appendChild(penaltySwitch);
            const penaltyLine = el('div', null, 'rule-line');
            penaltyLine.appendChild(document.createTextNode('Everyone loses '));
            penaltyLine.appendChild(amountBox(settings.penaltyAmount, n => { settings.penaltyAmount = n; }, 'Penalty amount'));
            penaltyLine.appendChild(choice(STATS, settings.penaltyStat, v => { settings.penaltyStat = v; }, 'Penalty takes'));
            penaltyLine.appendChild(document.createTextNode(' after '));
            penaltyLine.appendChild(choice([[2, '2 seconds'], [3, '3 seconds'], [5, '5 seconds'], [10, '10 seconds']],
                settings.penaltyAfter, v => { settings.penaltyAfter = Number(v); }, 'Too loud for'));
            penaltyLine.appendChild(document.createTextNode(' too loud, at most once every '));
            penaltyLine.appendChild(choice([[30, '30 seconds'], [60, 'minute'], [120, '2 minutes'], [300, '5 minutes']],
                settings.penaltyWait, v => { settings.penaltyWait = Number(v); }, 'Wait between penalties'));
            penaltyLine.appendChild(document.createTextNode('.'));
            penaltyBox.appendChild(penaltyHead);
            penaltyBox.appendChild(penaltyLine);

            const rewardBox = el('div', null, 'rule');
            const rewardSwitch = switchButton(() => settings.rewardOn,
                () => { settings.rewardOn = !settings.rewardOn; quietSince = null; }, 'Reward');
            const rewardHead = el('div', null, 'rule-head');
            rewardHead.appendChild(Darbyon.iconText('star', 'Reward for staying quiet', 'strong'));
            rewardHead.appendChild(rewardSwitch);
            const rewardLine = el('div', null, 'rule-line');
            rewardLine.appendChild(document.createTextNode('Everyone gets '));
            rewardLine.appendChild(amountBox(settings.rewardAmount, n => { settings.rewardAmount = n; }, 'Reward amount'));
            rewardLine.appendChild(choice(STATS, settings.rewardStat, v => { settings.rewardStat = v; }, 'Reward gives'));
            rewardLine.appendChild(document.createTextNode(' for every '));
            rewardLine.appendChild(choice([[2, '2 minutes'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [20, '20 minutes']],
                settings.rewardAfter, v => { settings.rewardAfter = Number(v); quietSince = null; }, 'Quiet for'));
            rewardLine.appendChild(document.createTextNode(' below the line.'));
            rewardBox.appendChild(rewardHead);
            rewardBox.appendChild(rewardLine);

            function drawRules() {
                penaltySwitch.update();
                rewardSwitch.update();
                penaltyBox.classList.toggle('off', !settings.penaltyOn);
                rewardBox.classList.toggle('off', !settings.rewardOn);
            }
            drawRules();

            // The settings fold away so the meter itself fits on the board.
            const more = document.createElement('details');
            more.className = 'noise-details';
            more.open = settings.settingsOpen !== false;
            more.appendChild(Darbyon.iconText('gear', 'Loudness, penalty and reward', 'summary'));
            [limitRow, penaltyBox, rewardBox].forEach(n => more.appendChild(n));
            more.addEventListener('toggle', () => { settings.settingsOpen = more.open; remember(); });

            [face, meter, status, controls, more].forEach(n => body.appendChild(n));

            // ---- Listening
            async function startListening() {
                readySound();
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (err) {
                    status.textContent = 'The microphone could not be used. Allow microphone access for this site and try again.';
                    return;
                }
                const context = audio || new AudioContext();
                const analyser = context.createAnalyser();
                analyser.fftSize = 1024;
                context.createMediaStreamSource(stream).connect(analyser);
                const samples = new Float32Array(analyser.fftSize);
                go.textContent = 'Stop Listening';
                mute.disabled = false;
                setMuted(false);
                looping = setInterval(() => {
                    if (muted) return;
                    analyser.getFloatTimeDomainData(samples);
                    let sum = 0;
                    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
                    const decibels = 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-6);
                    const now = Math.max(0, Math.min(100, (decibels + 60) * 2));   // -60 dB quiet ... -10 dB very loud
                    level = level * 0.8 + now * 0.2;                                  // smooth it out
                    check();
                }, 100);
            }

            // Muting pauses the meter without closing it: nothing is heard,
            // and no penalty or reward can happen until it is unmuted.
            function setMuted(on) {
                muted = on;
                if (stream) stream.getAudioTracks().forEach(track => { track.enabled = !on; });
                label(mute, on ? 'micOff' : 'mic', on ? 'Unmute Mic' : 'Mute Mic');
                mute.setAttribute('aria-pressed', on ? 'true' : 'false');
                node.classList.toggle('muted', on);
                if (on) {
                    level = 0;
                    loudSince = quietSince = null;
                    fill.style.width = '0%';
                    setFace('quiet');
                    status.textContent = 'Microphone muted.';
                    node.classList.remove('too-loud');
                }
            }

            function stopListening() {
                clearInterval(looping);
                if (stream) stream.getTracks().forEach(track => track.stop());
                stream = null;
                muted = false;
                level = 0;
                loudSince = quietSince = null;
                go.textContent = 'Start Listening';
                mute.disabled = true;
                label(mute, 'mic', 'Mute Mic');
                node.classList.remove('muted', 'too-loud');
                fill.style.width = '0%';
                setFace('happy');
                status.textContent = 'Stopped.';
            }

            function check() {
                const limitValue = Number(limit.value);
                const over = level > limitValue;
                fill.style.width = level.toFixed(0) + '%';
                fill.className = 'noise-fill ' + (over ? 'loud' : level > limitValue * 0.75 ? 'warm' : 'calm');
                setFace(over ? 'upset' : level > limitValue * 0.75 ? 'neutral' : 'happy');
                node.classList.toggle('too-loud', over);
                const now = Date.now();
                loudSince = over ? (loudSince || now) : null;
                quietSince = over ? null : (quietSince || now);

                const notes = [over ? 'Too loud!' : 'Listening.'];
                if (settings.penaltyOn) {
                    const waitLeft = Math.ceil((nextPenaltyAt - now) / 1000);
                    if (waitLeft > 0) {
                        notes.push('Next penalty possible in ' + waitLeft + ' s.');
                    } else if (over) {
                        notes.push('Penalty in ' + Math.max(0, settings.penaltyAfter - Math.floor((now - loudSince) / 1000)) + '…');
                        if (now - loudSince >= settings.penaltyAfter * 1000) penalty();
                    }
                }
                if (settings.rewardOn && quietSince) {
                    const needed = settings.rewardAfter * 60000;
                    const left = Math.ceil((needed - (now - quietSince)) / 60000);
                    notes.push('Reward in ' + left + (left === 1 ? ' minute.' : ' minutes.'));
                    if (now - quietSince >= needed) reward();
                }
                status.textContent = notes.join(' ');
            }

            function giveEveryone(stat, amount) {
                const players = Darbyon.getCharacters().filter(c => amount > 0 || c[stat] > 0);
                return Darbyon.adjustStat(players.map(c => c.id), stat, amount);
            }

            function penalty() {
                loudSince = null;
                nextPenaltyAt = Date.now() + settings.penaltyWait * 1000;
                const text = settings.penaltyAmount + ' ' + settings.penaltyStat.toUpperCase();
                Darbyon.addLog('Noise meter: too loud, everyone loses ' + text);
                const fallen = giveEveryone(settings.penaltyStat, -settings.penaltyAmount);
                if (settings.sounds) beep(2);
                Darbyon.toast('Too loud! Everyone loses ' + text + '.', 'speaker');
                if (fallen.length) Darbyon.Battle.start(fallen);
            }

            function reward() {
                quietSince = Date.now();      // start counting towards the next reward
                const text = settings.rewardAmount + ' ' + settings.rewardStat.toUpperCase();
                Darbyon.addLog('Noise meter: quiet working, everyone gets ' + text);
                giveEveryone(settings.rewardStat, settings.rewardAmount);
                if (settings.sounds) beep(1);
                Darbyon.toast('Great quiet working! Everyone gets ' + text + '.', 'star');
            }

            return { close: stopListening };
        }
    };

    TOOLS.poll = {
        title: 'Class Poll',
        width: 480,
        build(body) {
            let typing = false;      // true while the teacher is writing a new poll

            function form() {
                typing = true;
                body.appendChild(el('p', 'Students answer on their own devices, on My Character.', 'hint'));
                const question = document.createElement('input');
                question.type = 'text';
                question.placeholder = 'Question';
                question.setAttribute('aria-label', 'Question');
                question.maxLength = 120;
                body.appendChild(question);
                const list = el('div', null, 'poll-options');
                const addOption = text => {
                    if (list.children.length >= 6) return;
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.placeholder = 'Answer ' + (list.children.length + 1);
                    input.setAttribute('aria-label', input.placeholder);
                    input.maxLength = 60;
                    input.value = text || '';
                    list.appendChild(input);
                };
                ['', ''].forEach(addOption);
                body.appendChild(list);
                const notice = el('p', '', 'notice error');
                const actions = el('div', null, 'actions');
                actions.appendChild(button('Add an Answer', 'soft small', () => addOption('')));
                actions.appendChild(button('Start Poll', '', () => {
                    const options = Array.from(list.querySelectorAll('input')).map(i => i.value.trim()).filter(Boolean);
                    if (!question.value.trim() || options.length < 2) {
                        notice.textContent = 'Type a question and at least two answers.';
                        return;
                    }
                    Darbyon.startPoll(question.value.trim(), options);
                    typing = false;
                    draw();
                }));
                body.appendChild(actions);
                body.appendChild(notice);
                question.focus();
            }

            function results(info) {
                const { poll, counts, voters } = info;
                body.appendChild(el('p', poll.question, 'poll-question'));
                const most = Math.max(1, ...counts);
                poll.options.forEach((text, i) => {
                    const row = el('div', null, 'poll-row');
                    row.appendChild(el('span', text, 'poll-answer'));
                    const bar = el('div', null, 'leader-bar');
                    const fill = el('div', null, 'leader-fill');
                    fill.style.width = Math.round(100 * counts[i] / most) + '%';
                    bar.appendChild(fill);
                    row.appendChild(bar);
                    row.appendChild(el('span', String(counts[i]), 'poll-count'));
                    body.appendChild(row);
                });
                const players = Darbyon.getCharacters().length;
                body.appendChild(el('p', voters + ' of ' + players + ' students have voted' +
                    (poll.open ? '.' : '. The poll is closed.'), 'hint'));
                const actions = el('div', null, 'actions');
                if (poll.open) actions.appendChild(button('Close Poll', 'secondary', () => { Darbyon.closePoll(); draw(); }));
                actions.appendChild(button('New Poll', poll.open ? 'soft' : '', () => {
                    if (poll.open) Darbyon.closePoll();
                    body.innerHTML = '';
                    form();
                }));
                body.appendChild(actions);
            }

            function draw() {
                if (typing) return;      // do not wipe a poll the teacher is still writing
                body.innerHTML = '';
                if (!Darbyon.isServer()) {
                    body.appendChild(el('p', 'Polls need DårbCRÅFT running on the class server, so students can vote from their devices.', 'hint'));
                    return;
                }
                const info = Darbyon.pollResults();
                if (info) results(info); else form();
            }
            draw();
            return { refresh: draw };
        }
    };

    TOOLS.requests = {
        title: 'Power Requests',
        width: 520,
        build(body) {
            const list = el('div', null, 'requests');
            const notice = el('p', '', 'notice');
            notice.setAttribute('role', 'status');
            body.appendChild(list);
            body.appendChild(notice);
            function draw() {
                if (!Darbyon.isServer()) {
                    list.innerHTML = '';
                    list.appendChild(el('p', 'Students can ask to use powers when DårbCRÅFT runs on the class server.', 'hint'));
                    return;
                }
                Darbyon.Requests.render(list, (text, kind) => {
                    notice.textContent = text;
                    notice.className = 'notice ' + kind;
                    refreshAll();
                });
            }
            draw();
            return { refresh: draw };
        }
    };

    TOOLS.damage = {
        title: 'Quick Damage',
        width: 520,
        build(body) {
            const chosen = new Set();
            const players = el('div', null, 'damage-players');
            const reasons = el('div', null, 'damage-buttons');
            const notice = el('p', '', 'notice');
            notice.setAttribute('role', 'status');
            const undoRow = el('div', null, 'damage-undo');
            let lastHit = '';
            const undo = button('Undo', 'soft small', () => {
                const label = Darbyon.undoAction(lastHit);
                notice.textContent = label ? 'Undone: ' + label : 'Something else has changed since, so use Undo on Update Values.';
                notice.className = 'notice ' + (label ? 'success' : 'error');
                lastHit = '';
                undo.hidden = true;
                refreshAll();
            });
            undo.hidden = true;
            undoRow.appendChild(notice);
            undoRow.appendChild(undo);
            body.appendChild(el('p', 'Tap players, then a reason.', 'hint'));
            [players, reasons, undoRow].forEach(n => body.appendChild(n));

            function draw() {
                players.innerHTML = '';
                const everyone = Darbyon.getCharacters().slice().sort((a, b) => a.name.localeCompare(b.name));
                Array.from(chosen).forEach(id => { if (!everyone.some(p => p.id === id)) chosen.delete(id); });
                if (!everyone.length) players.appendChild(el('p', 'There are no players yet.', 'hint'));
                everyone.forEach(player => {
                    const pick = button('', 'damage-player' + (chosen.has(player.id) ? ' chosen' : '') + (player.hp === 0 ? ' fallen' : ''), () => {
                        if (chosen.has(player.id)) chosen.delete(player.id); else chosen.add(player.id);
                        draw();
                    });
                    pick.setAttribute('aria-pressed', chosen.has(player.id) ? 'true' : 'false');
                    pick.appendChild(Darbyon.avatarImage(player));
                    pick.appendChild(el('span', player.name));
                    pick.appendChild(Darbyon.iconText('heart', player.hp, 'span', 'damage-hp'));
                    players.appendChild(pick);
                });
                reasons.innerHTML = '';
                Darbyon.getDamages().forEach(damage => {
                    const hit = button('', 'damage-button', () => {
                        const ids = Array.from(chosen);
                        if (!ids.length) {
                            notice.textContent = 'Tap a player first.';
                            notice.className = 'notice error';
                            return;
                        }
                        const names = Darbyon.getCharacters().filter(p => chosen.has(p.id)).map(p => p.name);
                        const fallen = Darbyon.dealDamage(ids, damage.id);
                        lastHit = Darbyon.lastUndoId();
                        undo.hidden = !lastHit;
                        chosen.clear();
                        notice.textContent = '−' + damage.hp + ' HP to ' + names.join(', ') + ' (' + damage.text + ')';
                        notice.className = 'notice success';
                        refreshAll();
                        Darbyon.Battle.start(fallen);
                    });
                    hit.appendChild(el('span', damage.text));
                    hit.appendChild(el('strong', '−' + damage.hp + ' HP'));
                    reasons.appendChild(hit);
                });
            }
            draw();
            return { refresh: draw };
        }
    };

    // ---- Toolbar, background and full screen -----------------------------

    document.querySelectorAll('[data-widget]').forEach(b => {
        b.addEventListener('click', () => openTool(b.dataset.widget));
    });

    function setBackground(name) {
        board.dataset.background = BACKGROUNDS.indexOf(name) === -1 ? BACKGROUNDS[0] : name;
    }
    document.getElementById('backgroundButton').addEventListener('click', () => {
        setBackground(BACKGROUNDS[(BACKGROUNDS.indexOf(board.dataset.background) + 1) % BACKGROUNDS.length]);
        saveLayout();
    });

    // Full screen: Safari on iPad needs the older "webkit" names; iPhones
    // cannot do it at all, so the button is hidden there.
    // ---- Projector mode --------------------------------------------------

    const PROJECTOR_KEY = 'darbyon-board-projector';
    const projectorButton = document.getElementById('projectorButton');

    // The grid needs to know how many tools are open to choose its columns.
    function countTools() {
        board.dataset.tools = Math.min(Object.keys(open).length, 4);
    }

    function setProjector(on) {
        board.classList.toggle('projector', on);
        projectorButton.setAttribute('aria-pressed', on ? 'true' : 'false');
        projectorButton.lastChild.textContent = on ? ' Exit Projector' : ' Projector';
        try { localStorage.setItem(PROJECTOR_KEY, on ? '1' : ''); } catch (err) { /* storage off */ }
        if (!on) Object.values(open).forEach(entry => keepInside(entry.node));
    }

    projectorButton.addEventListener('click', () => {
        const on = !board.classList.contains('projector');
        setProjector(on);
        // Projector mode is meant for the big screen, so fill it.
        if (on && canFullscreen && !fullscreenElement()) (board.requestFullscreen || board.webkitRequestFullscreen).call(board);
    });

    const fullscreenButton = document.getElementById('fullscreenButton');
    const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
    const canFullscreen = !!(board.requestFullscreen || board.webkitRequestFullscreen);
    fullscreenButton.hidden = !canFullscreen;
    fullscreenButton.addEventListener('click', () => {
        if (fullscreenElement()) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            (board.requestFullscreen || board.webkitRequestFullscreen).call(board);
        }
    });
    const fullscreenChanged = () => {
        fullscreenButton.lastChild.textContent = fullscreenElement() ? ' Exit Full Screen' : ' Full Screen';
        Object.values(open).forEach(entry => keepInside(entry.node));
    };
    document.addEventListener('fullscreenchange', fullscreenChanged);
    document.addEventListener('webkitfullscreenchange', fullscreenChanged);
    window.addEventListener('resize', () => Object.values(open).forEach(entry => keepInside(entry.node)));

    // ---- Keeping up with the class ---------------------------------------

    let waitingBefore = 0;
    function refreshAll() {
        Darbyon.announceLevelUps();
        Object.values(open).forEach(entry => { if (entry.tool.refresh) entry.tool.refresh(); });
        const waiting = Darbyon.isServer() ? Darbyon.pendingRequests().length : 0;
        const badge = document.getElementById('requestCount');
        badge.textContent = waiting;
        badge.hidden = !waiting;
        if (waiting > waitingBefore) {
            openTool('requests');
            beep(1);
        }
        waitingBefore = waiting;
    }

    const layout = loadLayout();
    setBackground(layout.background);
    let projectorWas = '';
    try { projectorWas = localStorage.getItem(PROJECTOR_KEY); } catch (err) { /* storage off */ }
    setProjector(!!projectorWas);
    (layout.open || []).forEach(place => { if (TOOLS[place.name]) openTool(place.name, place); });
    empty.hidden = Object.keys(open).length > 0;
    Darbyon.onChange(refreshAll, { poll: Darbyon.isServer(), every: 3000 });
    refreshAll();
});
