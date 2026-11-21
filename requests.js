/*
 * Power requests from students, waiting for the teacher to say yes or no.
 * Used by the Board and the Powers page:
 *
 *     Darbyon.Requests.render(container, afterAnswer)
 *
 * draws the waiting requests into `container`. afterAnswer(message, kind)
 * is called once a request has been answered.
 */
Darbyon.Requests = (() => {
    'use strict';
    const { el } = Darbyon;

    function render(container, afterAnswer) {
        container.innerHTML = '';
        const waiting = Darbyon.pendingRequests();
        if (!waiting.length) {
            container.appendChild(el('p', 'No students are waiting to use a power.', 'hint'));
            return 0;
        }
        const characters = Darbyon.getCharacters();
        waiting.forEach(request => {
            const student = characters.find(c => c.id === request.studentId) || { name: request.studentName };
            const row = el('div', null, 'request-row');
            const who = el('span', null, 'who');
            who.appendChild(Darbyon.avatarImage(student));
            const text = el('span', null, 'request-text');
            text.appendChild(el('strong', student.name));
            text.appendChild(document.createTextNode(' wants to use ' + request.powerName +
                (request.targetName ? ' on ' + request.targetName : '') + ' (' + request.apCost + ' AP)'));
            who.appendChild(text);
            row.appendChild(who);

            const actions = el('div', null, 'actions');
            const answer = approve => async () => {
                actions.querySelectorAll('button').forEach(b => { b.disabled = true; });
                const result = await Darbyon.answerRequest(request, approve);
                if (result.ok && approve && Darbyon.Battle) Darbyon.Battle.start(result.fallen || []);
                if (afterAnswer) {
                    afterAnswer(result.ok ? (approve ? result.summary + '.' : 'Declined ' + student.name + "'s " + request.powerName + '.')
                                          : result.error, result.ok ? 'success' : 'error');
                }
            };
            const yes = el('button', 'Yes', 'small');
            yes.type = 'button';
            yes.addEventListener('click', answer(true));
            const no = el('button', 'No', 'small danger');
            no.type = 'button';
            no.addEventListener('click', answer(false));
            actions.appendChild(yes);
            actions.appendChild(no);
            row.appendChild(actions);
            container.appendChild(row);
        });
        return waiting.length;
    }

    return { render };
})();
