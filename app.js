/*
 * DårbCRÅFT shared code.
 *
 * Every page loads this file first. It owns all reading and writing of the
 * class data, so the pages never touch localStorage directly. If the data
 * later moves to a server, this is the only file that has to change.
 */
const Darbyon = (() => {
    'use strict';

    // ---- Game rules -------------------------------------------------------

    const CLASSES = {
        Warrior: { hp: 10, ap: 15 },
        Healer:  { hp: 8,  ap: 20 },
        Mage:    { hp: 6,  ap: 30 }
    };
    const XP_PER_LEVEL = 5000;
    const MAX_LEVEL = 7;
    const UNDO_LIMIT = 20;
    const LOG_LIMIT = 200;

    // Everything that makes up a class. Used by backup and restore.
    const DATA_KEYS = ['characters', 'teams', 'powers', 'messages', 'punishments',
                       'shownMessages', 'shownPlayers', 'changeLog', 'undoStack'];

    // What the Battle wheel starts with. Edit the list on the Settings page.
    const DEFAULT_PUNISHMENTS = [
        'Lose 100 XP',
        'Tidy the bookshelf',
        'Ten star jumps',
        'Hand out the books next lesson',
        'Miss your next power turn',
        'Lucky escape! No punishment'
    ];

    const DEFAULT_MESSAGES = [
        { name: 'Electrical Storm', description: 'Everyone loses 2 HP' },
        { name: 'Sunny Day Feeling', description: 'Everyone gains 100XP' },
        { name: 'Shuffle!', description: 'Leave your chair where it is and move to another desk. Run and you lose HP' }
    ];

    // ---- Storage ----------------------------------------------------------

    function read(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value === null || value === undefined ? fallback : value;
        } catch (err) {
            console.error('Could not read "' + key + '" from storage', err);
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
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
                team: String(c.team || '')
            };
        });
        if (repaired) write('characters', characters);
        return characters;
    }

    // Saves the characters. Pass a label to make the change undoable.
    function saveCharacters(characters, undoLabel) {
        if (undoLabel) {
            const stack = read('undoStack', []);
            stack.push({ label: undoLabel, characters: getCharacters() });
            write('undoStack', stack.slice(-UNDO_LIMIT));
        }
        write('characters', characters);
    }

    function addCharacter(name, type) {
        const base = CLASSES[type];
        if (!base) throw new Error('Unknown character type: ' + type);
        const characters = getCharacters();
        characters.push({ id: newId(), name: name, type: type, xp: 0, ap: base.ap, hp: base.hp, team: '' });
        saveCharacters(characters);
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
    function adjustStat(ids, stat, amount) {
        amount = toInt(amount);
        const fallen = [];
        if (!amount || ['xp', 'ap', 'hp'].indexOf(stat) === -1) return fallen;
        const characters = getCharacters();
        const entries = [];
        characters.forEach(c => {
            if (ids.indexOf(c.id) === -1) return;
            const before = c[stat];
            c[stat] = Math.max(0, before + amount);
            entries.push(c.name + ' / ' + stat.toUpperCase() + ' / ' + before + ' -> ' + c[stat]);
            if (stat === 'hp' && before > 0 && c.hp === 0) fallen.push({ id: c.id, name: c.name });
        });
        if (!entries.length) return fallen;
        const sign = amount > 0 ? '+' : '';
        const who = entries.length === 1 ? entries[0].split(' / ')[0] : entries.length + ' players';
        saveCharacters(characters, sign + amount + ' ' + stat.toUpperCase() + ' to ' + who);
        entries.forEach(addLog);
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
        write('undoStack', stack);
        addLog('Undid: ' + last.label);
        return last.label;
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
        if (p.type === 'team' || p.type === 'self') type = p.type;
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
            otherHp: otherHp
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
        const powers = getPowers();
        const index = powers.findIndex(p => p.id === clean.id);
        if (index === -1) powers.push(clean); else powers[index] = clean;
        write('powers', powers);
    }

    function deletePower(id) {
        write('powers', getPowers().filter(p => p.id !== id));
    }

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

        let target = null;
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
        }
        if (user.ap < power.apCost) {
            return { ok: false, error: 'Not enough AP to use this power! ' + user.name + ' has ' +
                                       user.ap + ' AP and ' + power.name + ' costs ' + power.apCost + '.' };
        }

        const fallen = [];
        const userHpBefore = user.hp;
        user.ap -= power.apCost;
        user.xp = Math.max(0, user.xp + power.xp);
        user.hp = Math.max(0, user.hp + power.hp);
        if (userHpBefore > 0 && user.hp === 0) fallen.push({ id: user.id, name: user.name });
        let summary = user.name + ' used ' + power.name;
        if (target) {
            const targetHpBefore = target.hp;
            target.xp = Math.max(0, target.xp + power.otherXp);
            target.ap = Math.max(0, target.ap + power.otherAp);
            target.hp = Math.max(0, target.hp + power.otherHp);
            if (targetHpBefore > 0 && target.hp === 0) fallen.push({ id: target.id, name: target.name });
            summary += ' on ' + target.name;
        }
        saveCharacters(characters, summary);
        addLog(summary);
        return { ok: true, summary: summary, fallen: fallen };
    }

    // ---- Daily news -------------------------------------------------------

    function getMessages() {
        if (localStorage.getItem('messages') === null) write('messages', DEFAULT_MESSAGES);
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

    // ---- Battle punishments ----------------------------------------------
    // The options on the wheel a player spins when their HP reaches zero.

    function getPunishments() {
        if (localStorage.getItem('punishments') === null) return DEFAULT_PUNISHMENTS.slice();
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
            else localStorage.removeItem(key);
        });
        return null;
    }

    // ---- Page furniture ---------------------------------------------------

    const PAGES = [
        { href: 'index.html', label: 'Home', group: 'class' },
        { href: 'teams.html', label: 'Teams', group: 'class' },
        { href: 'update-values.html', label: 'Update Values', group: 'teacher' },
        { href: 'powers.html', label: 'Powers', group: 'teacher' },
        { href: 'settings.html', label: 'Settings', group: 'teacher' }
    ];

    function renderNav() {
        const nav = document.getElementById('nav');
        if (!nav) return;
        const current = location.pathname.split('/').pop() || 'index.html';
        let lastGroup = null;
        PAGES.forEach(page => {
            if (lastGroup && page.group !== lastGroup) {
                const divider = document.createElement('span');
                divider.className = 'nav-divider';
                divider.setAttribute('aria-hidden', 'true');
                nav.appendChild(divider);
            }
            lastGroup = page.group;
            const link = document.createElement('a');
            link.href = page.href;
            link.textContent = page.label;
            if (page.href === current) link.setAttribute('aria-current', 'page');
            nav.appendChild(link);
        });
    }

    function setBackground() {
        const hour = new Date().getHours();
        let image;
        if (hour >= 6 && hour < 9) image = 'Dawn 1';
        else if (hour >= 9 && hour < 10) image = 'Dawn 2';
        else if (hour >= 10 && hour < 14) image = 'Day 1';
        else image = 'Day 3';
        document.body.style.backgroundImage = "url('Images/" + encodeURIComponent(image) + ".jpeg')";
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

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            renderNav();
            setBackground();
        });
    }

    return {
        CLASSES, XP_PER_LEVEL, MAX_LEVEL,
        getLevel, getCharacters, addCharacter, updateCharacter, deleteCharacter, adjustStat,
        peekUndo, undo,
        getLog, addLog, clearLog,
        getTeams, addTeam, renameTeam, deleteTeam,
        getPowers, savePower, deletePower, applyPower, describeEffect,
        getMessages, saveMessages, nextMessage, messageProgress, resetMessages,
        getPunishments, savePunishments,
        pickerProgress, pickPlayer, resetPicker,
        exportData, importData,
        el, emptyRow
    };
})();
