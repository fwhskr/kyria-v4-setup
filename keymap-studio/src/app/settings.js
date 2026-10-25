/*
 * Settings view (UI-5, UI-7, UI-8, UI-9): file facts and UID, layout options,
 * QMK settings present in the file, limits, and reset to the built-in layout.
 */
(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const {h} = A.dom;
  const S = A.state;

  const bit = (v, b) => Math.floor(v / 2 ** b) % 2 === 1;
  const setBit = (v, b, on) => (bit(v, b) === on ? v : v + (on ? 1 : -1) * 2 ** b);

  function fileSection() {
    const ws = S.ws(), f = ws.doc.fields;
    const rounded = f.uid === KS.board.roundedUid;
    const known = f.uid === KS.board.knownUid;
    const extras = ws.doc.extra.length;
    const rows = [
      ['File', ws.filename],
      ['Keyboard UID', typeof f.uid === 'string' ? f.uid : 'kept as is'],
      ['Vial protocol', f.vial_protocol !== undefined && !S.isRaw(f.vial_protocol) ? String(f.vial_protocol) : 'not in file'],
      ['Layers', String(f.layout.length)]
    ];
    return h('section', {class: 'panel settings-section', 'aria-labelledby': 'file-title'},
      h('h2', {id: 'file-title', class: 'section-title', text: 'This file'}),
      h('dl', {class: 'facts'}, rows.map(([k, v]) => [h('dt', {text: k}), h('dd', {}, h('span', {class: k === 'Keyboard UID' ? 'mono' : '', text: v}))])),
      known ? h('p', {class: 'hint', text: 'The UID matches the Kyria rev4 this studio is made for.'}) : null,
      rounded ? h('div', {class: 'notice notice-warning'},
        h('p', {text: `This UID was rounded by a JavaScript tool (${KS.board.roundedUid}). Vial warns when it loads a file whose UID differs from the keyboard.`}),
        h('button', {type: 'button', class: 'button', 'data-fid': 'uid-restore', text: `Restore exact UID ${KS.board.knownUid}`,
          on: {click: () => S.commit({type: 'uid.restoreKnown'}, 'Restored the exact Kyria UID', {focus: 'uid-restore'})}})) : null,
      !known && !rounded && typeof f.uid === 'string' ? h('p', {class: 'notice notice-warning', text: 'This UID is not the Kyria rev4 one. Vial will warn that the file is for a different keyboard.'}) : null,
      extras ? h('p', {class: 'hint', text: `${A.text.plural(extras, 'other field', 'other fields')} in the file ${extras === 1 ? 'is' : 'are'} kept exactly as imported.`}) : null);
  }

  function layoutOptionsSection() {
    const f = S.fields();
    const body = [h('h2', {id: 'lo-title', class: 'section-title', text: 'Layout options'})];
    if (!Object.prototype.hasOwnProperty.call(f, 'layout_options')) {
      body.push(h('p', {class: 'notice notice-danger', text: 'This file has no layout options. Vial needs them, so export is blocked. Open a file saved by Vial.'}));
    } else if (S.isRaw(f.layout_options) || typeof f.layout_options !== 'number') {
      body.push(h('p', {class: 'notice', text: 'The layout options value isn\u2019t in a format the studio edits. It is kept as imported.'}));
    } else {
      const labels = KS.board.layoutOptionLabels;
      const decoded = S.guard(() => KS.vil.layoutOptions.decode(f.layout_options, labels), null);
      if (!decoded) body.push(h('p', {class: 'notice', text: `The stored value ${f.layout_options} doesn\u2019t match the Kyria rev4 options. It is kept as imported.`}));
      else {
        const values = decoded.map(d => d.value);
        const change = (i, v, focus) => {
          const next = values.slice(); next[i] = v;
          let value;
          try { value = KS.vil.layoutOptions.encode(next, labels); } catch (e) { S.report(e, 'Changing layout options'); S.render(); return; }
          S.commit({type: 'layoutOptions.set', value}, `Layout option \u201c${decoded[i].label}\u201d set to ${decoded[i].kind === 'bool' ? (v ? 'on' : 'off') : decoded[i].choices[v]}`, {focus});
        };
        body.push(h('p', {class: 'hint', text: 'Which optional parts are fitted. They decide which encoders and module buttons Vial shows. The imported value is kept until you change it.'}));
        body.push(h('div', {class: 'options-list'}, decoded.map((d, i) => {
          const fid = `lo:${i}`;
          if (d.kind === 'bool') return h('label', {class: 'toggle'}, h('input', {type: 'checkbox', checked: d.value === 1, 'data-fid': fid, on: {change: e => change(i, e.target.checked ? 1 : 0, fid)}}), h('span', {text: d.label}));
          const id = A.dom.id('lo');
          return h('div', {class: 'field step-inline'}, h('label', {class: 'field-label', for: id, text: d.label}),
            h('select', {id, class: 'input', 'data-fid': fid, on: {change: e => change(i, Number(e.target.value), fid)}},
              d.choices.map((c, j) => h('option', {value: String(j), selected: j === d.value, text: c}))));
        })));
        body.push(h('p', {class: 'hint', text: `Stored value: ${f.layout_options}.`}));
      }
    }
    return h('section', {class: 'panel settings-section', 'aria-labelledby': 'lo-title'}, body);
  }

  function qmkSection() {
    const f = S.fields();
    const body = [h('h2', {id: 'qmk-title', class: 'section-title', text: 'QMK settings'})];
    if (!Array.isArray(f.settings)) {
      body.push(h('p', {class: 'notice', text: S.isRaw(f.settings) ? 'The settings section isn\u2019t in a format the studio edits. It is kept as imported.' : 'This file has no QMK settings.'}));
      return h('section', {class: 'panel settings-section', 'aria-labelledby': 'qmk-title'}, body);
    }
    const values = new Map(f.settings.map(([q, v]) => [q, v]));
    const tabs = (KS.QMK_SETTINGS && Array.isArray(KS.QMK_SETTINGS.tabs)) ? KS.QMK_SETTINGS.tabs : [];
    if (!tabs.length) body.push(h('p', {class: 'notice', text: 'The QMK settings descriptions aren\u2019t available, so settings are kept as imported.'}));
    const described = new Set();
    for (const tab of tabs) {
      const fields = (tab.fields || []).filter(fl => values.has(fl.qsid));
      fields.forEach(fl => described.add(fl.qsid));
      if (!fields.length) continue;
      body.push(h('fieldset', {class: 'settings-group'},
        h('legend', {class: 'sub-title', text: tab.name}),
        fields.map((fl, n) => {
          const value = values.get(fl.qsid);
          const fid = `qs:${fl.qsid}:${fl.bit === undefined ? 'v' : fl.bit}:${n}`;
          const commit = (v, text) => S.commit({type: 'setting.set', qsid: fl.qsid, value: v}, `${tab.name}: ${fl.title} ${text}`, {focus: fid});
          if (fl.type === 'boolean') {
            const checked = fl.bit === undefined ? value !== 0 : bit(value, fl.bit);
            return h('label', {class: 'toggle'}, h('input', {type: 'checkbox', checked, 'data-fid': fid,
              on: {change: e => commit(fl.bit === undefined ? (e.target.checked ? 1 : 0) : setBit(value, fl.bit, e.target.checked), e.target.checked ? 'on' : 'off')}}),
            h('span', {text: fl.title}));
          }
          const id = A.dom.id('qs');
          const max = Math.min(fl.max !== undefined ? fl.max : Infinity, 2 ** (8 * (fl.width || 1)) - 1), min = fl.min !== undefined ? fl.min : 0;
          return h('div', {class: 'field step-inline'},
            h('label', {class: 'field-label', for: id, text: fl.title}),
            h('input', {id, class: 'input input-number', type: 'number', min, max, step: 1, value: String(value), 'data-fid': fid,
              on: {change: e => {
                const v = Number(e.target.value);
                if (!Number.isInteger(v) || v < min || v > max) { S.setMessage(`${fl.title}: enter a whole number from ${min} to ${max}.`, 'alert'); S.render(fid); return; }
                commit(v, `set to ${v}`);
              }}}));
        })));
    }
    const other = f.settings.filter(([q]) => !described.has(q));
    if (other.length) body.push(h('p', {class: 'hint', text: `Kept as imported (not described by Vial): ${other.map(([q, v]) => `setting ${q} = ${v}`).join(', ')}.`}));
    body.push(h('p', {class: 'hint', text: 'Only settings present in the file are shown; the studio never adds settings the keyboard didn\u2019t report.'}));
    return h('section', {class: 'panel settings-section', 'aria-labelledby': 'qmk-title'}, body);
  }

  function limitsSection() {
    return h('section', {class: 'panel settings-section', 'aria-labelledby': 'limits-title'},
      h('h2', {id: 'limits-title', class: 'section-title', text: 'What this studio can and can\u2019t do'}),
      h('ul', {class: 'limits'}, A.text.limits.map(t => h('li', {text: t}))));
  }

  function resetSection() {
    return h('section', {class: 'panel settings-section', 'aria-labelledby': 'reset-title'},
      h('h2', {id: 'reset-title', class: 'section-title', text: 'Start over'}),
      h('p', {class: 'hint', text: 'Replaces the keymap in this browser with the built-in layout (kriskyria.vil). Export first if you want to keep your edits.'}),
      h('button', {type: 'button', class: 'button button-danger-quiet', 'data-fid': 'reset', text: 'Reset to built-in layout\u2026', on: {click: A.shell.resetToDefault}}));
  }

  function renderView(main) {
    main.append(h('h1', {class: 'view-title', text: 'Settings'}),
      h('div', {class: 'settings-grid'}, fileSection(), layoutOptionsSection(), qmkSection(), limitsSection(), resetSection()));
  }

  A.settings = {renderView};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
