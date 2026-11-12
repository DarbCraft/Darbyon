/*
 * Battle: when a player's HP reaches zero a pop-up opens and a wheel of
 * punishments is spun. The punishments are edited on the Settings page.
 *
 * Pages call Darbyon.Battle.start(fallenPlayers). If several players fall at
 * once they take their turns one after another.
 */
Darbyon.Battle = (() => {
    'use strict';

    const COLOURS = ['#ffc533', '#ff8a8d', '#8ecbff', '#7fdcbb', '#c3b2fd', '#ffb37a', '#f9a8d0', '#a8e6f0'];
    const SIZE = 720;            // canvas pixels (drawn large so it stays sharp)
    const SPIN_SECONDS = 4.5;

    let dialog, canvas, who, result, spinButton, skipButton, continueButton;
    let queue = [];
    let onFinished = null;
    let punishments = [];
    let current = null;
    let spinning = false;

    function build() {
        if (dialog) return;
        const el = Darbyon.el;
        dialog = document.createElement('dialog');
        dialog.className = 'battle';
        dialog.setAttribute('aria-labelledby', 'battleTitle');

        const title = el('h2', '⚔️ Battle!');
        title.id = 'battleTitle';
        who = el('p', '', 'who');

        const holder = el('div', null, 'wheel-holder');
        holder.appendChild(el('div', null, 'wheel-pointer'));
        canvas = document.createElement('canvas');
        canvas.width = canvas.height = SIZE;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Wheel of punishments');
        holder.appendChild(canvas);

        result = el('p', '', 'result');
        result.setAttribute('aria-live', 'assertive');

        spinButton = el('button', 'Spin the Wheel');
        skipButton = el('button', 'Skip', 'secondary');
        continueButton = el('button', 'Continue');
        [spinButton, skipButton, continueButton].forEach(b => { b.type = 'button'; });
        const actions = el('div', null, 'actions');
        actions.appendChild(spinButton);
        actions.appendChild(skipButton);
        actions.appendChild(continueButton);

        [title, who, holder, result, actions].forEach(node => dialog.appendChild(node));
        document.body.appendChild(dialog);

        spinButton.addEventListener('click', spin);
        skipButton.addEventListener('click', () => {
            Darbyon.addLog(current.name + ' fell into Battle (wheel skipped)');
            next();
        });
        continueButton.addEventListener('click', next);
        // Esc must not close the pop-up half way through a spin.
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            if (!spinning) (continueButton.hidden ? skipButton : continueButton).click();
        });
    }

    // Shrinks the label, then trims it, until it fits along its slice.
    function fitLabel(ctx, text, maxWidth) {
        let size = 32;
        const setFont = () => { ctx.font = '600 ' + size + 'px system-ui, Arial, sans-serif'; };
        setFont();
        while (size > 22 && ctx.measureText(text).width > maxWidth) {
            size -= 2;
            setFont();
        }
        let label = text;
        while (label.length > 1 && ctx.measureText(label).width > maxWidth) {
            label = label.slice(0, -2).trimEnd() + '…';
        }
        return label;
    }

    function drawWheel() {
        const ctx = canvas.getContext('2d');
        const r = SIZE / 2;
        const slice = 2 * Math.PI / punishments.length;
        ctx.clearRect(0, 0, SIZE, SIZE);
        punishments.forEach((text, i) => {
            // Slice 0 starts at the top and the slices run clockwise.
            const start = -Math.PI / 2 + i * slice;
            ctx.beginPath();
            ctx.moveTo(r, r);
            ctx.arc(r, r, r, start, start + slice);
            ctx.closePath();
            // Avoid two neighbours sharing a colour when the list wraps round.
            let colour = COLOURS[i % COLOURS.length];
            if (i === punishments.length - 1 && i > 0 && colour === COLOURS[0]) colour = COLOURS[1 + (i % 3)];
            ctx.fillStyle = colour;
            ctx.fill();
            ctx.strokeStyle = '#17264d';
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.save();
            ctx.translate(r, r);
            ctx.rotate(start + slice / 2);
            ctx.fillStyle = '#17264d';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(fitLabel(ctx, text, r - 90), r - 24, 0);
            ctx.restore();
        });
        ctx.beginPath();
        ctx.arc(r, r, 40, 0, 2 * Math.PI);
        ctx.fillStyle = '#17264d';
        ctx.fill();
    }

    function showTurn() {
        current = queue.shift();
        punishments = Darbyon.getPunishments();
        spinning = false;
        who.textContent = '';
        const player = Darbyon.getCharacters().find(c => c.id === current.id);
        if (player) who.appendChild(Darbyon.avatarImage(player, 'avatar-big'));
        who.appendChild(document.createTextNode(current.name + ' has reached 0 HP and has fallen into Battle!'));
        result.textContent = '';
        continueButton.hidden = true;
        continueButton.textContent = queue.length ? 'Next Player' : 'Continue';
        skipButton.hidden = false;
        spinButton.hidden = false;
        spinButton.disabled = false;

        canvas.style.transition = 'none';
        canvas.style.transform = 'rotate(0deg)';
        if (punishments.length) {
            canvas.parentNode.hidden = false;
            drawWheel();
        } else {
            canvas.parentNode.hidden = true;
            spinButton.hidden = true;
            result.textContent = 'No punishments are set up. Add some on the Settings page.';
        }
        if (!dialog.open) dialog.showModal();
        (spinButton.hidden ? skipButton : spinButton).focus();
    }

    function spin() {
        if (spinning || !punishments.length) return;
        spinning = true;
        spinButton.disabled = true;
        skipButton.hidden = true;

        const winner = Math.floor(Math.random() * punishments.length);
        const slice = 360 / punishments.length;
        // Land somewhere inside the winning slice, not always dead centre.
        const offset = (winner + 0.5) * slice + (Math.random() - 0.5) * slice * 0.7;
        const turns = 5 + Math.floor(Math.random() * 3);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const seconds = reduceMotion ? 0.01 : SPIN_SECONDS;

        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            spinning = false;
            result.textContent = punishments[winner];
            Darbyon.addLog(current.name + ' fell into Battle: ' + punishments[winner]);
            spinButton.hidden = true;
            continueButton.hidden = false;
            continueButton.focus();
        };

        canvas.getBoundingClientRect();   // make the browser register the reset position
        canvas.style.transition = 'transform ' + seconds + 's cubic-bezier(0.12, 0.6, 0.1, 1)';
        canvas.style.transform = 'rotate(' + (turns * 360 - offset) + 'deg)';
        canvas.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, seconds * 1000 + 300);   // in case the transition event never arrives
    }

    function next() {
        if (queue.length) {
            showTurn();
            return;
        }
        dialog.close();
        const callback = onFinished;
        onFinished = null;
        if (callback) callback();
    }

    // players: [{ id, name }, ...]. whenFinished runs after the last pop-up closes.
    function start(players, whenFinished) {
        if (!players || !players.length) return;
        build();
        queue = queue.concat(players);
        if (whenFinished) onFinished = whenFinished;
        if (!dialog.open) showTurn();
    }

    return { start };
})();
