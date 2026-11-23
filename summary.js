/*
 * Weekly Summary: what changed for each student in a school week (Monday
 * to Sunday, Perth time), with a starting sentence for report comments.
 */
Darbyon.ready(async () => {
    'use strict';

    const el = Darbyon.el;
    const byId = id => document.getElementById(id);
    const DAY = 24 * 3600 * 1000;
    const PERTH = 8 * 3600 * 1000;        // Perth is UTC+8 all year

    let weeksBack = 0;
    let history = [];

    // Monday 00:00 in Perth for the week `weeksBack` weeks ago, as a time.
    function weekStart(back) {
        const perthNow = new Date(Date.now() + PERTH);
        const sinceMonday = (perthNow.getUTCDay() + 6) % 7;
        const monday = Date.UTC(perthNow.getUTCFullYear(), perthNow.getUTCMonth(), perthNow.getUTCDate() - sinceMonday);
        return monday - PERTH - back * 7 * DAY;
    }

    function dayText(time) {
        return new Date(time).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth', weekday: 'short', day: 'numeric', month: 'short' });
    }

    // "Calling out ×2, Not on task"
    function countList(items) {
        const counts = new Map();
        items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
        return Array.from(counts, ([item, n]) => item + (n > 1 ? ' ×' + n : '')).join(', ');
    }

    function tally(player, start) {
        const mine = history.filter(e => e.c === player.id && e.t >= start && e.t < start + 7 * DAY);
        const sum = (stat, sign) => mine.filter(e => e.k === 'stat' && e.s === stat && Math.sign(e.d) === sign)
                                        .reduce((total, e) => total + Math.abs(e.d), 0);
        const hurts = mine.filter(e => e.k === 'stat' && e.s === 'hp' && e.d < 0);
        return {
            xp: sum('xp', 1),
            hpLost: sum('hp', -1),
            hpHealed: sum('hp', 1),
            powers: mine.filter(e => e.k === 'power').map(e => e.p),
            battles: mine.filter(e => e.k === 'battle').length,
            reasons: hurts.map(e => e.r || 'No reason given'),
            helped: mine.filter(e => e.k === 'stat' && / from /.test(e.r) && e.d > 0).length
        };
    }

    function comment(player, t) {
        const first = player.name.split(' ')[0];
        const parts = [];
        if (t.xp) parts.push('earned ' + t.xp + ' XP');
        if (t.powers.length) parts.push('used ' + (t.powers.length === 1 ? 'a power' : t.powers.length + ' powers') + ' (' + countList(t.powers) + ')');
        if (t.helped) parts.push('was helped by teammates ' + (t.helped === 1 ? 'once' : t.helped + ' times'));
        if (t.hpLost) parts.push('lost ' + t.hpLost + ' HP (' + countList(t.reasons) + ')');
        if (t.battles) parts.push('fell into Battle ' + (t.battles === 1 ? 'once' : t.battles + ' times'));
        if (!parts.length) return first + ' had a quiet week in DårbCRÅFT with no changes.';
        const last = parts.pop();
        return first + ' ' + (parts.length ? parts.join(', ') + ' and ' + last : last) + ' this week.';
    }

    async function copy(text) {
        const notice = byId('copyNotice');
        try {
            await navigator.clipboard.writeText(text);
            notice.textContent = 'Copied.';
            notice.className = 'notice success';
        } catch (err) {
            // Older iPads: fall back to a box the teacher can copy from.
            window.prompt('Copy this:', text);
        }
    }

    function render() {
        const start = weekStart(weeksBack);
        byId('weekTitle').textContent = (weeksBack === 0 ? 'This Week: ' : weeksBack === 1 ? 'Last Week: ' : '')
            + dayText(start) + ' to ' + dayText(start + 6 * DAY);
        byId('weekNext').disabled = weeksBack === 0;

        const players = Darbyon.getCharacters().slice().sort((a, b) => a.name.localeCompare(b.name));
        const rows = players.map(player => ({ player: player, t: tally(player, start) }));
        const totals = rows.reduce((all, r) => ({
            xp: all.xp + r.t.xp, hp: all.hp + r.t.hpLost, powers: all.powers + r.t.powers.length, battles: all.battles + r.t.battles
        }), { xp: 0, hp: 0, powers: 0, battles: 0 });

        const tiles = byId('weekTotals');
        tiles.innerHTML = '';
        [['star', totals.xp, 'XP earned'], ['heart', totals.hp, 'HP lost'], ['sparkle', totals.powers, 'Powers used'],
         ['swords', totals.battles, 'Battles']].forEach(([icon, value, label]) => {
            const tile = el('div', null, 'panel week-tile');
            tile.appendChild(Darbyon.icon(icon));
            tile.appendChild(el('strong', value));
            tile.appendChild(el('span', label));
            tiles.appendChild(tile);
        });

        const tbody = byId('summaryBody');
        tbody.innerHTML = '';
        if (!players.length) {
            Darbyon.emptyRow(tbody, 7, 'There are no players yet.');
            return;
        }
        rows.forEach(({ player, t }) => {
            const row = document.createElement('tr');
            row.appendChild(Darbyon.nameCell(player));
            row.appendChild(el('td', t.xp || '–', 'num'));
            const hurt = el('td', null, 'num');
            hurt.appendChild(el('span', t.hpLost || '–'));
            if (t.reasons.length) hurt.appendChild(el('span', countList(t.reasons), 'summary-reasons'));
            row.appendChild(hurt);
            row.appendChild(el('td', t.hpHealed || '–', 'num'));
            row.appendChild(el('td', t.powers.length ? countList(t.powers) : '–'));
            row.appendChild(el('td', t.battles || '–', 'num'));
            const said = comment(player, t);
            const cell = el('td', null, 'summary-comment');
            cell.appendChild(el('span', said));
            const copyButton = el('button', 'Copy', 'soft small');
            copyButton.type = 'button';
            copyButton.addEventListener('click', () => copy(said));
            cell.appendChild(copyButton);
            row.appendChild(cell);
            tbody.appendChild(row);
        });
        byId('copyAll').onclick = () => copy(rows.map(r => r.player.name + ': ' + comment(r.player, r.t)).join('\n'));
    }

    byId('weekBack').addEventListener('click', () => { weeksBack++; render(); });
    byId('weekNext').addEventListener('click', () => { weeksBack = Math.max(0, weeksBack - 1); render(); });

    history = await Darbyon.getHistory();
    render();
    Darbyon.onChange(async () => { history = await Darbyon.getHistory(); render(); });
});
