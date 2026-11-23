/*
 * DårbCRÅFT shared code.
 *
 * Every page loads this file first. It owns all reading and writing of the
 * class data, so the pages never need to know where the data is kept.
 *
 * The data lives in one of two places, chosen automatically:
 *   - "server" mode: the site is running on the DårbCRÅFT server (the
 *     Raspberry Pi). Data is kept there and shared by every device. Changes
 *     need the teacher to be logged in.
 *   - "local" mode: no server was found (for example on GitHub Pages). Data
 *     is kept in this browser only, as it always was.
 */
const Darbyon = (() => {
    'use strict';

    // ---- Game rules -------------------------------------------------------

    const CLASSES = {
        Warrior: { hp: 10, ap: 15 },
        Healer:  { hp: 8,  ap: 20 },
        Mage:    { hp: 6,  ap: 30 }
    };
    // The avatars a player can choose from, by class. Each one is a picture
    // in the avatars folder, for example avatars/mage-f2.svg.
    const AVATARS = {};
    Object.keys(CLASSES).forEach(type => {
        const key = type.toLowerCase();
        AVATARS[type] = ['m1', 'm2', 'm3', 'f1', 'f2', 'f3'].map(code => key + '-' + code);
    });
    // Change this number whenever the avatar pictures are redrawn. Browsers
    // treat the pictures as new and fetch them again instead of showing
    // copies they saved earlier.
    const AVATAR_VERSION = 4;
    const XP_PER_LEVEL = 5000;
    const MAX_LEVEL = 7;
    const UNDO_LIMIT = 20;
    const LOG_LIMIT = 200;

    // Everything that makes up a class. Used by backup and restore.
    const DATA_KEYS = ['characters', 'teams', 'powers', 'messages', 'punishments',
                       'shownMessages', 'shownPlayers', 'changeLog', 'undoStack',
                       'pictureCodes', 'poll', 'signup', 'events', 'dailyEvent', 'damages'];

    // The pictures students tap, in order, to log in to their own character:
    // sports teams, shown as the team's name in its colours with the sport's
    // symbol. `name` is the short name on the button, `full` the full name.
    // The order matters: saved picture passwords are positions in this list.
    const PICTURES = [
        { sport: 'footy', name: 'Eagles',    full: 'West Coast Eagles',   colour: '#003087', text: '#f2a900' },
        { sport: 'footy', name: 'Dockers',   full: 'Fremantle Dockers',   colour: '#2a0d54', text: '#ffffff' },
        { sport: 'cricket', name: 'Scorchers', full: 'Perth Scorchers',     colour: '#f26722', text: '#1b1400' },
        { sport: 'basketball', name: 'Wildcats',  full: 'Perth Wildcats',      colour: '#b3122a', text: '#ffffff' },
        { sport: 'soccer', name: 'Liverpool', full: 'Liverpool',           colour: '#c8102e', text: '#ffffff' },
        { sport: 'soccer', name: 'Arsenal',   full: 'Arsenal',             colour: '#ffffff', text: '#db0007' },
        { sport: 'soccer', name: 'Man Utd',   full: 'Manchester United',   colour: '#1b1b1b', text: '#fbe122' },
        { sport: 'soccer', name: 'Chelsea',   full: 'Chelsea',             colour: '#034694', text: '#ffffff' },
        { sport: 'basketball', name: 'Lakers',    full: 'Los Angeles Lakers',  colour: '#552583', text: '#fdb927' },
        { sport: 'basketball', name: 'Warriors',  full: 'Golden State Warriors', colour: '#1d428a', text: '#ffc72c' },
        { sport: 'basketball', name: 'Celtics',   full: 'Boston Celtics',      colour: '#007a33', text: '#ffffff' },
        { sport: 'cricket', name: 'Sixers',    full: 'Sydney Sixers',       colour: '#e6007e', text: '#ffffff' }
    ];
    const PICTURE_CODE_LENGTH = 3;

    // What the Battle wheel starts with. Edit the list on the Settings page.
    const DEFAULT_PUNISHMENTS = [
        'Lose 100 XP',
        'Tidy the bookshelf',
        'Ten star jumps',
        'Hand out the books next lesson',
        'Miss your next power turn',
        'Lucky escape! No punishment'
    ];

    // The Classcraft-style power pack, sized for DårbCRÅFT's HP and AP.
    // `type` is who it reaches: 'self', 'team' (one teammate the player
    // chooses) or 'everyone' (every teammate). `reward` is a classroom
    // privilege the teacher grants. `special` is 'protect' or 'revive'.
    const POWER_PACK = [
        // Warriors: tough, look after their team.
        { name: 'Protect', class: 'Warrior', level: 1, type: 'team', apCost: 4, special: 'protect',
          about: 'Guard a teammate. The next time they would lose HP, you take half of it instead.' },
        { name: 'First Aid', class: 'Warrior', level: 1, type: 'self', apCost: 3, hp: 1,
          about: 'Patch yourself up.' },
        { name: 'Hunting Party', class: 'Warrior', level: 2, type: 'everyone', apCost: 6, otherXp: 100,
          about: 'Lead your team on a hunt.' },
        { name: 'Ambush', class: 'Warrior', level: 3, type: 'self', apCost: 5,
          reward: 'Choose where you sit for one lesson.' },
        { name: 'Counter Attack', class: 'Warrior', level: 3, type: 'self', apCost: 6,
          reward: 'Skip one question on a worksheet.' },
        { name: 'Frontal Assault', class: 'Warrior', level: 5, type: 'everyone', apCost: 10, xp: 200, otherXp: 200,
          about: 'Charge! You and your whole team gain XP.' },
        { name: 'Secret Weapon', class: 'Warrior', level: 6, type: 'self', apCost: 12,
          reward: 'Use a helper card (number chart or word list) in one quiz.' },
        // Healers: keep the team in the game.
        { name: 'Heal', class: 'Healer', level: 1, type: 'team', apCost: 4, otherHp: 2,
          about: 'Heal a teammate.' },
        { name: 'Sainthood', class: 'Healer', level: 2, type: 'team', apCost: 5,
          reward: 'Your teammate chooses the next brain break.' },
        { name: 'Ardent Faith', class: 'Healer', level: 2, type: 'self', apCost: 5,
          reward: 'Read in the reading corner during quiet work.' },
        { name: 'Greater Heal', class: 'Healer', level: 3, type: 'team', apCost: 7, otherHp: 4,
          about: 'A big heal for a teammate.' },
        { name: 'Favour of the Gods', class: 'Healer', level: 4, type: 'everyone', apCost: 10,
          reward: 'Your team has music on during independent work.' },
        { name: 'Revive', class: 'Healer', level: 5, type: 'team', apCost: 10, otherHp: 3, special: 'revive',
          about: 'Bring a fallen teammate (0 HP) back into the game.' },
        { name: 'Healing Circle', class: 'Healer', level: 6, type: 'everyone', apCost: 12, otherHp: 2,
          about: 'Heal your whole team at once.' },
        { name: 'Prayer', class: 'Healer', level: 7, type: 'self', apCost: 15,
          reward: 'Use a helper card (number chart or word list) in one quiz.' },
        // Mages: lots of AP, share it around.
        { name: 'Mana Transfer', class: 'Mage', level: 1, type: 'everyone', apCost: 8, otherAp: 3,
          about: 'Share your magic with your team.' },
        { name: 'Mana Shield', class: 'Mage', level: 1, type: 'self', apCost: 5, hp: 1,
          about: 'Turn your magic into a shield.' },
        { name: 'Time Warp', class: 'Mage', level: 2, type: 'self', apCost: 6,
          reward: 'Get 2 extra minutes to finish a task.' },
        { name: 'Teleport', class: 'Mage', level: 3, type: 'self', apCost: 8,
          reward: 'Swap seats with any classmate for one lesson (if your teacher says yes).' },
        { name: 'Invisibility', class: 'Mage', level: 4, type: 'self', apCost: 10,
          reward: 'Skip the warm-up activity once.' },
        { name: 'Cheat Death', class: 'Mage', level: 4, type: 'team', apCost: 10,
          reward: 'A teammate in Battle spins the Battle wheel again and takes the new result.' },
        { name: 'Fountain of Mana', class: 'Mage', level: 5, type: 'team', apCost: 12, otherAp: 10,
          about: 'Fill up a teammate\'s AP.' },
        { name: 'Clairvoyance', class: 'Mage', level: 6, type: 'everyone', apCost: 15,
          reward: 'Your team gets one hint from your teacher in a quiz.' }
    ];

    // The Wheel of Destiny, spun once a day on the Home page.
    // `who`: 'all' players, 'one' random player, 'team' a random team, or
    // 'none' (no change to anyone's stats). {name} and {team} in the text
    // are filled in with who the wheel chose.
    const DEFAULT_EVENTS = [
        { name: 'Golden Morning', kind: 'game', who: 'all', stat: 'xp', amount: 100, text: 'The sun shines on the whole class. Everyone gains 100 XP.' },
        { name: 'Mana Rain', kind: 'game', who: 'all', stat: 'ap', amount: 3, text: 'Magic falls from the sky. Everyone gains 3 AP.' },
        { name: 'Healing Spring', kind: 'game', who: 'all', stat: 'hp', amount: 1, text: 'A healing spring bubbles up. Everyone gains 1 HP.' },
        { name: 'Lucky Star', kind: 'game', who: 'one', stat: 'xp', amount: 300, text: 'A lucky star lands on {name}: 300 XP!' },
        { name: 'Treasure Chest', kind: 'game', who: 'team', stat: 'xp', amount: 150, text: 'Team {team} finds a treasure chest. Each of them gains 150 XP.' },
        { name: 'Magic Gift', kind: 'game', who: 'one', stat: 'ap', amount: 5, text: 'A wizard gives {name} 5 AP.' },
        { name: 'Storm Clouds', kind: 'game', who: 'all', stat: 'ap', amount: -1, text: 'A storm drains the magic. Everyone loses 1 AP.' },
        { name: 'Speed Round', kind: 'learning', who: 'none', text: 'Start the day with a 2-minute times-tables challenge.' },
        { name: 'Word Wizard', kind: 'learning', who: 'none', text: 'Use a "wow word" in your writing today.' },
        { name: 'Number Detective', kind: 'learning', who: 'none', text: 'Find a number bigger than 1000 somewhere in the classroom.' },
        { name: 'Spelling Duel', kind: 'learning', who: 'none', text: 'Teams quiz each other on this week\'s spelling words.' },
        { name: 'Silent Library', kind: 'learning', who: 'none', text: '10 minutes of silent reading after lunch.' },
        { name: 'Kindness Quest', kind: 'learning', who: 'none', text: 'Give a classmate a kind compliment before recess.' },
        { name: 'Teacher Sings', kind: 'silly', who: 'none', text: 'Your teacher must sing a song the class chooses.' },
        { name: 'Joke Time', kind: 'silly', who: 'none', text: 'Your teacher tells the class a joke.' },
        { name: 'Pirate Maths', kind: 'silly', who: 'none', text: 'Everyone talks like a pirate during maths.' },
        { name: 'Dance Break', kind: 'silly', who: 'none', text: 'One-minute dance break!' },
        { name: 'Backwards Line', kind: 'silly', who: 'none', text: 'Line up in reverse order today.' },
        { name: 'Animal Roll Call', kind: 'silly', who: 'none', text: 'Answer the roll in an animal voice.' }
    ];
    const EVENT_KINDS = { game: 'Game', learning: 'Learning', silly: 'Silly' };

    // Quick Damage: common reasons for losing HP, one tap each.
    const DEFAULT_DAMAGES = [
        { text: 'Calling out', hp: 1 },
        { text: 'Not on task', hp: 1 },
        { text: 'Not listening', hp: 1 },
        { text: 'Not following instructions', hp: 1 },
        { text: 'Late back from break', hp: 1 },
        { text: 'Unkind words', hp: 2 },
        { text: 'Disrespecting others', hp: 2 },
        { text: 'Unsafe behaviour', hp: 3 }
    ];

    const DEFAULT_MESSAGES = [
        { name: 'Electrical Storm', description: 'Everyone loses 2 HP' },
        { name: 'Sunny Day Feeling', description: 'Everyone gains 100XP' },
        { name: 'Shuffle!', description: 'Leave your chair where it is and move to another desk. Run and you lose HP' }
    ];

    // ---- Storage ----------------------------------------------------------

    let mode = 'local';          // 'local' or 'server'
    let role = 'teacher';        // 'teacher', 'viewer' (may look), 'student' (logged in to their
                                 // own character) or 'locked' (must type the class code)
    let signupOpen = false;      // server mode: whether new students may sign themselves up
    let cache = {};              // server mode: the lists as last loaded or changed
    let revs = {};               // server mode: revision number of each list
    const unsaved = new Set();   // server mode: lists changed here but not yet sent
    let sending = false;
    const changeListeners = [];

    const clone = value => JSON.parse(JSON.stringify(value));

    function has(key) {
        if (mode === 'server') return Object.prototype.hasOwnProperty.call(cache, key);
        return localStorage.getItem(key) !== null;
    }

    function read(key, fallback) {
        if (mode === 'server') return has(key) ? clone(cache[key]) : fallback;
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value === null || value === undefined ? fallback : value;
        } catch (err) {
            console.error('Could not read "' + key + '" from storage', err);
            return fallback;
        }
    }

    function write(key, value) {
        if (mode !== 'server') {
            localStorage.setItem(key, JSON.stringify(value));
            return;
        }
        if (role !== 'teacher') return;      // visitors can look but not change
        cache[key] = clone(value);
        queueSave(key);
    }

    function remove(key) {
        if (mode !== 'server') {
            localStorage.removeItem(key);
            return;
        }
        if (role !== 'teacher') return;
        delete cache[key];
        queueSave(key);
    }

    // ---- Talking to the server -------------------------------------------

    function api(path, body) {
        const options = { credentials: 'same-origin', cache: 'no-store' };
        if (body !== undefined) {
            options.method = 'POST';
            options.headers = { 'Content-Type': 'application/json', 'X-Darbyon': '1' };
            options.body = JSON.stringify(body);
        }
        return fetch(path, options);
    }

    // One action often changes several lists (players, undo, log). They are
    // collected and sent to the server together as a single save.
    function queueSave(key) {
        unsaved.add(key);
        if (!sending) {
            sending = true;
            Promise.resolve().then(sendSaves);
        }
    }

    async function sendSaves() {
        while (unsaved.size) {
            const keys = Array.from(unsaved);
            unsaved.clear();
            const changes = {};
            keys.forEach(key => {
                changes[key] = { value: has(key) ? cache[key] : null, rev: revs[key] || 0 };
            });
            let response;
            try {
                response = await api('api/save', { changes: changes });
            } catch (err) {
                response = null;
            }
            if (response && response.ok) {
                Object.assign(revs, (await response.json()).revs);
                showProblem(null);
                continue;
            }
            saveWaiters.splice(0).forEach(waiter => waiter(false));
            if (response && response.status === 409) {
                showProblem('The class was changed on another device or tab, so your last change was not saved. Reloading…');
                setTimeout(() => location.reload(), 2500);
                return;
            }
            if (response && response.status === 401) {
                role = 'viewer';
                showProblem('You have been logged out, so your last change was NOT saved. Reload the page and log in again.');
                return;
            }
            // The server could not be reached: keep the changes and try again shortly.
            keys.forEach(key => unsaved.add(key));
            showProblem('Cannot reach the server. Your changes are NOT saved yet. Trying again…');
            setTimeout(sendSaves, 4000);
            return;
        }
        sending = false;
        saveWaiters.splice(0).forEach(waiter => waiter(true));
    }

    // Resolves to true once every change made so far has reached the server
    // (or straight away in local mode), or false if saving failed.
    const saveWaiters = [];
    function saved() {
        if (mode !== 'server' || (!sending && !unsaved.size)) return Promise.resolve(true);
        return new Promise(resolve => saveWaiters.push(resolve));
    }

    // Fetches the latest class from the server and redraws the page if
    // anything changed, so a second screen keeps up with the teacher.
    async function refresh(force) {
        if (mode !== 'server' || sending || unsaved.size) return;
        let state;
        try {
            const response = await api('api/state');
            if (!response.ok) return;
            state = await response.json();
        } catch (err) {
            return;
        }
        if (sending || unsaved.size) return;
        if (state.role !== role) {
            location.reload();
            return;
        }
        if (!force && JSON.stringify(state.revs) === JSON.stringify(revs) && !!state.signup === signupOpen) return;   // nothing new
        signupOpen = !!state.signup;
        cache = state.data;
        revs = state.revs;
        changeListeners.forEach(listener => listener());
    }

    // Pages pass their redraw function here. With { poll: true } the page
    // also checks for changes every few seconds (used by the class views);
    // { every: 3000 } sets how often, in milliseconds.
    function onChange(listener, options) {
        changeListeners.push(listener);
        if (options && options.poll) {
            setInterval(() => { if (!document.hidden) refresh(); }, options.every || 10000);
        }
    }

    function showProblem(text) {
        let banner = document.getElementById('problemBanner');
        if (!text) {
            if (banner) banner.remove();
            return;
        }
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'problemBanner';
            banner.className = 'problem-banner';
            banner.setAttribute('role', 'alert');
            document.body.prepend(banner);
        }
        banner.textContent = text;
    }

    function newId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function toInt(value) {
        const n = parseInt(value, 10);
        return isNaN(n) ? 0 : n;
    }

    function firstDefined() {
        for (let i = 0; i < arguments.length; i++) {
            if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== '') {
                return arguments[i];
            }
        }
        return 0;
    }

    // ---- Characters -------------------------------------------------------

    function getLevel(xp) {
        return Math.min(MAX_LEVEL, Math.floor(Math.max(0, toInt(xp)) / XP_PER_LEVEL) + 1);
    }

    // Returns the characters in a guaranteed shape. Older saved data had no
    // ids and sometimes stored numbers as text, so it is repaired on the way in.
    function getCharacters() {
        const raw = read('characters', []);
        if (!Array.isArray(raw)) return [];
        let repaired = false;
        const characters = raw.filter(c => c && typeof c === 'object').map(c => {
            if (!c.id) repaired = true;
            return {
                id: c.id || newId(),
                name: String(c.name === undefined ? '' : c.name),
                type: String(c.type || 'Warrior'),
                xp: toInt(c.xp),
                ap: toInt(c.ap),
                hp: toInt(c.hp),
                team: String(c.team || ''),
                avatar: /^[a-z]+-[mf][1-3]$/.test(c.avatar || '') ? c.avatar : '',
                // ids of the powers this player has; an empty list means they can use every power
                powers: Array.isArray(c.powers) ? c.powers.map(String) : [],
                // id of the Warrior protecting this player, if any
                shield: String(c.shield || '')
            };
        });
        if (repaired) write('characters', characters);
        return characters;
    }

    // Saves the characters. Pass a label to make the change undoable.
    // Saves the class. With an undoLabel the old class is kept so Undo can
    // put it back; `extra` may hold { dailyEvent } to restore as well.
    // Returns the undo id (or '' when nothing can be undone).
    let lastUndo = '';
    function saveCharacters(characters, undoLabel, extra) {
        let id = '';
        if (undoLabel) {
            id = newId();
            const stack = read('undoStack', []);
            stack.push(Object.assign({ id: id, label: undoLabel, characters: getCharacters() }, extra || {}));
            write('undoStack', stack.slice(-UNDO_LIMIT));
            lastUndo = id;
        }
        write('characters', characters);
        return id;
    }

    // ---- History (for the weekly summary) ---------------------------------
    // Short entries: t time, c character id, n name, k kind ('stat', 'power'
    // or 'battle'), s stat, d change, r reason, p power, u undo id.
    // On the class server they live apart from everything else, so the pages
    // that refresh every few seconds never download them.

    const HISTORY_LIMIT = 30000;
    let historyQueue = [];
    let historyTimer = null;

    function recordHistory(entries, undoId) {
        if (!entries.length) return;
        const now = Date.now();
        entries = entries.map(e => Object.assign({ t: now, u: undoId || '' }, e));
        if (mode !== 'server') {
            write('history', read('history', []).concat(entries).slice(-HISTORY_LIMIT));
            return;
        }
        historyQueue = historyQueue.concat(entries);
        clearTimeout(historyTimer);
        historyTimer = setTimeout(sendHistory, 400);
    }

    async function sendHistory(remove) {
        const batch = historyQueue;
        historyQueue = [];
        const result = await postJson('api/history', remove ? { add: batch, remove: remove } : { add: batch });
        if (!result.ok) {
            historyQueue = batch.concat(historyQueue);          // try again with the next change
            if (remove) setTimeout(() => sendHistory(remove), 3000);
        }
    }

    function forgetHistory(undoId) {
        if (!undoId) return;
        if (mode !== 'server') {
            write('history', read('history', []).filter(e => e.u !== undoId));
            return;
        }
        clearTimeout(historyTimer);
        sendHistory(undoId);
    }

    async function getHistory() {
        if (mode !== 'server') return read('history', []);
        clearTimeout(historyTimer);
        if (historyQueue.length) await sendHistory();
        try {
            const response = await api('api/history');
            return response.ok ? ((await response.json()).entries || []) : [];
        } catch (err) {
            return [];
        }
    }

    function addCharacter(name, type) {
        const base = CLASSES[type];
        if (!base) throw new Error('Unknown character type: ' + type);
        const characters = getCharacters();
        characters.push({ id: newId(), name: name, type: type, xp: 0, ap: base.ap, hp: base.hp, team: '', avatar: '', powers: [] });
        saveCharacters(characters);
    }

    // Adds a whole list of students in one go (used by the bulk import).
    // Each student is { name, type, avatar, powers, team }. With `replace`
    // the existing characters are removed first; otherwise anyone whose name
    // is already in the class is left alone. Returns how many were added.
    function importCharacters(students, replace) {
        const characters = replace ? [] : getCharacters();
        const taken = characters.map(c => c.name.toLowerCase());
        let added = 0;
        students.forEach(student => {
            const base = CLASSES[student.type];
            if (!base || !student.name || taken.indexOf(student.name.toLowerCase()) !== -1) return;
            taken.push(student.name.toLowerCase());
            if (student.team) addTeam(student.team);      // does nothing if the team already exists
            const team = getTeams().find(t => t.name.toLowerCase() === (student.team || '').toLowerCase());
            characters.push({ id: newId(), name: student.name, type: student.type, xp: 0, ap: base.ap, hp: base.hp,
                              team: team ? team.name : '', avatar: student.avatar || '', powers: student.powers || [] });
            added++;
        });
        if (replace) {
            write('shownPlayers', []);
            write('undoStack', []);
        }
        saveCharacters(characters);
        addLog('Imported ' + added + ' students' + (replace ? ', replacing the previous class' : ''));
        return added;
    }

    function updateCharacter(id, changes) {
        const characters = getCharacters();
        const character = characters.find(c => c.id === id);
        if (!character) return;
        Object.assign(character, changes);
        saveCharacters(characters);
    }

    function deleteCharacter(id) {
        saveCharacters(getCharacters().filter(c => c.id !== id));
        write('shownPlayers', read('shownPlayers', []).filter(shownId => shownId !== id));
    }

    // Adds `amount` to one stat ('xp', 'ap' or 'hp') for each listed character.
    // Stats never drop below zero. The whole award is one undo step.
    // Returns the players whose HP just reached zero, so the page can send
    // them into Battle.
    // A player guarded by a Warrior's Protect loses nothing; the Warrior
    // takes half the damage (rounded up) instead, and the guard is used up.
    // `reason` (optional) is added to the change log.
    function adjustStat(ids, stat, amount, reason, undoExtra) {
        amount = toInt(amount);
        const fallen = [];
        if (!amount || ['xp', 'ap', 'hp'].indexOf(stat) === -1) return fallen;
        const characters = getCharacters();
        const entries = [];
        const history = [];
        const why = reason ? ' (' + reason + ')' : '';
        const hurt = (c, damage, note) => {
            const before = c.hp;
            c.hp = Math.max(0, before - damage);
            if (c.hp !== before) history.push({ c: c.id, n: c.name, k: 'stat', s: 'hp', d: c.hp - before, r: note || reason || '' });
            if (before > 0 && c.hp === 0) {
                fallen.push({ id: c.id, name: c.name });
                history.push({ c: c.id, n: c.name, k: 'battle', r: note || reason || '' });
            }
            return before;
        };
        characters.forEach(c => {
            if (ids.indexOf(c.id) === -1) return;
            const guard = stat === 'hp' && amount < 0 && c.shield
                ? characters.find(p => p.id === c.shield && p.id !== c.id && p.hp > 0) : null;
            if (stat === 'hp' && amount < 0 && c.shield) c.shield = '';
            if (guard) {
                const damage = Math.ceil(-amount / 2);
                const before = hurt(guard, damage, 'Protected ' + c.name + (reason ? ' from: ' + reason : ''));
                entries.push(guard.name + ' protected ' + c.name + ' / HP / ' + before + ' -> ' + guard.hp + why);
                return;
            }
            const before = c[stat];
            if (stat === 'hp' && amount < 0) hurt(c, -amount);
            else {
                c[stat] = Math.max(0, before + amount);
                if (c[stat] !== before) history.push({ c: c.id, n: c.name, k: 'stat', s: stat, d: c[stat] - before, r: reason || '' });
            }
            entries.push(c.name + ' / ' + stat.toUpperCase() + ' / ' + before + ' -> ' + c[stat] + why);
        });
        if (!entries.length) return fallen;
        const sign = amount > 0 ? '+' : '';
        const who = entries.length === 1 ? entries[0].split(' / ')[0] : entries.length + ' players';
        const undoId = saveCharacters(characters, sign + amount + ' ' + stat.toUpperCase() + ' to ' + who + why, undoExtra);
        entries.forEach(addLog);
        recordHistory(history, undoId);
        return fallen;
    }

    // ---- Undo -------------------------------------------------------------

    function peekUndo() {
        const stack = read('undoStack', []);
        return stack.length ? stack[stack.length - 1].label : null;
    }

    function undo() {
        const stack = read('undoStack', []);
        const last = stack.pop();
        if (!last) return null;
        write('characters', last.characters);
        if (last.dailyEvent !== undefined) write('dailyEvent', last.dailyEvent);
        write('undoStack', stack);
        forgetHistory(last.id);
        addLog('Undid: ' + last.label);
        return last.label;
    }

    // Undoes one particular action, but only if nothing has been changed
    // since; otherwise returns null and changes nothing.
    function undoAction(id) {
        const stack = read('undoStack', []);
        return id && stack.length && stack[stack.length - 1].id === id ? undo() : null;
    }

    // ---- Change log -------------------------------------------------------

    function getLog() {
        return read('changeLog', []);
    }

    function addLog(text) {
        const log = getLog();
        log.push({ time: new Date().toLocaleString(), text: text });
        write('changeLog', log.slice(-LOG_LIMIT));
    }

    function clearLog() {
        write('changeLog', []);
    }

    // ---- Teams ------------------------------------------------------------
    // A team is just a name. Membership lives on each character's `team`.

    function getTeams() {
        const raw = read('teams', []);
        if (!Array.isArray(raw)) return [];
        return raw.filter(t => t && t.name).map(t => ({ name: String(t.name) }));
    }

    function addTeam(name) {
        name = name.trim();
        if (!name) return 'Please enter a team name.';
        const teams = getTeams();
        if (teams.some(t => t.name.toLowerCase() === name.toLowerCase())) return 'This team already exists.';
        teams.push({ name: name });
        write('teams', teams);
        return null;
    }

    function renameTeam(oldName, newName) {
        newName = newName.trim();
        if (!newName || newName === oldName) return null;
        const teams = getTeams();
        if (teams.some(t => t.name.toLowerCase() === newName.toLowerCase() && t.name !== oldName)) {
            return 'This team already exists.';
        }
        teams.forEach(t => { if (t.name === oldName) t.name = newName; });
        write('teams', teams);
        const characters = getCharacters();
        characters.forEach(c => { if (c.team === oldName) c.team = newName; });
        saveCharacters(characters);
        return null;
    }

    function deleteTeam(name) {
        write('teams', getTeams().filter(t => t.name !== name));
        const characters = getCharacters();
        characters.forEach(c => { if (c.team === name) c.team = ''; });
        saveCharacters(characters);
    }

    // ---- Powers -----------------------------------------------------------

    // Earlier versions of the site saved powers under several different field
    // names. This reads any of them and returns one consistent shape.
    function normalisePower(p) {
        const otherXp = toInt(firstDefined(p.otherXp, p.otherPlayerxp, p.otherPlayerXP));
        const otherAp = toInt(firstDefined(p.otherAp, p.otherPlayerAP));
        const otherHp = toInt(firstDefined(p.otherHp, p.otherPlayerHP));
        let type;
        if (p.type === 'team' || p.type === 'self' || p.type === 'everyone') type = p.type;
        else if (p.target === 'other') type = 'team';
        else if (p.target === 'self') type = 'self';
        else type = (otherXp || otherAp || otherHp) ? 'team' : 'self';
        return {
            id: p.id || newId(),
            name: String(p.name || ''),
            type: type,
            xp: toInt(firstDefined(p.xp, p.xpEffect)),
            apCost: p.apCost !== undefined ? Math.max(0, toInt(p.apCost))
                                           : Math.abs(toInt(firstDefined(p.ap, p.apEffect))),
            hp: toInt(firstDefined(p.hp, p.hpEffect)),
            otherXp: otherXp,
            otherAp: otherAp,
            otherHp: otherHp,
            // '' means any class can have it
            class: CLASSES[p.class] ? p.class : '',
            level: Math.min(MAX_LEVEL, Math.max(1, toInt(p.level) || 1)),
            reward: String(p.reward || '').trim().slice(0, 160),
            about: String(p.about || '').trim().slice(0, 160),
            special: p.special === 'protect' || p.special === 'revive' ? p.special : ''
        };
    }

    function getPowers() {
        const raw = read('powers', []);
        if (!Array.isArray(raw)) return [];
        const needsRepair = raw.some(p => p && (!p.id || p.apCost === undefined));
        const powers = raw.filter(p => p && typeof p === 'object').map(normalisePower);
        if (needsRepair) write('powers', powers);
        return powers;
    }

    // Adds a power, or replaces the one with the same id.
    function savePower(power) {
        const clean = normalisePower(power);
        if (clean.type === 'self') clean.otherXp = clean.otherAp = clean.otherHp = 0;
        if (clean.type !== 'team') clean.special = '';
        const powers = getPowers();
        const index = powers.findIndex(p => p.id === clean.id);
        if (index === -1) powers.push(clean); else powers[index] = clean;
        write('powers', powers);
    }

    function deletePower(id) {
        write('powers', getPowers().filter(p => p.id !== id));
        const characters = getCharacters();
        if (characters.some(c => c.powers.indexOf(id) !== -1)) {
            characters.forEach(c => { c.powers = c.powers.filter(powerId => powerId !== id); });
            saveCharacters(characters);
        }
    }

    // Adds the Classcraft-style power pack, skipping any power whose name
    // the class already has. Returns how many were added.
    function addPowerPack() {
        const powers = getPowers();
        const names = powers.map(p => p.name.toLowerCase());
        let added = 0;
        POWER_PACK.forEach(p => {
            if (names.indexOf(p.name.toLowerCase()) !== -1) return;
            powers.push(normalisePower(Object.assign({ id: newId() }, p)));
            added++;
        });
        write('powers', powers);
        if (added) addLog('Added the power pack (' + added + ' powers)');
        return added;
    }

    // The powers a player may see: the ones they have been given, or every
    // power for their class if they have not been given any. Locked powers
    // (level too low) are included; see powerLock.
    function powersFor(character) {
        const all = getPowers();
        const own = all.filter(p => character.powers.indexOf(p.id) !== -1);
        return own.length ? own : all.filter(p => !p.class || p.class === character.type);
    }

    // Why a player cannot use a power yet, or '' if they can.
    function powerLock(character, power) {
        if (power.class && power.class !== character.type) return 'Only for ' + power.class + 's';
        if (getLevel(character.xp) < power.level) return 'Unlocks at level ' + power.level;
        return '';
    }

    // Who a power reaches, in words, and what it does to them.
    function describePower(power) {
        const lines = [];
        const self = describeEffect(power.xp, 0, power.hp);
        const others = describeEffect(power.otherXp, power.otherAp, power.otherHp);
        if (self !== 'No effect') lines.push('You: ' + self);
        if (power.special === 'protect') lines.push('Teammate: protected from their next HP loss');
        else if (power.special === 'revive') lines.push('Fallen teammate: back with ' + Math.max(1, power.otherHp) + ' HP');
        else if (power.type === 'team' && others !== 'No effect') lines.push('Teammate: ' + others);
        else if (power.type === 'everyone' && others !== 'No effect') lines.push('Every teammate: ' + others);
        if (power.reward) lines.push('Reward: ' + power.reward);
        return lines;
    }

    const REACH = { self: 'Just you', team: 'One teammate', everyone: 'Whole team' };

    function signed(n) {
        return (n > 0 ? '+' : '') + n;
    }

    function describeEffect(xp, ap, hp) {
        const parts = [];
        if (xp) parts.push(signed(xp) + ' XP');
        if (ap) parts.push(signed(ap) + ' AP');
        if (hp) parts.push(signed(hp) + ' HP');
        return parts.length ? parts.join(', ') : 'No effect';
    }

    // The player pays the AP cost and receives the power's own XP and HP
    // effect. A team power also changes the chosen teammate, who must be on
    // the same team as the player.
    // Returns { ok: true } or { ok: false, error: '...' }.
    function applyPower(userId, powerId, targetId) {
        const characters = getCharacters();
        const power = getPowers().find(p => p.id === powerId);
        const user = characters.find(c => c.id === userId);
        if (!power) return { ok: false, error: 'Please select a power first!' };
        if (!user) return { ok: false, error: 'That player no longer exists.' };
        if (!powersFor(user).some(p => p.id === power.id)) {
            return { ok: false, error: user.name + ' does not have the power ' + power.name + '.' };
        }
        const lock = powerLock(user, power);
        if (lock) return { ok: false, error: power.name + ': ' + lock + '. ' + user.name + ' is level ' + getLevel(user.xp) + '.' };

        let target = null;
        let everyone = [];
        if (power.type === 'everyone') {
            everyone = characters.filter(c => user.team && c.team === user.team && c.id !== user.id);
            if (!user.team) return { ok: false, error: user.name + ' is not in a team, so cannot use a team power.' };
            if (!everyone.length) return { ok: false, error: user.name + ' has no teammates yet.' };
        }
        if (power.type === 'team') {
            target = characters.find(c => c.id === targetId);
            if (!user.team) {
                return { ok: false, error: user.name + ' is not in a team, so cannot use a team power.' };
            }
            if (!target || target.id === user.id) {
                return { ok: false, error: 'Please select a teammate to receive this power!' };
            }
            if (target.team !== user.team) {
                return { ok: false, error: target.name + ' is not on ' + user.name + "'s team." };
            }
            if (power.special === 'revive' && target.hp > 0) {
                return { ok: false, error: power.name + ' only works on a teammate with 0 HP. ' + target.name + ' has ' + target.hp + ' HP.' };
            }
        }
        if (user.ap < power.apCost) {
            return { ok: false, error: 'Not enough AP to use this power! ' + user.name + ' has ' +
                                       user.ap + ' AP and ' + power.name + ' costs ' + power.apCost + '.' };
        }

        const fallen = [];
        const startStats = new Map(characters.map(c => [c.id, { xp: c.xp, ap: c.ap, hp: c.hp }]));
        const userHpBefore = user.hp;
        user.ap -= power.apCost;
        user.xp = Math.max(0, user.xp + power.xp);
        user.hp = Math.max(0, user.hp + power.hp);
        if (userHpBefore > 0 && user.hp === 0) fallen.push({ id: user.id, name: user.name });
        let summary = user.name + ' used ' + power.name;
        const affect = mate => {
            const hpBefore = mate.hp;
            mate.xp = Math.max(0, mate.xp + power.otherXp);
            mate.ap = Math.max(0, mate.ap + power.otherAp);
            mate.hp = Math.max(0, mate.hp + power.otherHp);
            if (hpBefore > 0 && mate.hp === 0) fallen.push({ id: mate.id, name: mate.name });
        };
        if (target) {
            if (power.special === 'protect') target.shield = user.id;
            else if (power.special === 'revive') target.hp = Math.max(1, power.otherHp);
            else affect(target);
            summary += ' on ' + target.name;
        }
        if (everyone.length) {
            everyone.forEach(affect);
            summary += ' for team ' + user.team;
        }
        const history = [{ c: user.id, n: user.name, k: 'power', p: power.name,
                           r: target ? target.name : everyone.length ? 'team ' + user.team : '' }];
        characters.forEach(c => {
            const was = startStats.get(c.id);
            const why = 'Power: ' + power.name + (c.id === user.id ? '' : ' from ' + user.name);
            ['xp', 'ap', 'hp'].forEach(stat => {
                if (c[stat] !== was[stat]) history.push({ c: c.id, n: c.name, k: 'stat', s: stat, d: c[stat] - was[stat], r: why });
            });
        });
        fallen.forEach(f => history.push({ c: f.id, n: f.name, k: 'battle', r: 'Power: ' + power.name }));
        recordHistory(history, saveCharacters(characters, summary));
        addLog(summary + (power.reward ? ' (reward: ' + power.reward + ')' : ''));
        return { ok: true, summary: summary, reward: power.reward, fallen: fallen };
    }

    // ---- Daily news -------------------------------------------------------

    function getMessages() {
        if (!has('messages')) write('messages', DEFAULT_MESSAGES);
        const raw = read('messages', []);
        return Array.isArray(raw) ? raw : [];
    }

    function saveMessages(messages) {
        write('messages', messages);
        write('shownMessages', []);   // positions changed, so start the cycle again
    }

    // Picks a news item that has not been shown yet. Once every item has been
    // shown the cycle starts over.
    function nextMessage() {
        const messages = getMessages();
        if (!messages.length) return null;
        let shown = read('shownMessages', []).filter(i => i < messages.length);
        if (shown.length >= messages.length) shown = [];
        const unseen = messages.map((m, i) => i).filter(i => shown.indexOf(i) === -1);
        const pick = unseen[Math.floor(Math.random() * unseen.length)];
        shown.push(pick);
        write('shownMessages', shown);
        return { message: messages[pick], shown: shown.length, total: messages.length };
    }

    function messageProgress() {
        const total = getMessages().length;
        return { shown: Math.min(read('shownMessages', []).length, total), total: total };
    }

    function resetMessages() {
        write('shownMessages', []);
    }

    // ---- Wheel of Destiny -------------------------------------------------

    function normaliseEvent(e) {
        const who = ['all', 'one', 'team', 'none'].indexOf(e.who) !== -1 ? e.who : 'none';
        const stat = ['xp', 'ap', 'hp'].indexOf(e.stat) !== -1 ? e.stat : 'xp';
        return {
            id: e.id || newId(),
            name: String(e.name || '').trim().slice(0, 40),
            text: String(e.text || '').trim().slice(0, 200),
            kind: EVENT_KINDS[e.kind] ? e.kind : 'game',
            who: who,
            stat: stat,
            amount: who === 'none' ? 0 : toInt(e.amount)
        };
    }

    function getEvents() {
        if (!has('events')) return DEFAULT_EVENTS.map(normaliseEvent);
        const raw = read('events', []);
        return Array.isArray(raw) ? raw.filter(e => e && typeof e === 'object').map(normaliseEvent) : [];
    }

    function saveEvents(events) {
        write('events', events.map(normaliseEvent));
    }

    // Today's date in Perth, as 2026-11-23.
    function perthDate() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Perth', year: 'numeric', month: '2-digit', day: '2-digit' })
            .format(new Date());
    }

    // Today's event, or null if the wheel has not been spun today.
    function todaysEvent() {
        const entry = read('dailyEvent', [])[0];
        return entry && entry.date === perthDate() ? entry : null;
    }

    // Spins the wheel: picks an event, picks who it lands on, changes their
    // stats and remembers it as today's event. Returns { index, event, fallen }
    // so the page can turn the wheel to the right slice.
    function spinDestiny() {
        const events = getEvents();
        if (!events.length) return null;
        const index = Math.floor(Math.random() * events.length);
        const event = events[index];
        const characters = getCharacters();
        let ids = [];
        let chosen = '';
        if (event.who === 'all') ids = characters.map(c => c.id);
        if (event.who === 'one' && characters.length) {
            const lucky = characters[Math.floor(Math.random() * characters.length)];
            ids = [lucky.id];
            chosen = lucky.name;
        }
        if (event.who === 'team') {
            const teams = getTeams().map(t => t.name).filter(name => characters.some(c => c.team === name));
            if (teams.length) {
                chosen = teams[Math.floor(Math.random() * teams.length)];
                ids = characters.filter(c => c.team === chosen).map(c => c.id);
            }
        }
        const text = event.text.replace(/\{name\}/g, chosen || 'someone').replace(/\{team\}/g, chosen || 'a team');
        lastUndo = '';
        const fallen = ids.length && event.amount
            ? adjustStat(ids, event.stat, event.amount, 'Wheel of Destiny: ' + event.name, { dailyEvent: read('dailyEvent', []) }) : [];
        write('dailyEvent', [{ date: perthDate(), name: event.name, text: text, kind: event.kind,
                               who: event.who, stat: event.stat, amount: event.amount, chosen: chosen, ids: ids, undo: lastUndo }]);
        addLog('Wheel of Destiny: ' + event.name + '. ' + text);
        return { index: index, event: todaysEvent(), fallen: fallen };
    }

    function clearTodaysEvent() {
        write('dailyEvent', []);
    }

    // Takes back today's spin: its stat changes too, as long as nothing else
    // has changed since. Returns { ok } or { ok: false, error }.
    function undoSpin() {
        const today = todaysEvent();
        if (!today) return { ok: false, error: 'The wheel has not been spun today.' };
        if (today.undo) {
            if (!undoAction(today.undo)) {
                return { ok: false, error: 'Other changes have been made since the spin, so it cannot be undone here. Use Undo on Update Values.' };
            }
        } else {
            clearTodaysEvent();
            addLog('Undid: Wheel of Destiny spin');
        }
        return { ok: true };
    }

    // ---- Quick Damage -----------------------------------------------------

    function getDamages() {
        if (!has('damages')) return DEFAULT_DAMAGES.map((d, i) => ({ id: 'd' + i, text: d.text, hp: d.hp }));
        const raw = read('damages', []);
        return Array.isArray(raw) ? raw.filter(d => d && d.text).map(d => ({
            id: String(d.id || newId()), text: String(d.text).slice(0, 60), hp: Math.max(1, toInt(d.hp))
        })) : [];
    }

    function saveDamages(damages) {
        write('damages', damages.map(d => ({ id: d.id || newId(), text: String(d.text).trim().slice(0, 60), hp: Math.max(1, toInt(d.hp)) })));
    }

    // Takes the damage's HP from each player. Returns the players who fell.
    function dealDamage(ids, damageId) {
        const damage = getDamages().find(d => d.id === damageId);
        if (!damage || !ids.length) return [];
        lastUndo = '';
        return adjustStat(ids, 'hp', -damage.hp, damage.text);
    }

    // ---- Battle punishments ----------------------------------------------
    // The options on the wheel a player spins when their HP reaches zero.

    function getPunishments() {
        if (!has('punishments')) return DEFAULT_PUNISHMENTS.slice();
        const raw = read('punishments', []);
        return Array.isArray(raw) ? raw.map(String).filter(text => text.trim() !== '') : [];
    }

    function savePunishments(punishments) {
        write('punishments', punishments);
    }

    // ---- Random player picker --------------------------------------------

    function pickerProgress() {
        const ids = getCharacters().map(c => c.id);
        const shown = read('shownPlayers', []).filter(id => ids.indexOf(id) !== -1);
        return { shown: shown.length, total: ids.length };
    }

    // Picks a player who has not been picked yet this round.
    function pickPlayer() {
        const characters = getCharacters();
        if (!characters.length) return null;
        const ids = characters.map(c => c.id);
        let shown = read('shownPlayers', []).filter(id => ids.indexOf(id) !== -1);
        if (shown.length >= characters.length) shown = [];
        const available = characters.filter(c => shown.indexOf(c.id) === -1);
        const pick = available[Math.floor(Math.random() * available.length)];
        shown.push(pick.id);
        write('shownPlayers', shown);
        return { player: pick, shown: shown.length, total: characters.length };
    }

    function resetPicker() {
        write('shownPlayers', []);
    }

    // ---- Student logins ---------------------------------------------------
    // Each student has a picture password: three of the PICTURES, tapped in
    // order. They are stored as [{ id, code: [2, 7, 0] }].

    function getPictureCodes() {
        const raw = read('pictureCodes', []);
        return Array.isArray(raw) ? raw.filter(e => e && e.id && Array.isArray(e.code)) : [];
    }

    function pictureCodeFor(id) {
        const entry = getPictureCodes().find(e => e.id === id);
        return entry ? entry.code : null;
    }

    function randomPictureCode() {
        const code = [];
        // Three different pictures, which are easier to remember.
        while (code.length < PICTURE_CODE_LENGTH) {
            const pick = Math.floor(Math.random() * PICTURES.length);
            if (code.indexOf(pick) === -1) code.push(pick);
        }
        return code;
    }

    // Gives a new picture password to each listed student (or, with no list,
    // to every student who does not have one). Returns how many were made.
    function makePictureCodes(ids) {
        const characters = getCharacters();
        const codes = getPictureCodes().filter(e => characters.some(c => c.id === e.id));
        const wanted = ids || characters.filter(c => !codes.some(e => e.id === c.id)).map(c => c.id);
        wanted.forEach(id => {
            const index = codes.findIndex(e => e.id === id);
            const entry = { id: id, code: randomPictureCode() };
            if (index === -1) codes.push(entry); else codes[index] = entry;
        });
        write('pictureCodes', codes);
        return wanted.length;
    }

    async function postJson(path, body) {
        try {
            const response = await api(path, body);
            const answer = await response.json().catch(() => ({}));
            return response.ok ? Object.assign({ ok: true }, answer)
                               : { ok: false, error: answer.error || 'Something went wrong. Try again.' };
        } catch (err) {
            return { ok: false, error: 'Cannot reach the server. Check the internet connection.' };
        }
    }

    const studentLogin = (id, code) => postJson('api/student-login', { id: id, code: code });
    const studentLogout = () => postJson('api/student-logout', {});

    // The logged-in student's own character, requests and vote ({ character, requests, vote }).
    function me() {
        const info = read('me', null);
        if (role !== 'student' || !info) return null;
        return { character: getCharacters().find(c => c.id === info.id) || null,
                 requests: info.requests || [], vote: info.vote };
    }

    // ---- New students signing themselves up ---------------------------------

    // For the teacher: whether sign-up is switched on, and switching it.
    const signupIsOpen = () => role === 'teacher' ? !!(read('signup', [])[0] || {}).open : signupOpen;
    function setSignup(open) {
        write('signup', [{ open: !!open }]);
    }

    // For a new student: { first, initial, type, avatar, powerId, code }.
    const signup = details => postJson('api/signup', details);

    // ---- Power requests (students ask, the teacher approves) ---------------

    const requestPower = (powerId, targetId) => postJson('api/power-request', { powerId: powerId, targetId: targetId || '' });
    const cancelRequest = () => postJson('api/power-request-cancel', {});

    function pendingRequests() {
        return read('powerRequests', []).filter(r => r && r.status === 'pending');
    }

    // Approving uses the power exactly as the Powers page would, so all the
    // usual rules are checked again. Returns { ok, summary, fallen, error }.
    async function answerRequest(request, approve) {
        let result = { ok: true, fallen: [] };
        if (approve) {
            result = applyPower(request.studentId, request.powerId, request.targetId);
            if (result.ok && !(await saved())) {
                return { ok: false, error: 'The power could not be saved, so the request is still waiting.' };
            }
        }
        const answer = await postJson('api/request-resolve', {
            id: request.id, approved: approve && result.ok, note: result.ok ? '' : result.error });
        await refresh(true);
        if (!answer.ok) return answer;
        return result;
    }

    // ---- Class poll -------------------------------------------------------
    // The poll is [{ id, question, options: [...], open }]; students' votes
    // arrive in pollVotes as [{ pollId, studentId, option }].

    function getPoll() {
        const poll = read('poll', [])[0];
        return poll && Array.isArray(poll.options) ? poll : null;
    }

    function startPoll(question, options) {
        write('poll', [{ id: newId(), question: question, options: options, open: true }]);
    }

    function closePoll() {
        const poll = getPoll();
        if (poll) write('poll', [Object.assign({}, poll, { open: false })]);
    }

    function pollResults() {
        const poll = getPoll();
        if (!poll) return null;
        const counts = poll.options.map(() => 0);
        const votes = read('pollVotes', []).filter(v => v && v.pollId === poll.id);
        votes.forEach(v => { if (counts[v.option] !== undefined) counts[v.option]++; });
        return { poll: poll, counts: counts, voters: votes.length };
    }

    const vote = (pollId, option) => postJson('api/vote', { pollId: pollId, option: option });

    // ---- Backup and restore ----------------------------------------------

    function exportData() {
        const data = {};
        getCharacters(); getPowers(); getMessages();   // make sure saved data is in the current shape
        savePunishments(getPunishments());
        DATA_KEYS.forEach(key => { data[key] = read(key, []); });
        return { app: 'Darbyon', version: 1, exported: new Date().toISOString(), data: data };
    }

    // Replaces all class data with the contents of a backup. Returns an error
    // message, or null if the restore worked.
    function importData(backup) {
        if (!backup || backup.app !== 'Darbyon' || !backup.data || !Array.isArray(backup.data.characters)) {
            return 'This file is not a DårbCRÅFT backup.';
        }
        DATA_KEYS.forEach(key => {
            // A key missing from an older backup goes back to its default.
            if (Array.isArray(backup.data[key])) write(key, backup.data[key]);
            else remove(key);
        });
        return null;
    }

    // ---- Page furniture ---------------------------------------------------

    const PAGES = [
        { href: 'index.html', label: 'Home', group: 'class' },
        { href: 'teams.html', label: 'Teams', group: 'class' },
        { href: 'me.html', label: 'My Character', group: 'class', students: true },
        { href: 'board.html', label: 'Board', group: 'teacher' },
        { href: 'update-values.html', label: 'Update Values', group: 'teacher' },
        { href: 'powers.html', label: 'Powers', group: 'teacher' },
        { href: 'summary.html', label: 'Summary', group: 'teacher' },
        { href: 'settings.html', label: 'Settings', group: 'teacher' }
    ];

    function renderNav() {
        const nav = document.getElementById('nav');
        if (!nav) return;
        nav.innerHTML = '';
        const current = location.pathname.split('/').pop() || 'index.html';
        const guest = mode === 'server' && role !== 'teacher';
        let lastGroup = null;
        const divider = () => {
            const node = document.createElement('span');
            node.className = 'nav-divider';
            node.setAttribute('aria-hidden', 'true');
            nav.appendChild(node);
        };
        PAGES.forEach(page => {
            if (role === 'locked' || (guest && page.group === 'teacher')) return;
            if (page.students && !(mode === 'server' && role !== 'teacher')) return;
            if (lastGroup && page.group !== lastGroup) divider();
            lastGroup = page.group;
            const link = document.createElement('a');
            link.href = page.href;
            link.textContent = page.label;
            if (page.href === current) link.setAttribute('aria-current', 'page');
            nav.appendChild(link);
        });
        if (mode !== 'server') return;
        divider();
        if (role === 'student') {
            const logout = el('button', 'Log Out', 'small');
            logout.type = 'button';
            logout.addEventListener('click', async () => {
                await studentLogout();
                location.href = 'me.html';
            });
            nav.appendChild(logout);
        } else if (guest) {
            const link = document.createElement('a');
            link.href = 'board.html';
            link.textContent = 'Teacher Login';
            nav.appendChild(link);
        } else {
            const logout = el('button', 'Log Out', 'small');
            logout.type = 'button';
            logout.addEventListener('click', async () => {
                await api('api/logout', {});
                location.href = 'index.html';
            });
            nav.appendChild(logout);
        }
    }

    // Shown in place of a page the visitor may not see yet. `wanted` is
    // 'teacher' for the teacher pages or 'viewer' when only the class code
    // is needed to look at the class.
    function showLogin(wanted) {
        Array.from(document.body.children).forEach(node => {
            if (['H1', 'HEADER', 'SCRIPT'].indexOf(node.tagName) === -1) node.hidden = true;
        });
        const form = el('form', null, 'panel login');
        const field = el('div', null, 'field');
        const label = el('label', wanted === 'teacher' ? 'Teacher password' : 'Class code');
        label.htmlFor = 'loginPassword';
        const input = document.createElement('input');
        input.type = 'password';
        input.id = 'loginPassword';
        input.autocomplete = wanted === 'teacher' ? 'current-password' : 'off';
        input.required = true;
        field.appendChild(label);
        field.appendChild(input);
        const submit = el('button', wanted === 'teacher' ? 'Log In' : 'Enter');
        submit.type = 'submit';
        const notice = el('p', '', 'notice error');
        notice.setAttribute('role', 'alert');
        form.appendChild(field);
        form.appendChild(submit);
        form.appendChild(notice);
        document.body.appendChild(form);
        input.focus();

        form.addEventListener('submit', async event => {
            event.preventDefault();
            submit.disabled = true;
            try {
                const response = await api('api/login', { password: input.value });
                const answer = await response.json();
                if (response.ok && (wanted !== 'teacher' || answer.role === 'teacher')) {
                    location.reload();
                    return;
                }
                notice.textContent = response.ok
                    ? 'That is the class code. This page needs the teacher password.'
                    : (answer.error || 'Could not log in.');
            } catch (err) {
                notice.textContent = 'Cannot reach the server.';
            }
            submit.disabled = false;
            input.select();
        });
    }

    // Builds the navy bar across the top: the site name and the page tabs.
    function buildHeader() {
        const nav = document.getElementById('nav');
        if (!nav || document.querySelector('.site-header')) return;
        const header = el('header', null, 'site-header');
        const brand = el('a', 'DårbCRÅFT', 'brand');
        brand.href = 'index.html';
        header.appendChild(brand);
        header.appendChild(nav);
        document.body.prepend(header);
    }

    // A coloured tag for a player's class, and a badge for their level.
    function typeTag(type) {
        const known = ['warrior', 'healer', 'mage'].indexOf(String(type).toLowerCase()) !== -1;
        return el('span', type, 'tag' + (known ? ' tag-' + String(type).toLowerCase() : ''));
    }

    function levelBadge(xp) {
        return el('span', getLevel(xp), 'level');
    }

    // A player's picture. Players who have not chosen one get their initial.
    function avatarImage(character, className) {
        if (!character.avatar) {
            return el('span', (character.name || '?').trim().charAt(0).toUpperCase(), 'avatar avatar-empty ' + (className || ''));
        }
        const img = document.createElement('img');
        img.src = 'avatars/' + character.avatar + '.svg?v=' + AVATAR_VERSION;
        img.alt = '';
        img.className = 'avatar ' + (className || '');
        return img;
    }

    // The Name cell used in every player table: picture, then name.
    function nameCell(character) {
        const td = el('td', null, 'name');
        const who = el('span', null, 'who');
        who.appendChild(avatarImage(character));
        who.appendChild(el('span', character.name));
        td.appendChild(who);
        return td;
    }

    // A table cell holding something other than plain text.
    function cell(node, className) {
        const td = el('td', null, className);
        td.appendChild(node);
        return td;
    }

    // Small helper for building table rows safely (text is never read as HTML).
    function el(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined && text !== null) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function emptyRow(tbody, columns, text) {
        const row = document.createElement('tr');
        const cell = el('td', text, 'empty');
        cell.colSpan = columns;
        row.appendChild(cell);
        tbody.appendChild(row);
    }

    // ---- Celebrations -----------------------------------------------------

    // Shows a short message at the top of the screen.
    // ---- Icons -------------------------------------------------------------
    // One hand-made set, drawn on a 24-unit grid with a thick rounded ink
    // outline and the site's own colours, used everywhere instead of emoji.
    const ICON_PATHS = {
        heart: '<path d="M12 20.5S3.8 15.6 3.8 9.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.2 2.2c0 6.2-8.2 11.1-8.2 11.1z" fill="#ff6b6b"/>',
        gem: '<path d="M7 4h10l4 5.2L12 20.5 3 9.2z" fill="#5aa9ff"/><path d="M3 9.2h18M9.3 4 7.8 9.2 12 20.5l4.2-11.3L14.7 4"/>',
        star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8l-5.3 2.9 1.1-6-4.4-4.2 6-.8z" fill="#ffc533"/>',
        gift: '<rect x="4" y="11" width="16" height="9.5" rx="1.5" fill="#ff8a8d"/><rect x="3" y="7.5" width="18" height="3.5" rx="1.2" fill="#ffc533"/><path d="M12 7.5v13M12 7.5C10.5 4 7 3.6 7 5.6S10 7.5 12 7.5zM12 7.5c1.5-3.5 5-3.9 5-1.9s-3 1.9-5 1.9z"/>',
        lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="#c3b2fd"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5"/>',
        sparkle: '<path d="M11 3.5c.8 4.6 2.4 6.2 7 7-4.6.8-6.2 2.4-7 7-.8-4.6-2.4-6.2-7-7 4.6-.8 6.2-2.4 7-7z" fill="#ffc533"/><path d="M18.5 15.5c.3 1.7.9 2.3 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.2 2.2-.8 2.5-2.5z" fill="#ff8a8d"/>',
        swords: '<path d="M5 3.5h3l8.5 8.5-3 3L5 6.5z" fill="#cfd8e3"/><path d="M19 3.5h-3L7.5 12l3 3L19 6.5z" fill="#cfd8e3"/><path d="M5.5 13.5l5 5M18.5 13.5l-5 5M8 16l-3.5 3.5M16 16l3.5 3.5"/>',
        hourglass: '<path d="M7 3.5h10M7 20.5h10"/><path d="M8 3.5c0 5 8 4.5 8 8.5s-8 3.5-8 8.5h8c0-5-8-4.5-8-8.5s8-3.5 8-8.5z" fill="#fff6d6"/><path d="M9.5 18.5h5l-2.5-3z" fill="#ffc533" stroke="none"/>',
        check: '<circle cx="12" cy="12" r="9" fill="#7fdcbb"/><path d="M7.8 12.4l2.8 2.8 5.6-6"/>',
        cross: '<circle cx="12" cy="12" r="9" fill="#ff8a8d"/><path d="M9 9l6 6M15 9l-6 6"/>',
        ballot: '<path d="M8 13V3.5h8V13" fill="#fff"/><path d="M10.5 7l1.2 1.3 2.3-2.6"/><rect x="3.5" y="12" width="17" height="8.5" rx="2" fill="#8ecbff"/><path d="M8 15.5h8"/>',
        wheel: '<circle cx="12" cy="12" r="8.8" fill="#ffc533"/><path d="M12 12 12 3.2A8.8 8.8 0 0 1 20.8 12z" fill="#ff8a8d"/><path d="M12 12 12 20.8A8.8 8.8 0 0 1 3.2 12z" fill="#8ecbff"/><circle cx="12" cy="12" r="8.8"/><path d="M12 3.2v17.6M3.2 12h17.6"/><circle cx="12" cy="12" r="2" fill="#fff"/>',
        timer: '<path d="M10 2.8h4M12 2.8v2.4"/><circle cx="12" cy="13.5" r="7.5" fill="#fff"/><path d="M12 13.5 15 10.5" stroke-width="2.4"/><path d="M12 6v1.3M19.5 13.5h-1.3M12 21v-1.3M4.5 13.5h1.3"/>',
        stopwatch: '<path d="M10 2.8h4M12 2.8v2.4M18.4 6.6l1.4-1.4"/><circle cx="12" cy="13.5" r="7.5" fill="#7fdcbb"/><path d="M12 13.5V9" stroke-width="2.4"/>',
        clock: '<circle cx="12" cy="12" r="8.8" fill="#fff"/><path d="M12 6.8V12l3.4 2.2" stroke-width="2.4"/>',
        dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="#fff"/><g fill="currentColor" stroke="none"><circle cx="8.3" cy="8.3" r="1.5"/><circle cx="15.7" cy="8.3" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="8.3" cy="15.7" r="1.5"/><circle cx="15.7" cy="15.7" r="1.5"/></g>',
        people: '<circle cx="9" cy="8" r="3.4" fill="#8ecbff"/><path d="M2.8 20c.6-3.8 3-5.8 6.2-5.8s5.6 2 6.2 5.8z" fill="#8ecbff"/><circle cx="16.5" cy="8.8" r="2.8" fill="#ffc533"/><path d="M15.8 13.9c2.8-.3 4.9 1.5 5.4 4.6h-4.4"/>',
        speaker: '<path d="M3.5 9.2h3.8L12 5v14l-4.7-4.2H3.5z" fill="#8ecbff"/><path d="M15.5 9.3a3.8 3.8 0 0 1 0 5.4M18.3 6.6a7.6 7.6 0 0 1 0 10.8"/>',
        burst: '<path d="M12 2.8l1.9 4.8 4.7-2.2-1.8 4.9 4.9 1.7-4.6 2.2 2.6 4.4-5-1.3-.6 5.1-2.1-4.6-3.6 3.6.3-5.1-5 .8 3.2-4-4.4-2.6 5-.9-.8-5 3.6 3.6z" fill="#ff8a5b"/>',
        hand: '<path d="M8.2 12.5V6.3a1.5 1.5 0 0 1 3 0v5M11.2 11V4.8a1.5 1.5 0 0 1 3 0V11M14.2 11V6.3a1.5 1.5 0 0 1 3 0v7.4c0 4.3-2.5 7-6.2 7-3 0-4.6-1.6-6-4.2l-1.9-3.4a1.5 1.5 0 0 1 2.6-1.5l2.5 3.4" fill="#ffe0bd"/>',
        palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.6 0 2-1.2 1.4-2.3-.7-1.2 0-2.7 1.5-2.7h2.2c2 0 3.4-1.5 3.4-3.6C20.5 7.2 16.7 3.5 12 3.5z" fill="#fff6d6"/><g stroke="none"><circle cx="7.6" cy="11" r="1.6" fill="#ff6b6b"/><circle cx="10" cy="7.2" r="1.6" fill="#ffc533"/><circle cx="14.6" cy="7.2" r="1.6" fill="#7fdcbb"/><circle cx="17" cy="10.8" r="1.6" fill="#5aa9ff"/></g>',
        expand: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
        mic: '<rect x="8.8" y="3" width="6.4" height="11" rx="3.2" fill="#8ecbff"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
        micOff: '<rect x="8.8" y="3" width="6.4" height="11" rx="3.2" fill="#cfd8e3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/><path d="M4 3.5l16 17" stroke-width="2.4"/>',
        bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2H4.2z" fill="#ffc533"/><path d="M10 20.5a2 2 0 0 0 4 0M12 3v2"/>',
        bellOff: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2H4.2z" fill="#cfd8e3"/><path d="M10 20.5a2 2 0 0 0 4 0M12 3v2"/><path d="M4 3.5l16 17" stroke-width="2.4"/>',
        gear: '<path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1" stroke-width="2.6"/><circle cx="12" cy="12" r="6" fill="#cfd8e3"/><circle cx="12" cy="12" r="2.2" fill="#fff"/>',
        happy: '<circle cx="12" cy="12" r="9" fill="#ffd34d"/><g fill="currentColor" stroke="none"><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></g><path d="M8.3 14a4.3 4.3 0 0 0 7.4 0"/>',
        neutral: '<circle cx="12" cy="12" r="9" fill="#ffd34d"/><g fill="currentColor" stroke="none"><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></g><path d="M8.8 15h6.4"/>',
        upset: '<circle cx="12" cy="12" r="9" fill="#ff8a8d"/><path d="M7.6 8.8l2.4 1.4-2.4 1.4M16.4 8.8 14 10.2l2.4 1.4M8.5 16.5a4.3 4.3 0 0 1 7 0"/>',
        quiet: '<circle cx="12" cy="12" r="9" fill="#7fdcbb"/><path d="M7.6 10.2a1.7 1.7 0 0 0 3 0M13.4 10.2a1.7 1.7 0 0 0 3 0"/><circle cx="12" cy="15.4" r="1.4"/>',
        game: '<path d="M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.6a2.5 2.5 0 0 1-4.3 1.2L14.6 16H9.4l-1.8 1.7a2.5 2.5 0 0 1-4.3-1.2l-.7-3.6A4.5 4.5 0 0 1 7 7.5z" fill="#8ecbff"/><path d="M8 10.5v3M6.5 12h3"/><g fill="currentColor" stroke="none"><circle cx="15.5" cy="11" r="1.1"/><circle cx="17.3" cy="13" r="1.1"/></g>',
        book: '<path d="M12 6.5C9.8 4.9 6.8 4.6 3.5 5.2v13c3.3-.6 6.3-.3 8.5 1.3 2.2-1.6 5.2-1.9 8.5-1.3v-13c-3.3-.6-6.3-.3-8.5 1.3z" fill="#fff"/><path d="M12 6.5v13"/><path d="M6.3 9c1.5-.1 2.7.1 3.5.6M6.3 12c1.5-.1 2.7.1 3.5.6M14.2 9.6c.8-.5 2-.7 3.5-.6"/>',
        silly: '<circle cx="12" cy="12" r="9" fill="#ffd34d"/><path d="M7.5 9.8 10 9M14 10.2a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0"/><path d="M8 14h8M11 14v2.6a1.6 1.6 0 0 0 3.2 0V14" fill="#ff8a8d"/>',
        footy: '<ellipse cx="12" cy="12" rx="9.2" ry="5.8" transform="rotate(-35 12 12)" fill="#c8743a"/><path d="M8.8 15.2l6.4-6.4M10 11.6l1.3 1.3M11.4 10.2l1.3 1.3M12.8 8.8l1.3 1.3"/>',
        cricket: '<path d="M14.3 3.7l3 3-8.6 8.6-3-3z" fill="#f3d9a4"/><path d="M5.7 15.3 3.3 17.7l1.9 1.9 2.4-2.4" stroke-width="2.4"/><circle cx="17" cy="16.5" r="3.3" fill="#e0453a"/><path d="M15 14.6c1.2.5 2.1 1.6 2.4 3.1"/>',
        basketball: '<circle cx="12" cy="12" r="9" fill="#f28a30"/><path d="M3 12h18M12 3v18M5.6 5.6c2.4 2.4 2.4 10.4 0 12.8M18.4 5.6c-2.4 2.4-2.4 10.4 0 12.8"/>',
        soccer: '<circle cx="12" cy="12" r="9" fill="#fff"/><path d="M12 8.3l3.4 2.5-1.3 4h-4.2l-1.3-4z" fill="currentColor"/><path d="M12 8.3V3.2M15.4 10.8l4.6-1.6M14.1 14.8l2.8 4.1M9.9 14.8l-2.8 4.1M8.6 10.8 4 9.2"/>',
        medal1: '<path d="M8 3h3l1.5 5.5L10 9.5zM16 3h-3l-1.5 5.5L14 9.5z" fill="#5aa9ff"/><circle cx="12" cy="14.5" r="6.2" fill="#ffc533"/><text x="12" y="17.8" text-anchor="middle" font-size="9" font-weight="900" fill="currentColor" stroke="none" font-family="Darbyon Nunito,system-ui,Arial,sans-serif">1</text>',
        medal2: '<path d="M8 3h3l1.5 5.5L10 9.5zM16 3h-3l-1.5 5.5L14 9.5z" fill="#ff8a8d"/><circle cx="12" cy="14.5" r="6.2" fill="#d5dde8"/><text x="12" y="17.8" text-anchor="middle" font-size="9" font-weight="900" fill="currentColor" stroke="none" font-family="Darbyon Nunito,system-ui,Arial,sans-serif">2</text>',
        medal3: '<path d="M8 3h3l1.5 5.5L10 9.5zM16 3h-3l-1.5 5.5L14 9.5z" fill="#7fdcbb"/><circle cx="12" cy="14.5" r="6.2" fill="#e3a46c"/><text x="12" y="17.8" text-anchor="middle" font-size="9" font-weight="900" fill="currentColor" stroke="none" font-family="Darbyon Nunito,system-ui,Arial,sans-serif">3</text>'
    };

    // An icon as an <svg> element. Icons are decoration: the words next to
    // them carry the meaning, so screen readers skip them.
    function icon(name, className) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('class', 'icon' + (className ? ' ' + className : ''));
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.innerHTML = ICON_PATHS[name] || '';
        return svg;
    }

    // An element holding an icon and then some words.
    function iconText(name, text, tag, className) {
        const node = el(tag || 'span', null, className);
        node.appendChild(icon(name));
        node.appendChild(document.createTextNode(' ' + text));
        return node;
    }

    // Fills <span data-icon="name"></span> placeholders written in the pages.
    function fillIcons(root) {
        (root || document).querySelectorAll('[data-icon]:empty').forEach(spot => spot.appendChild(icon(spot.dataset.icon)));
    }

    const STAT_ICONS = { xp: 'star', ap: 'gem', hp: 'heart' };
    const EVENT_ICONS = { game: 'game', learning: 'book', silly: 'silly' };

    function toast(text, iconName) {
        let holder = document.getElementById('toasts');
        if (!holder) {
            holder = el('div', null, 'toasts');
            holder.id = 'toasts';
            holder.setAttribute('aria-live', 'polite');
            document.body.appendChild(holder);
        }
        const item = iconName ? iconText(iconName, text, 'div') : el('div', text);
        item.classList.add('toast');
        holder.appendChild(item);
        setTimeout(() => item.remove(), 7000);
    }

    // Call after each redraw: anyone whose level went up since the last call
    // gets a celebration message. The first call only remembers the levels.
    let knownLevels = null;
    function announceLevelUps() {
        const levels = {};
        getCharacters().forEach(c => {
            levels[c.id] = getLevel(c.xp);
            if (knownLevels && knownLevels[c.id] && levels[c.id] > knownLevels[c.id]) {
                toast(c.name + ' reached level ' + levels[c.id] + '!', 'star');
            }
        });
        knownLevels = levels;
    }

    // ---- Phones -----------------------------------------------------------

    // On a phone each table row is shown as a card, with each value labelled
    // by its column heading. This copies the headings onto the cells.
    function labelCells(root) {
        root.querySelectorAll('table').forEach(table => {
            const headings = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
            if (!headings.length) return;
            table.querySelectorAll('tbody tr').forEach(row => {
                let column = 0;
                Array.from(row.children).forEach(td => {
                    if (td.colSpan === 1 && !td.hasAttribute('data-label')) td.setAttribute('data-label', headings[column] || '');
                    column += td.colSpan || 1;
                });
            });
        });
    }

    if (typeof document !== 'undefined' && window.MutationObserver) {
        let pending = false;
        new MutationObserver(() => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => { pending = false; labelCells(document); });
        }).observe(document.documentElement, { childList: true, subtree: true });
    }

    // ---- Starting a page --------------------------------------------------

    // Works out where the data lives, loads it, and draws the navigation.
    // Resolves to true when the page may go ahead and draw itself.
    async function start() {
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
        buildHeader();
        fillIcons();
        try {
            const response = await api('api/state');
            if (response.status >= 500) {
                renderNav();
                showProblem('The server has a problem and the class could not be loaded. Try reloading the page.');
                return false;
            }
            const state = response.ok ? await response.json() : null;
            if (state && state.server === true) {
                mode = 'server';
                role = state.role;
                signupOpen = !!state.signup;
                cache = state.data;
                revs = state.revs;
            }
        } catch (err) {
            // No server here (for example GitHub Pages): carry on in local mode.
        }
        renderNav();
        const currentTab = document.querySelector('nav [aria-current="page"]');
        if (currentTab && currentTab.scrollIntoView) currentTab.scrollIntoView({ block: 'nearest', inline: 'center' });
        if (mode !== 'server') return true;

        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
        window.addEventListener('beforeunload', event => {
            if (sending || unsaved.size) event.preventDefault();   // warn before losing a change
        });
        if (role !== 'teacher') {
            document.querySelectorAll('.teacher-only').forEach(node => { node.hidden = true; });
            if (document.body.hasAttribute('data-teacher-page')) {
                showLogin('teacher');
                return false;
            }
            if (role === 'locked') {
                showLogin('viewer');
                return false;
            }
        }
        return true;
    }

    // The page stays blank until we know what to show, so a teacher page
    // never flashes up before the login box.
    const started = typeof document !== 'undefined'
        ? start().then(ok => { document.body.classList.add('ready'); return ok; },
                       err => { document.body.classList.add('ready'); throw err; })
        : Promise.resolve(false);

    // Pages wrap their code in Darbyon.ready(() => { ... }).
    function ready(callback) {
        started.then(ok => { if (ok) callback(); });
    }

    return {
        CLASSES, XP_PER_LEVEL, MAX_LEVEL,
        getLevel, getCharacters, addCharacter, importCharacters, updateCharacter, deleteCharacter, adjustStat,
        peekUndo, undo,
        getLog, addLog, clearLog,
        getTeams, addTeam, renameTeam, deleteTeam,
        icon, iconText, fillIcons, STAT_ICONS, EVENT_ICONS,
        undoAction, lastUndoId: () => lastUndo, undoSpin, getHistory,
        getPowers, savePower, deletePower, applyPower, describeEffect, powersFor,
        addPowerPack, powerLock, describePower, REACH, POWER_PACK,
        getEvents, saveEvents, spinDestiny, todaysEvent, clearTodaysEvent, perthDate, EVENT_KINDS,
        getDamages, saveDamages, dealDamage,
        getMessages, saveMessages, nextMessage, messageProgress, resetMessages,
        getPunishments, savePunishments,
        pickerProgress, pickPlayer, resetPicker,
        exportData, importData,
        PICTURES, getPictureCodes, pictureCodeFor, makePictureCodes, studentLogin, studentLogout, me,
        signupIsOpen, setSignup, signup,
        requestPower, cancelRequest, pendingRequests, answerRequest,
        getPoll, startPoll, closePoll, pollResults, vote,
        toast, announceLevelUps,
        ready, onChange, refresh, saved, isServer: () => mode === 'server', role: () => role,
        AVATARS, avatarImage, nameCell,
        el, emptyRow, cell, typeTag, levelBadge
    };
})();
