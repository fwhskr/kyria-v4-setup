/*
 * Character-first picker (UI-4, ADR-S10). The Estonian keyboard shows what each key
 * types at the chosen level; search finds any character through keycodes.forCharacter.
 */
(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const {h} = A.dom;
  const S = A.state;

  const ROWS = [
    {offset: 0, ids: ['KC_GRAVE', 'KC_1', 'KC_2', 'KC_3', 'KC_4', 'KC_5', 'KC_6', 'KC_7', 'KC_8', 'KC_9', 'KC_0', 'KC_MINUS', 'KC_EQUAL']},
    {offset: 1.5, ids: ['KC_Q', 'KC_W', 'KC_E', 'KC_R', 'KC_T', 'KC_Y', 'KC_U', 'KC_I', 'KC_O', 'KC_P', 'KC_LBRACKET', 'KC_RBRACKET']},
    {offset: 1.75, ids: ['KC_A', 'KC_S', 'KC_D', 'KC_F', 'KC_G', 'KC_H', 'KC_J', 'KC_K', 'KC_L', 'KC_SCOLON', 'KC_QUOTE', 'KC_BSLASH']},
    {offset: 1.25, ids: ['KC_NONUS_BSLASH', 'KC_Z', 'KC_X', 'KC_C', 'KC_V', 'KC_B', 'KC_N', 'KC_M', 'KC_COMMA', 'KC_DOT', 'KC_SLASH']}
  ];
  const CHAR_CATEGORIES = new Set(['letters', 'digits', 'punctuation', 'shifted-symbols']);
  // The level switch only chooses characters, so the modifier keys get a tab named after them,
  // listed first in it, and a link to them beside the level switch (owner: "they were on a different tab").
  const TABS = [
    {id: 'chars', label: 'Characters'}, {id: 'keys', label: 'Modifiers and other keys'}, {id: 'layers', label: 'Layers'},
    {id: 'macros', label: 'Macros'}, {id: 'tapdances', label: 'Tap dances'}
  ];
  const DEAD_NAMES = {'\u02c7': 'caron', '~': 'tilde', '\u00b4': 'acute accent', '`': 'grave accent', '\u00a8': 'diaeresis', '\u02da': 'ring above',
    '^': 'circumflex', '\u02dd': 'double acute', '\u02d8': 'breve', '\u02d9': 'dot above', '\u00b8': 'cedilla', '\u00af': 'macron', '\u02db': 'ogonek'};

  const hidOf = id => S.guard(() => { const e = KS.keycodes.byId(id); return e && Number.isInteger(e.hid) ? e.hid : null; }, null);
  const outputOf = hid => (hid === null ? null : S.guard(() => KS.estonian.output(hid), null));
  const levelLabel = lv => A.text.levels[lv].label;

  function codeFor(id, level) {
    if (level === 0) return id;
    const out = outputOf(hidOf(id));
    const ch = out && out.levels[level];
    if (ch) {
      const opts = S.guard(() => KS.keycodes.forCharacter(ch).direct, []) || [];
      const want = ['plain', 'shift', 'altgr', 'shiftAltgr'][level];
      const hit = opts.find(o => o.level === want && o.hid === hidOf(id) && !o.keypad);
      if (hit) return hit.code;
    }
    return S.guard(() => S.format({k: 'mods', mods: Object.assign({ctrl: false, shift: false, alt: false, gui: false, right: false}, A.text.levels[level].mods), inner: {k: 'basic', id}}), null, false);
  }

  function describeChar(ch, dead) {
    if (dead) return `dead ${DEAD_NAMES[ch] || 'accent ' + ch}: types nothing until the next letter`;
    if (ch === ' ') return 'space';
    return ch;
  }

  function keyNameFor(hid) {
    const out = outputOf(hid);
    const plain = out && out.levels[0];
    return plain ? `${plain} key` : `HID 0x${hid.toString(16)}`;
  }

  /* ---------- assigning ---------- */
  function assign(code, what) {
    const ui = A.store.ui, t = ui.target;
    const info = S.targetInfo(t);
    if (!t || !info) { S.setMessage(A.text.noTarget, 'alert'); S.render(); return; }
    if (info.readOnly) { S.setMessage(info.readOnly, 'alert'); S.render(); return; }
    if (info.append) { S.writeTarget(t, code, `Macro M${t.index}: added ${what.replace(/^types /, '')}`); return; }
    let finalCode = code, note = '';
    const cur = typeof info.code === 'string' ? S.parse(info.code) : null;
    const next = S.parse(code);
    if (cur && (cur.k === 'modtap' || cur.k === 'layertap')) {
      if (next.k === 'basic') {
        const kept = S.guard(() => S.format(cur.k === 'modtap' ? {k: 'modtap', mods: cur.mods, tap: next} : {k: 'layertap', layer: cur.layer, tap: next}), null, false);
        if (kept) { finalCode = kept; note = ', kept its hold action'; }
      } else note = '. Its hold action was removed: hold actions need a plain key';
    }
    S.writeTarget(t, finalCode, `${info.title} now ${what.startsWith('types') ? what : 'sends ' + what}${note}`);
  }

  function makeSequenceMacro(ch, seq) {
    const t = A.store.ui.target, info = S.targetInfo(t);
    if (!t || !info || info.readOnly || info.append) { S.setMessage(A.text.noTarget, 'alert'); S.render(); return; }
    const f = S.fields();
    const free = Array.isArray(f.macro) ? f.macro.findIndex(m => Array.isArray(m) && m.length === 0) : -1;
    if (free < 0) { S.setMessage('No empty macro is left in this file, so this character can\u2019t be added.', 'alert'); S.render(); return; }
    const macroCode = S.guard(() => S.format({k: 'macro', index: free}), null);
    const parts = seq.map(c => S.macroActionsFor(c));
    if (!macroCode || parts.some(p => !p)) { S.setMessage('This character can\u2019t be built from key taps.', 'alert'); S.render(); return; }
    let op;
    try { op = {type: 'batch', ops: [{type: 'macro.set', index: free, actions: [].concat(...parts)}, S.opFor(t, macroCode)]}; }
    catch (e) { S.report(e, 'Adding the macro'); S.render(); return; }
    S.commit(op, `${info.title} now types ${ch} through macro M${free}`);
  }

  /* ---------- character keyboard ---------- */
  function charKeyboard() {
    const ui = A.store.ui, level = ui.level;
    const rows = ROWS.map(row => h('div', {class: 'pk-row', style: {'--offset': String(row.offset)}},
      row.ids.map(id => {
        const hid = hidOf(id), out = outputOf(hid);
        const ch = out ? out.levels[level] : null, dead = !!(out && out.dead[level]);
        const plain = out ? out.levels[0] : null;
        const code = ch ? codeFor(id, level) : null;
        const label = ch
          ? `${describeChar(ch, dead)}. ${levelLabel(level)}${level ? ' + ' : ''}${level ? keyNameFor(hid) : 'on the ' + keyNameFor(hid)}`
          : `${keyNameFor(hid)}: types nothing with ${levelLabel(level)}`;
        return h('button', {type: 'button', class: ['pk', dead && 'is-dead', !ch && 'is-empty'], 'aria-label': label,
          'aria-disabled': !ch || !code ? 'true' : undefined, title: code ? `${label} (${code})` : label,
          'data-fid': `pk:${id}`,
          on: {click: () => { if (!ch || !code) { S.setMessage(ch ? 'This combination can\u2019t be written as one Vial keycode.' : `${keyNameFor(hid)} types nothing with ${levelLabel(level)}.`, 'status'); S.render(`pk:${id}`); return; } assign(code, dead ? `types dead ${ch}` : `types ${ch}`); }}},
          level !== 0 && plain ? h('span', {class: 'pk-base', 'aria-hidden': 'true', text: plain}) : null,
          h('span', {class: 'pk-char', 'aria-hidden': 'true', text: ch || ''}),
          dead ? h('span', {class: 'pk-dead', 'aria-hidden': 'true', text: 'dead'}) : null);
      })));
    return h('div', {class: 'pk-board', role: 'group', 'aria-label': `Estonian keyboard, ${levelLabel(level)} level`}, rows);
  }

  function levelSwitch() {
    const ui = A.store.ui;
    const name = A.dom.id('level');
    return h('fieldset', {class: 'segmented'},
      h('legend', {class: 'visually-hidden', text: 'Level'}),
      A.text.levels.map(lv => h('label', {class: 'segment'},
        h('input', {type: 'radio', name, value: String(lv.id), checked: ui.level === lv.id, 'data-fid': `level:${lv.id}`,
          on: {change: () => { ui.level = lv.id; S.persistUi(); S.render(`level:${lv.id}`); }}}),
        h('span', {text: lv.label}))));
  }

  function showModifiers() {
    const ui = A.store.ui;
    ui.pickerTab = 'keys'; ui.keyCategory = 'modifiers'; ui.search = '';
    S.render('ptab:keys');
  }

  /* ---------- search ---------- */
  function searchResults(q) {
    const out = [];
    const query = q.trim();
    if (!query) return out;
    const single = Array.from(query.normalize('NFC')).length === 1 ? query.normalize('NFC') : (query === ' ' ? ' ' : null);
    if (single) {
      const r = S.guard(() => KS.keycodes.forCharacter(single), {direct: [], sequence: null});
      const direct = (r && r.direct) || [];
      direct.forEach(o => {
        const how = o.level === 'plain' ? `the ${keyNameFor(o.hid)}` : `${levelLabel(['plain', 'shift', 'altgr', 'shiftAltgr'].indexOf(o.level))} + ${keyNameFor(o.hid)}`;
        const where = o.keypad ? ' (keypad)' : '';
        out.push(h('button', {type: 'button', class: 'result', 'data-fid': `res:${o.code}`,
          'aria-label': `${o.dead ? describeChar(single, true) : single}: ${how}${where}`,
          on: {click: () => assign(o.code, o.dead ? `types dead ${single}` : `types ${single}`)}},
        h('span', {class: ['result-char', o.dead && 'is-dead'], 'aria-hidden': 'true', text: single}),
        h('span', {class: 'result-how', text: `${how}${where}${o.dead ? ' (dead key)' : ''}`}),
        h('code', {class: 'result-code', text: o.code})));
      });
      if (r && Array.isArray(r.sequence) && r.sequence.length === 2) {
        const f = S.fields();
        const free = Array.isArray(f.macro) ? f.macro.findIndex(m => Array.isArray(m) && m.length === 0) : -1;
        out.push(h('div', {class: 'result result-note'},
          h('span', {class: 'result-char', 'aria-hidden': 'true', text: single}),
          h('span', {class: 'result-how', text: `Not on the layout. Typed as two presses: ${r.sequence.join(' then ')}.`}),
          free >= 0 ? h('button', {type: 'button', class: 'button', 'data-fid': 'res:sequence', text: `Make macro M${free} and assign`, on: {click: () => makeSequenceMacro(single, r.sequence)}})
            : h('span', {class: 'hint', text: 'No empty macro is left to hold it.'})));
      }
      if (!direct.length && !(r && r.sequence)) out.push(h('p', {class: 'hint', text: `${single} can\u2019t be typed on the Estonian layout.`}));
    }
    if (query.length >= 2 || (!single && query.length >= 1)) {
      const ql = query.toLowerCase();
      const entries = S.guard(() => KS.keycodes.catalog, []) || [];
      const rank = e => {
        const names = [e.label, e.id, e.id.replace(/^KC_/, '')].concat(e.aliases || []).map(x => String(x).toLowerCase());
        if (names.some(x => x === ql)) return 0;
        if (names.some(x => x.startsWith(ql))) return 1;
        return names.some(x => x.includes(ql)) ? 2 : -1;
      };
      const matches = entries.map((e, i) => ({e, r: rank(e), i})).filter(x => x.r >= 0).sort((a, b) => a.r - b.r || a.i - b.i);
      let n = 0;
      for (const {e} of matches) {
        if (n >= 30) break;
        const legend = S.legendFor(e.id);
        out.push(h('button', {type: 'button', class: 'result', 'data-fid': `res:${e.id}`, 'aria-label': `${legend.a11y || e.label} (${e.id})`,
          on: {click: () => assign(e.id, legend.kind === 'char' ? `types ${legend.main}` : (legend.main || e.label))}},
        h('span', {class: 'result-char', 'aria-hidden': 'true', text: legend.main || e.label}),
        h('span', {class: 'result-how', text: e.label}),
        h('code', {class: 'result-code', text: e.id})));
        n++;
      }
      S.fields().layout.forEach((_, i) => {
        if (!S.layerName(i).toLowerCase().includes(ql) && !(`layer ${i}`).includes(ql)) return;
        const code = S.guard(() => S.format({k: 'layer', fn: 'MO', layer: i}), null);
        if (code) out.push(h('button', {type: 'button', class: 'result', 'data-fid': `res:${code}`, on: {click: () => assign(code, `hold layer ${i} ${S.layerName(i)}`)}},
          h('span', {class: 'result-char', 'aria-hidden': 'true', text: String(i)}),
          h('span', {class: 'result-how', text: `Hold for layer ${i}: ${S.layerName(i)}`}), h('code', {class: 'result-code', text: code})));
      });
    }
    if (!out.length) out.push(h('p', {class: 'hint', text: `Nothing matches \u201c${query}\u201d. Type one character, such as \u00f5, @ or \u20ac, or a key name such as enter or volume.`}));
    return out;
  }

  /* ---------- other tabs ---------- */
  function keysTab() {
    const ui = A.store.ui;
    const listed = (S.guard(() => KS.keycodes.categories, []) || []).filter(c => !CHAR_CATEGORIES.has(c.id) && Array.isArray(c.ids) && c.ids.length);
    const cats = listed.filter(c => c.id === 'modifiers').concat(listed.filter(c => c.id !== 'modifiers'));
    if (!cats.length) return h('p', {class: 'hint', text: 'The keycode catalog isn\u2019t available.'});
    if (!cats.some(c => c.id === ui.keyCategory)) ui.keyCategory = cats[0].id;
    const cat = cats.find(c => c.id === ui.keyCategory);
    const name = A.dom.id('cat');
    return h('div', {class: 'keys-tab'},
      h('fieldset', {class: 'chips'}, h('legend', {class: 'visually-hidden', text: 'Category'}),
        cats.map(c => h('label', {class: 'chip'}, h('input', {type: 'radio', name, checked: c.id === cat.id, 'data-fid': `cat:${c.id}`,
          on: {change: () => { ui.keyCategory = c.id; S.render(`cat:${c.id}`); }}}), h('span', {text: c.label})))),
      h('div', {class: 'action-grid'}, cat.ids.map(id => {
        const legend = S.legendFor(id);
        const entry = S.guard(() => KS.keycodes.byId(id), null);
        const text = legend.main || (entry && entry.label) || id;
        return h('button', {type: 'button', class: 'action', 'data-fid': `act:${id}`, title: id, 'aria-label': `${entry && entry.label ? entry.label : text} (${id})`,
          on: {click: () => assign(id, legend.kind === 'char' ? `types ${text}` : text)}},
        h('span', {class: 'action-main', text}), h('code', {class: 'action-code', text: id}));
      })));
  }

  function layersTab() {
    const fns = [['MO', 'Hold'], ['TG', 'Toggle'], ['TO', 'Switch to'], ['OSL', 'Next key only'], ['TT', 'Hold or tap-toggle'], ['DF', 'Set default']];
    return h('div', {class: 'layer-actions'}, S.fields().layout.map((_, i) => h('div', {class: 'layer-action-row', style: {'--layer': S.layerColor(i)}},
      h('span', {class: 'layer-action-name'}, h('span', {class: 'layer-num', text: String(i)}), ' ', S.layerName(i)),
      h('div', {class: 'layer-action-buttons'}, fns.map(([fn, label]) => {
        const code = S.guard(() => S.format({k: 'layer', fn, layer: i}), null, false);
        if (!code) return null;
        return h('button', {type: 'button', class: 'button button-small', 'data-fid': `lay:${fn}:${i}`, title: code, 'aria-label': `${label} layer ${i} ${S.layerName(i)} (${code})`,
          text: label, on: {click: () => assign(code, `${label.toLowerCase()} layer ${i} ${S.layerName(i)}`)}});
      })))));
  }

  function macrosTab() {
    const f = S.fields();
    if (!Array.isArray(f.macro)) return h('p', {class: 'hint', text: S.isRaw(f.macro) ? 'Macros in this file are kept as is and can\u2019t be assigned here.' : 'This file has no macros.'});
    return h('div', {class: 'action-grid'}, f.macro.map((m, i) => {
      const code = S.guard(() => S.format({k: 'macro', index: i}), 'M' + i);
      const summary = S.isRaw(m) ? 'kept as is' : m.length ? `types ${S.macroText(m).text || '\u2026'}` : 'empty';
      return h('button', {type: 'button', class: 'action', 'data-fid': `mac:${i}`, on: {click: () => assign(code, `macro M${i}`)}},
        h('span', {class: 'action-main', text: `M${i}`}), h('span', {class: 'action-code', text: summary}));
    }));
  }

  function tapDanceTab() {
    const f = S.fields();
    if (!Array.isArray(f.tap_dance)) return h('p', {class: 'hint', text: S.isRaw(f.tap_dance) ? 'Tap dances in this file are kept as is.' : 'This file has no tap dances.'});
    return h('div', {class: 'action-grid'}, f.tap_dance.map((td, i) => {
      const code = S.guard(() => S.format({k: 'tapdance', index: i}), `TD(${i})`);
      const legend = S.legendFor(code);
      return h('button', {type: 'button', class: 'action', 'data-fid': `td:${i}`, on: {click: () => assign(code, `tap dance TD${i}`)}},
        h('span', {class: 'action-main', text: `TD${i}`}), h('span', {class: 'action-code', text: S.isRaw(td) ? 'kept as is' : (legend.detail || legend.main || '')}));
    }));
  }

  /* ---------- render ---------- */
  function render() {
    const ui = A.store.ui;
    const info = S.targetInfo(ui.target);
    const body = h('div', {class: 'picker-body', id: 'picker-body'});
    const searchId = A.dom.id('search');
    const search = h('input', {id: searchId, class: 'input search', type: 'search', value: ui.search, autocomplete: 'off', spellcheck: 'false',
      placeholder: 'Find a character or key, e.g. \u00f5, @, ctrl or enter', 'data-fid': 'picker-search', 'aria-describedby': 'picker-target',
      on: {input: e => { ui.search = e.target.value; fill(body); }, keydown: e => { if (e.key === 'Escape' && ui.search) { e.preventDefault(); ui.search = ''; e.target.value = ''; fill(body); } }}});
    const tabs = h('div', {class: 'picker-tabs', role: 'tablist', 'aria-label': 'Picker sections'},
      TABS.map((t, i) => h('button', {type: 'button', role: 'tab', class: 'picker-tab', 'aria-selected': String(ui.pickerTab === t.id), tabindex: ui.pickerTab === t.id ? '0' : '-1',
        'aria-controls': 'picker-body', 'data-fid': `ptab:${t.id}`, text: t.label,
        on: {click: () => { ui.pickerTab = t.id; ui.search = ''; S.render(`ptab:${t.id}`); },
          keydown: e => {
            const j = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : null;
            if (j !== null) { e.preventDefault(); ui.pickerTab = TABS[j].id; ui.search = ''; S.render(`ptab:${TABS[j].id}`); }
          }}})));
    function fill(container) {
      A.dom.clear(container);
      if (ui.search.trim()) { container.setAttribute('aria-label', 'Search results'); container.append(h('div', {class: 'results'}, searchResults(ui.search))); return; }
      container.removeAttribute('aria-label');
      if (ui.pickerTab === 'chars') container.append(
        h('div', {class: 'pk-toolbar'}, levelSwitch(),
          h('button', {type: 'button', class: 'link pk-modifiers', 'data-fid': 'show-modifiers', text: 'Ctrl, Shift, Alt and other modifiers', on: {click: showModifiers}})),
        charKeyboard(),
        h('p', {class: 'hint', text: 'Dotted keys are dead keys: they add an accent to the next letter. Shift + AltGr characters and every AltGr character are reachable here and through search.'}));
      else if (ui.pickerTab === 'keys') container.append(keysTab());
      else if (ui.pickerTab === 'layers') container.append(layersTab());
      else if (ui.pickerTab === 'macros') container.append(macrosTab());
      else container.append(tapDanceTab());
    }
    fill(body);
    return h('section', {class: 'picker panel', 'aria-labelledby': 'picker-title'},
      h('div', {class: 'picker-head'},
        h('h2', {id: 'picker-title', class: 'section-title', text: 'Choose what it types'}),
        h('p', {id: 'picker-target', class: ['hint', !info && 'hint-strong'], text: info ? `Assigning to ${info.title}.` : 'Select a key on the board or a slot in an editor first.'})),
      h('label', {class: 'visually-hidden', for: searchId, text: 'Find a character or key'}), search,
      tabs, body);
  }

  A.picker = {render, assign, codeFor, hidOf, outputOf, describeChar, keyNameFor, ROWS};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
