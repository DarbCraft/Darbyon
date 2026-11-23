/*
 * A spinning wheel drawn on a canvas. Used by Battle and the Wheel of Destiny.
 *
 *     Darbyon.Wheel.draw(canvas, labels)          draws the slices
 *     Darbyon.Wheel.reset(canvas)                 puts it back to the start
 *     Darbyon.Wheel.spinTo(canvas, index, count, done)
 *                                                 spins and stops on slice `index`
 */
Darbyon.Wheel = (() => {
    'use strict';

    const COLOURS = ['#ffc533', '#ff8a8d', '#8ecbff', '#7fdcbb', '#c3b2fd', '#ffb37a', '#f9a8d0', '#a8e6f0'];
    const SPIN_SECONDS = 4.5;

    // Shrinks the label, then trims it, until it fits along its slice.
    function fitLabel(ctx, text, maxWidth, biggest) {
        let size = biggest;
        const setFont = () => { ctx.font = '600 ' + size + 'px system-ui, Arial, sans-serif'; };
        setFont();
        while (size > biggest * 0.66 && ctx.measureText(text).width > maxWidth) {
            size -= 2;
            setFont();
        }
        let label = text;
        while (label.length > 1 && ctx.measureText(label).width > maxWidth) {
            label = label.slice(0, -2).trimEnd() + '…';
        }
        return label;
    }

    function draw(canvas, labels) {
        const size = canvas.width;
        const ctx = canvas.getContext('2d');
        const r = size / 2;
        const slice = 2 * Math.PI / labels.length;
        // Many slices are thin, so their writing gets smaller.
        const biggest = Math.max(18, Math.min(32, Math.round(size * 1.6 / Math.max(labels.length, 8) / 2) * 2));
        ctx.clearRect(0, 0, size, size);
        labels.forEach((text, i) => {
            // Slice 0 starts at the top and the slices run clockwise.
            const start = -Math.PI / 2 + i * slice;
            ctx.beginPath();
            ctx.moveTo(r, r);
            ctx.arc(r, r, r, start, start + slice);
            ctx.closePath();
            // Avoid two neighbours sharing a colour when the list wraps round.
            let colour = COLOURS[i % COLOURS.length];
            if (i === labels.length - 1 && i > 0 && colour === COLOURS[0]) colour = COLOURS[1 + (i % 3)];
            ctx.fillStyle = colour;
            ctx.fill();
            ctx.strokeStyle = '#17264d';
            ctx.lineWidth = Math.max(2, size / 180);
            ctx.stroke();

            ctx.save();
            ctx.translate(r, r);
            ctx.rotate(start + slice / 2);
            ctx.fillStyle = '#17264d';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(fitLabel(ctx, text, r - size / 8, biggest), r - size / 30, 0);
            ctx.restore();
        });
        ctx.beginPath();
        ctx.arc(r, r, size / 18, 0, 2 * Math.PI);
        ctx.fillStyle = '#17264d';
        ctx.fill();
    }

    function reset(canvas) {
        canvas.style.transition = 'none';
        canvas.style.transform = 'rotate(0deg)';
    }

    function spinTo(canvas, index, count, done) {
        const slice = 360 / count;
        // Land somewhere inside the winning slice, not always dead centre.
        const offset = (index + 0.5) * slice + (Math.random() - 0.5) * slice * 0.7;
        const turns = 5 + Math.floor(Math.random() * 3);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const seconds = reduceMotion ? 0.01 : SPIN_SECONDS;
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            done();
        };
        canvas.getBoundingClientRect();   // make the browser register the reset position
        canvas.style.transition = 'transform ' + seconds + 's cubic-bezier(0.12, 0.6, 0.1, 1)';
        canvas.style.transform = 'rotate(' + (turns * 360 - offset) + 'deg)';
        canvas.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, seconds * 1000 + 300);   // in case the transition event never arrives
    }

    return { draw, reset, spinTo };
})();
