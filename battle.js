/*
 * Battle: when a player's HP reaches zero a pop-up opens and a wheel of
 * punishments is spun. The punishments are edited on the Settings page.
 *
 * Pages call Darbyon.Battle.start(fallenPlayers). If several players fall at
 * once they take their turns one after another.
 */
Darbyon.Battle = (() => {
    'use strict';

    const SIZE = 720;            // canvas pixels (drawn large so it stays sharp)

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

        Darbyon.Wheel.reset(canvas);
        if (punishments.length) {
            canvas.parentNode.hidden = false;
            Darbyon.Wheel.draw(canvas, punishments);
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
        Darbyon.Wheel.spinTo(canvas, winner, punishments.length, () => {
            spinning = false;
            result.textContent = punishments[winner];
            Darbyon.addLog(current.name + ' fell into Battle: ' + punishments[winner]);
            spinButton.hidden = true;
            continueButton.hidden = false;
            continueButton.focus();
        });
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
