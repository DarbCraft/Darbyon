/*
 * Adding many students at once.
 *
 * Reads a pasted list, a CSV file, or the Excel file that Microsoft Forms
 * gives you ("Open results in Excel"), and works out each student's name,
 * class, avatar, first power and team. Nothing is saved here: the Settings
 * page shows a preview first and saves only when the teacher confirms.
 */
Darbyon.Import = (() => {
    'use strict';

    // ---- Reading text (pasted lists and CSV files) ------------------------

    // Splits text into rows of cells. Handles commas or tabs between cells
    // and "quoted, cells" as written by Excel.
    function parseText(text) {
        text = String(text).replace(/^﻿/, '');
        const delimiter = text.indexOf('\t') !== -1 ? '\t' : ',';
        const rows = [];
        let row = [], cell = '', quoted = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (quoted) {
                if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
                else if (ch === '"') quoted = false;
                else cell += ch;
            } else if (ch === '"' && cell === '') {
                quoted = true;
            } else if (ch === delimiter) {
                row.push(cell); cell = '';
            } else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row.push(cell); rows.push(row); row = []; cell = '';
            } else {
                cell += ch;
            }
        }
        row.push(cell);
        rows.push(row);
        return tidy(rows);
    }

    function tidy(rows) {
        return rows.map(r => r.map(c => String(c === undefined || c === null ? '' : c).trim()))
                   .filter(r => r.some(c => c !== ''));
    }

    // ---- Reading Excel files ----------------------------------------------
    // An .xlsx file is a zip of XML files. This reads just enough of it to
    // get the cells of the first sheet, so no extra library is needed.

    async function inflate(bytes) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function unzip(buffer) {
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);
        let end = -1;
        for (let i = buffer.byteLength - 22; i >= 0 && i >= buffer.byteLength - 66000; i--) {
            if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
        }
        if (end === -1) throw new Error('not a zip file');
        const count = view.getUint16(end + 10, true);
        let at = view.getUint32(end + 16, true);
        const decoder = new TextDecoder();
        const files = {};
        for (let n = 0; n < count; n++) {
            if (view.getUint32(at, true) !== 0x02014b50) break;
            const method = view.getUint16(at + 10, true);
            const size = view.getUint32(at + 20, true);
            const nameLength = view.getUint16(at + 28, true);
            const extraLength = view.getUint16(at + 30, true);
            const commentLength = view.getUint16(at + 32, true);
            const local = view.getUint32(at + 42, true);
            const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
            const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
            files[name] = { method: method, data: bytes.subarray(start, start + size) };
            at += 46 + nameLength + extraLength + commentLength;
        }
        return {
            names: Object.keys(files),
            async text(name) {
                const file = files[name];
                if (!file) return null;
                if (file.method !== 0 && file.method !== 8) throw new Error('unsupported zip compression');
                return decoder.decode(file.method === 8 ? await inflate(file.data) : file.data);
            }
        };
    }

    function columnNumber(reference) {
        const letters = (reference || '').replace(/[^A-Z]/gi, '').toUpperCase();
        let n = 0;
        for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
        return n - 1;
    }

    const textOf = node => Array.from(node.getElementsByTagName('t')).map(t => t.textContent).join('');

    async function readXlsx(buffer) {
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('This browser cannot open Excel files. In Excel choose File, Save As, CSV and upload that instead.');
        }
        const zip = await unzip(buffer);
        const parser = new DOMParser();
        const sharedXml = await zip.text('xl/sharedStrings.xml');
        const shared = sharedXml
            ? Array.from(parser.parseFromString(sharedXml, 'application/xml').getElementsByTagName('si')).map(textOf)
            : [];
        const sheetName = zip.names.filter(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0];
        if (!sheetName) throw new Error('no worksheet found');
        const sheet = parser.parseFromString(await zip.text(sheetName), 'application/xml');
        const rows = [];
        Array.from(sheet.getElementsByTagName('row')).forEach(rowNode => {
            const row = [];
            Array.from(rowNode.getElementsByTagName('c')).forEach((c, index) => {
                const column = c.getAttribute('r') ? columnNumber(c.getAttribute('r')) : index;
                const type = c.getAttribute('t');
                const v = c.getElementsByTagName('v')[0];
                let value = '';
                if (type === 's') value = shared[parseInt(v ? v.textContent : '', 10)] || '';
                else if (type === 'inlineStr') value = textOf(c);
                else if (v) value = v.textContent;
                row[column] = value;
            });
            rows.push(Array.from(row, cell => cell === undefined ? '' : cell));
        });
        return tidy(rows);
    }

    // Reads an uploaded file into rows of cells.
    async function readFile(file) {
        const buffer = await file.arrayBuffer();
        const start = new Uint8Array(buffer.slice(0, 2));
        if (start[0] === 0x50 && start[1] === 0x4b) return readXlsx(buffer);   // "PK": a zip, so Excel
        if (/\.xls$/i.test(file.name)) {
            throw new Error('This is an old-style .xls file. Save it as .xlsx or CSV and try again.');
        }
        return parseText(new TextDecoder().decode(buffer));
    }

    // ---- Working out what the rows mean -----------------------------------

    const lower = text => String(text).toLowerCase();

    // Finds the columns by their headings. Microsoft Forms uses each question
    // as a heading, so "What is your first name?" is recognised as the name.
    function findColumns(header) {
        const h = header.map(lower);
        const columns = { name: -1, type: -1, avatars: [], power: -1, team: -1 };
        let bestName = 0;
        h.forEach((text, i) => {
            if (text.indexOf('avatar') !== -1) { columns.avatars.push(i); return; }
            if (text.indexOf('power') !== -1) { if (columns.power === -1) columns.power = i; return; }
            if (text.indexOf('team') !== -1) { if (columns.team === -1) columns.team = i; return; }
            if (text.indexOf('name') !== -1) {
                // Prefer the question the students answered over Forms' own "Name" column.
                const score = text.indexOf('first name') !== -1 ? 4
                            : /character|student|your name/.test(text) ? 3
                            : text !== 'name' ? 2 : 1;
                if (score >= bestName) { bestName = score; columns.name = i; }
                return;
            }
            if (/class|type|character/.test(text) && columns.type === -1) columns.type = i;
        });
        return columns;
    }

    // The first row is a heading row if one of its cells is a "name" heading
    // (such as "Name" or "What is your first name?").
    function looksLikeHeader(row) {
        return row.some(cell => /\bname\b/.test(lower(cell)));
    }

    function matchClass(text) {
        const wanted = lower(text);
        if (!wanted) return null;
        return Object.keys(Darbyon.CLASSES).find(type => wanted.indexOf(lower(type)) !== -1) || null;
    }

    // Accepts "mage-f2", or a number from 1 to 6 such as "Mage 5" or "Avatar 5".
    function matchAvatar(text, type) {
        const choices = Darbyon.AVATARS[type] || [];
        const wanted = lower(text).trim();
        if (!wanted) return '';
        if (choices.indexOf(wanted) !== -1) return wanted;
        const number = wanted.match(/\d+/);
        if (number && choices[parseInt(number[0], 10) - 1]) return choices[parseInt(number[0], 10) - 1];
        return null;
    }

    // Turns rows into a list of students ready to preview.
    //   options.defaultType: the class for students whose row does not say
    function plan(rows, options) {
        const result = { students: [], skipped: 0, hasHeader: false };
        if (!rows.length) return result;
        let columns;
        if (looksLikeHeader(rows[0])) {
            result.hasHeader = true;
            columns = findColumns(rows[0]);
            rows = rows.slice(1);
            if (columns.name === -1) {
                result.error = 'No column with "name" in its heading was found.';
                return result;
            }
        } else {
            columns = { name: 0, type: 1, avatars: [2], power: 3, team: 4 };
        }

        const powers = Darbyon.getPowers();
        const byName = {};
        rows.forEach(row => {
            const cell = index => (index >= 0 && row[index] !== undefined ? row[index] : '');
            const name = cell(columns.name).trim();
            if (!name || lower(name) === 'anonymous') { result.skipped++; return; }
            const notes = [];

            let type = matchClass(cell(columns.type));
            if (!type) {
                type = options.defaultType;
                notes.push(cell(columns.type) ? 'Class "' + cell(columns.type) + '" not recognised, set to ' + type
                                              : 'No class given, set to ' + type);
            }

            // With one avatar question per class, use the answer that belongs to this class.
            const answered = columns.avatars.filter(i => cell(i));
            let avatar = '';
            if (answered.length) {
                const own = answered.find(i => result.hasHeader &&
                    lower(options.header[i] || '').indexOf(lower(type)) !== -1);
                const chosen = cell(own !== undefined ? own : answered[answered.length - 1]);
                avatar = matchAvatar(chosen, type);
                if (avatar === null) {
                    avatar = '';
                    notes.push('Avatar "' + chosen + '" not recognised');
                }
            }

            const powerIds = [];
            const powerText = cell(columns.power);
            if (powerText) {
                powerText.split(/[;]+/).map(p => p.trim()).filter(Boolean).forEach(wanted => {
                    const power = powers.find(p => lower(p.name) === lower(wanted));
                    if (power) powerIds.push(power.id);
                    else notes.push('Power "' + wanted + '" does not exist yet');
                });
            }

            const student = { name: name, type: type, avatar: avatar, powers: powerIds,
                              team: cell(columns.team).trim(), notes: notes };
            // A student who answered twice keeps their latest answer.
            const key = lower(name);
            if (byName[key] !== undefined) {
                student.notes.push('Answered more than once, latest answer used');
                result.students[byName[key]] = student;
            } else {
                byName[key] = result.students.length;
                result.students.push(student);
            }
        });
        return result;
    }

    return {
        parseText, readFile,
        plan(rows, options) {
            return plan(rows, Object.assign({ header: rows[0] || [] }, options));
        }
    };
})();
