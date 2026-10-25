/*
 * Feature editors (UI-5): macros, tap dance, combos, key overrides and alt repeat.
 * Entry counts come from the file and never change; {$raw} entries are read-only.
 */
(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const {h} = A.dom;
  const S = A.state;

  const MOD_BITS = ['Left Ctrl', 'Left Shift', 'Left Alt', 'Left Super', 'Right Ctrl', 'Right Shift', 'Right Alt (AltGr)', 'Right Super'];
  const KO_OPTIONS = [
    [0, 'Activate when the trigger key is pressed down'],
    [1, 'Activate when a required modifier is pressed down'],
    [2, 'Activate when a negative modifier is released'],
    [3, 'Activate with any one of the trigger modifiers'],
    [4, 'Don\u2019t register the trigger key again after the override ends'],
    [5, 'Don\u2019t end the override when another key is pressed']
  ];
  const AR_OPTIONS = [[0, 'Default to this alt key'], [1, 'Bidirectional'], [2, 'Ignore modifier handedness']];
  const SECTIONS = {
    macros: {field: 'macro', title: 'Macros', one: 'macro', prefix: 'M'},
    tapdance: {field: 'tap_dance', title: 'Tap dance', one: 'tap dance', prefix: 'TD'},
    combos: {field: 'combo', title: 'Combos', one: 'combo', prefix: 'Combo '},
    overrides: {field: 'key_override', title: 'Key overrides', one: 'key override', prefix: 'Override '},
    altrepeat: {field: 'alt_repeat_key', title: 'Alt repeat', one: 'alt repeat key', prefix: 'Alt repeat '}
  };

  const isNo = c => c === 'KC_NO' || c === 0;
  const bit = (v, b) => Math.floor(v / 2 ** b) % 2 === 1;
  const setBit = (v, b, on) => (bit(v, b) === on ? v : v + (on ? 1 : -1) * 2 ** b);
  const main = code => { if (typeof code !== 'string') return String(code); const lg = S.legendFor(code); return lg.main || (lg.kind === 'none' ? 'nothing' : code); };

  function used(view, item) {
    if (S.isRaw(item)) return true;
    switch (view) {
      case 'macros': return item.length > 0;
      case 'tapdance': return item.slice(0, 4).some(c => !isNo(c));
      case 'combos': return item.some(c => !isNo(c));
      case 'overrides': return bit(item.options, 7) || !isNo(item.trigger) || !isNo(item.replacement);
      case 'altrepeat': return bit(item.options, 3) || !isNo(item.keycode) || !isNo(item.alt_keycode);
      default: return false;
    }
  }
  function count(view) {
    const list = S.fields()[SECTIONS[view].field];
    return Array.isArray(list) ? list.filter(item => used(view, item)).length : 0;
  }

  /* Where a macro or tap dance is referenced on the keymap. */
  function usedBy(matchCode) {
    const out = [];
    S.fields().layout.forEach((rows, l) => rows.forEach((cells, r) => cells.forEach((c, col) => {
      if (typeof c === 'string' && matchCode(c)) out.push({layer: l, row: r, col});
    })));
    return out;
  }
  function usedByList(refs) {
    if (!refs.length) return h('p', {class: 'hint', text: 'Not assigned to any key yet.'});
    return h('ul', {class: 'used-by'}, refs.slice(0, 12).map(ref => h('li', {},
      h('button', {type: 'button', class: 'link', text: `${S.layerName(ref.layer)}: ${S.keyName(ref.row, ref.col)}`,
        on: {click: () => { A.store.ui.layer = ref.layer; A.store.ui.target = {type: 'key', layer: ref.layer, row: ref.row, col: ref.col}; A.shell.go('keymap', `key:${ref.row}:${ref.col}`); }}}))),
    refs.length > 12 ? h('li', {class: 'hint', text: `and ${refs.length - 12} more`}) : null);
  }

  function well(target, caption, code) {
    const ui = A.store.ui;
    const selected = A.board.sameTarget(ui.target, target) || (ui.target && ui.target.type === target.type && ui.target.index === target.index && ui.target.slot === target.slot && ui.target.field === target.field);
    const lg = typeof code === 'string' ? S.legendFor(code) : null;
    const fid = `well:${target.type}:${target.index}:${target.slot ?? target.field}`;
    return h('div', {class: 'well-wrap'},
      h('span', {class: 'well-caption', text: caption}),
      h('button', {type: 'button', class: ['well', selected && 'is-selected', lg && lg.unknown && 'is-unknown', (!lg || lg.kind === 'none') && 'is-empty'],
        'aria-pressed': String(!!selected), 'data-fid': fid, title: typeof code === 'string' ? code : String(code),
        'aria-label': `${caption}: ${lg ? (lg.a11y || lg.main || 'nothing') : String(code)}. Select to change it in the picker.`,
        on: {click: () => { ui.target = target; S.render(fid); }}},
      h('span', {class: 'well-main', text: lg ? (lg.main || (lg.kind === 'none' ? '\u2014' : String(code))) : String(code)}),
      h('code', {class: 'well-code', text: typeof code === 'string' ? code : String(code)})));
  }

  function bitChecks(legendText, value, labels, onChange, fidPrefix, rawLabel) {
    return h('fieldset', {class: 'bits'},
      h('legend', {class: 'field-label', text: legendText}),
      h('div', {class: 'bit-grid'}, labels.map(([b, text]) => h('label', {class: 'toggle'},
        h('input', {type: 'checkbox', checked: bit(value, b), 'data-fid': `${fidPrefix}:${b}`, on: {change: e => onChange(setBit(value, b, e.target.checked))}}),
        h('span', {text})))),
      rawLabel !== false ? h('p', {class: 'hint', text: `Stored byte: ${value}`}) : null);
  }
  const modLabels = () => MOD_BITS.map((t, i) => [i, t]);

  function modsSummary(v) {
    const names = MOD_BITS.filter((_, i) => bit(v, i));
    return names.length ? names.join(' + ') : '';
  }

  /* ---------- list and frame ---------- */
  function frame(view, renderDetail) {
    const ui = A.store.ui, sec = SECTIONS[view], f = S.fields(), list = f[sec.field];
    const wrap = h('div', {class: 'feature'});
    wrap.append(h('h1', {class: 'view-title', text: sec.title}));
    if (!Array.isArray(list)) {
      wrap.append(h('p', {class: 'notice', text: S.isRaw(list) ? `The ${sec.one} section of this file isn\u2019t in a format the studio edits. It is kept exactly as imported.` : `This file has no ${sec.one} entries, so there is nothing to edit. The studio never adds sections Vial didn\u2019t write.`}));
      return wrap;
    }
    if (!list.length) { wrap.append(h('p', {class: 'notice', text: `This file has no ${sec.one} entries.`})); return wrap; }
    let index = ui.index[view];
    if (!(index >= 0 && index < list.length)) index = ui.index[view] = 0;
    const showAll = !!ui.showUnused[view];
    const rows = [];
    let hidden = 0;
    list.forEach((item, i) => {
      const isUsed = used(view, item);
      if (!isUsed && !showAll && i !== index) { hidden++; return; }
      rows.push(h('li', {}, h('button', {type: 'button', class: ['entry', i === index && 'is-current', !isUsed && 'is-unused'], 'aria-current': i === index ? 'true' : undefined,
        'data-fid': `entry:${view}:${i}`, on: {click: () => { ui.index[view] = i; ui.target = null; S.persistUi(); S.render(`entry:${view}:${i}`); }}},
      h('span', {class: 'entry-id', text: `${sec.prefix}${i}`}), h('span', {class: 'entry-summary', text: summary(view, item)}))));
    });
    const nav = h('nav', {class: 'entries', 'aria-label': `${sec.title} entries`},
      h('p', {class: 'hint', text: `${count(view)} of ${list.length} in use. The file holds ${list.length}; Vial keeps only as many as the keyboard supports.`}),
      h('ul', {class: 'entry-list'}, rows),
      hidden || showAll ? h('button', {type: 'button', class: 'button button-quiet button-small', 'data-fid': `unused:${view}`, text: showAll ? 'Hide unused' : `Show ${hidden} unused`,
        on: {click: () => { ui.showUnused[view] = !showAll; S.render(`unused:${view}`); }}}) : null);
    const item = list[index];
    const detail = h('section', {class: 'detail panel', 'aria-labelledby': 'detail-title'});
    detail.append(h('h2', {id: 'detail-title', class: 'section-title', text: `${sec.prefix}${index}`}));
    if (S.isRaw(item)) detail.append(h('p', {class: 'notice', text: 'This entry isn\u2019t in a format the studio edits. It is kept exactly as imported and exported unchanged.'}));
    else renderDetail(detail, item, index);
    wrap.append(h('div', {class: 'feature-grid'}, nav, detail));
    wrap.append(A.dock());
    return wrap;
  }

  function summary(view, item) {
    if (S.isRaw(item)) return 'kept as is';
    switch (view) {
      case 'macros': {
        if (!item.length) return 'empty';
        const t = S.macroText(item);
        return t.text ? `types ${t.text}${t.complete ? '' : ' (approx.)'}` : `${item.length} steps`;
      }
      case 'tapdance': {
        if (!used(view, item)) return 'unused';
        return [['tap', item[0]], ['hold', item[1]], ['double', item[2]], ['tap-hold', item[3]]].filter(([, c]) => !isNo(c)).map(([n, c]) => `${n} ${main(c)}`).join(', ');
      }
      case 'combos': {
        if (!used(view, item)) return 'unused';
        const keys = item.slice(0, 4).filter(c => !isNo(c)).map(main);
        return `${keys.join(' + ') || 'no keys'} \u2192 ${isNo(item[4]) ? 'nothing' : main(item[4])}`;
      }
      case 'overrides': return used(view, item) ? `${bit(item.options, 7) ? '' : '(off) '}${koSentence(item)}` : 'unused';
      case 'altrepeat': return used(view, item) ? `${bit(item.options, 3) ? '' : '(off) '}after ${main(item.keycode)}, alt repeat sends ${main(item.alt_keycode)}` : 'unused';
      default: return '';
    }
  }

  /* ---------- macros ---------- */
  const safeText = s => S.checkMacroText(s).length === 0;
  const STEP_NAMES = {text: 'Text', tap: 'Tap', down: 'Press', up: 'Release', delay: 'Delay'};

  function macroDetail(detail, actions, index) {
    const ui = A.store.ui;
    const preview = S.macroText(actions);
    const label = `macro M${index}`;
    const setActions = (next, what, focus) => S.commit({type: 'macro.set', index, actions: next}, `M${index}: ${what}`, {focus});
    detail.append(h('p', {class: 'macro-preview'},
      h('span', {class: 'field-label', text: 'Types on an Estonian computer: '}),
      h('span', {class: 'macro-output', text: actions.length ? (preview.text || '(nothing visible)') : '(empty)'}),
      !preview.complete && actions.length ? h('span', {class: 'hint', text: ' Approximate: some steps can\u2019t be shown as characters.'}) : null));
    if (actions.some(a => a[0] === 'text' && !safeText(a[1]))) {
      detail.append(h('p', {class: 'notice notice-warning', text: 'A text step holds characters Vial can\u2019t type reliably (non-ASCII or control characters). It is kept as imported. Replace it with key taps to type Estonian characters.'}));
    }
    const steps = h('ol', {class: 'steps'});
    actions.forEach((a, i) => {
      const kind = a[0];
      const move = (d) => { const next = actions.map(x => x.slice()); const [x] = next.splice(i, 1); next.splice(i + d, 0, x); setActions(next, `moved step ${i + 1} ${d < 0 ? 'up' : 'down'}`, `step:${i + d}:${d < 0 ? 'up' : 'down'}`); };
      const remove = () => { const next = actions.map(x => x.slice()); next.splice(i, 1); setActions(next, `removed step ${i + 1}`); };
      let editor;
      if (kind === 'text') {
        const id = A.dom.id('text');
        const unsafe = !safeText(a[1]);
        editor = h('div', {class: 'step-editor'},
          h('label', {class: 'visually-hidden', for: id, text: `Step ${i + 1} text`}),
          h('textarea', {id, class: 'input input-code', rows: 2, 'data-fid': `steptext:${i}`, spellcheck: 'false', 'aria-invalid': unsafe ? 'true' : undefined,
            on: {change: e => {
              const v = e.target.value;
              if (v === a[1]) return;
              const problems = S.checkMacroText(v);
              if (problems.length) { S.setMessage(A.text.unsafeText, 'alert'); e.target.value = a[1]; S.render(`steptext:${i}`); return; }
              const next = actions.map(x => x.slice()); next[i] = ['text', v]; setActions(next, `text of step ${i + 1}`, `steptext:${i}`);
            }}, value: a[1]}),
          h('p', {class: 'hint', text: `Types: ${S.macroText([a]).text || '(nothing visible)'}`}));
      } else if (kind === 'delay') {
        const id = A.dom.id('delay');
        editor = h('div', {class: 'step-editor step-inline'},
          h('label', {class: 'field-label', for: id, text: 'Wait (ms)'}),
          h('input', {id, class: 'input input-number', type: 'number', min: 0, max: 65535, step: 10, value: String(a[1]), 'data-fid': `stepdelay:${i}`,
            on: {change: e => {
              const v = Number(e.target.value);
              if (!Number.isInteger(v) || v < 0 || v > 65535) { S.setMessage('Enter a delay from 0 to 65535 milliseconds.', 'alert'); S.render(`stepdelay:${i}`); return; }
              const next = actions.map(x => x.slice()); next[i] = ['delay', v]; setActions(next, `delay of step ${i + 1}`, `stepdelay:${i}`);
            }}}));
      } else {
        const picking = ui.target && ui.target.type === 'macroKey' && ui.target.index === index && ui.target.step === i;
        editor = h('div', {class: 'step-editor'},
          h('ul', {class: 'chips-list'}, a.slice(1).map((code, j) => h('li', {class: 'key-chip'},
            h('span', {class: 'key-chip-main', text: main(code)}), h('code', {class: 'key-chip-code', text: String(code)}),
            a.length > 2 ? h('button', {type: 'button', class: 'icon-button', 'aria-label': `Remove ${main(code)} (${code}) from step ${i + 1}`, text: '\u00d7', 'data-fid': `chipdel:${i}:${j}`,
              on: {click: () => { const next = actions.map(x => x.slice()); next[i].splice(j + 1, 1); setActions(next, `removed ${code} from step ${i + 1}`, `addkey:${i}`); }}}) : null))),
          h('button', {type: 'button', class: ['button', 'button-small', picking && 'is-active'], 'aria-pressed': String(!!picking), 'data-fid': `addkey:${i}`,
            text: picking ? 'Adding keys: choose in the picker' : 'Add a plain key', on: {click: () => { ui.target = {type: 'macroKey', index, step: i}; S.render(`addkey:${i}`); }}}));
      }
      steps.append(h('li', {class: 'step'},
        h('span', {class: 'step-kind', text: STEP_NAMES[kind] || kind}),
        editor,
        h('div', {class: 'step-tools'},
          h('button', {type: 'button', class: 'icon-button', 'aria-label': `Move step ${i + 1} up`, text: '\u2191', disabled: i === 0, 'data-fid': `step:${i}:up`, on: {click: () => move(-1)}}),
          h('button', {type: 'button', class: 'icon-button', 'aria-label': `Move step ${i + 1} down`, text: '\u2193', disabled: i === actions.length - 1, 'data-fid': `step:${i}:down`, on: {click: () => move(1)}}),
          h('button', {type: 'button', class: 'icon-button', 'aria-label': `Delete step ${i + 1}`, text: '\u00d7', 'data-fid': `step:${i}:del`, on: {click: remove}}))));
    });
    if (actions.length) detail.append(steps);
    else detail.append(h('p', {class: 'hint', text: 'This macro is empty. Add steps below.'}));
    const newTarget = kind => ({type: 'macroKey', index, step: -1, kind});
    const pickingNew = ui.target && ui.target.type === 'macroKey' && ui.target.index === index && ui.target.step === -1;
    detail.append(h('div', {class: 'add-steps', role: 'group', 'aria-label': 'Add a step'},
      h('span', {class: 'field-label', text: 'Add:'}),
      [['tap', 'Character or key', 'Choose characters or keys in the picker; each is added as key taps.'], ['down', 'Key press', 'Choose the key to press and hold.'], ['up', 'Key release', 'Choose the key to release.']].map(([k, text, msg]) => h('button', {type: 'button', class: ['button', 'button-small', pickingNew && ui.target.kind === k && 'is-active'],
        'aria-pressed': String(!!(pickingNew && ui.target.kind === k)), 'data-fid': `newstep:${k}`, text, on: {click: () => { ui.target = newTarget(k); S.setMessage(msg, 'status'); S.render(`newstep:${k}`); }}})),
      h('button', {type: 'button', class: 'button button-small', text: 'Text', 'data-fid': 'newstep:text', on: {click: () => setActions(actions.concat([['text', '']]), 'added a text step', `steptext:${actions.length}`)}}),
      h('button', {type: 'button', class: 'button button-small', text: 'Delay', 'data-fid': 'newstep:delay', on: {click: () => setActions(actions.concat([['delay', 100]]), 'added a delay', `stepdelay:${actions.length}`)}})));
    detail.append(h('p', {class: 'hint', text: 'Text steps send plain ASCII through US key positions, so they type different characters on Estonian (~n types \u00f1 because ~ is a dead key). For Estonian characters use \u201cCharacter or key\u201d: it adds the exact key taps.'}));
    detail.append(h('p', {class: 'hint', text: 'The keyboard\u2019s macro memory size isn\u2019t stored in .vil files; Vial refuses macros that don\u2019t fit when you load the file.'}));
    const code = S.guard(() => S.format({k: 'macro', index}), 'M' + index);
    detail.append(h('h3', {class: 'sub-title', text: 'Used by'}), usedByList(usedBy(c => c === code)));
    return label;
  }

  /* ---------- tap dance ---------- */
  function tapDanceDetail(detail, item, index) {
    const slots = ['On tap', 'On hold', 'On double tap', 'On tap then hold'];
    detail.append(h('div', {class: 'wells'}, slots.map((caption, slot) => well({type: 'tapdance', index, slot}, caption, item[slot]))));
    const id = A.dom.id('term');
    detail.append(h('div', {class: 'field step-inline'},
      h('label', {class: 'field-label', for: id, text: 'Tapping term (ms)'}),
      h('input', {id, class: 'input input-number', type: 'number', min: 0, max: 65535, step: 5, value: String(item[4]), 'data-fid': 'td-term',
        on: {change: e => {
          const v = Number(e.target.value);
          if (!Number.isInteger(v) || v < 0 || v > 65535) { S.setMessage('Enter a tapping term from 0 to 65535 ms.', 'alert'); S.render('td-term'); return; }
          const next = item.slice(); next[4] = v;
          S.commit({type: 'tapDance.set', index, value: next}, `TD${index}: tapping term ${v} ms`, {focus: 'td-term'});
        }}})));
    const code = S.guard(() => S.format({k: 'tapdance', index}), `TD(${index})`);
    detail.append(h('h3', {class: 'sub-title', text: 'Used by'}), usedByList(usedBy(c => c === code)));
  }

  /* ---------- combos ---------- */
  function where(code) {
    const f = S.fields();
    for (let l = 0; l < f.layout.length; l++) for (let r = 0; r < f.layout[l].length; r++) for (let c = 0; c < f.layout[l][r].length; c++) {
      if (f.layout[l][r][c] === code) return `${S.layerName(l)}: ${S.keyName(r, c)}`;
    }
    return null;
  }
  function comboDetail(detail, item, index) {
    detail.append(h('p', {class: 'hint', text: 'Press the input keys together to send the output. Inputs match keycodes, wherever those keys are.'}));
    detail.append(h('div', {class: 'wells'},
      [0, 1, 2, 3].map(slot => well({type: 'combo', index, slot}, `Key ${slot + 1}`, item[slot])),
      well({type: 'combo', index, slot: 4}, 'Output', item[4])));
    const inputs = item.slice(0, 4).filter(c => !isNo(c));
    const notes = [];
    if (inputs.length && inputs.length < 2) notes.push('A combo needs at least two input keys.');
    if (inputs.length && isNo(item[4])) notes.push(`Combo ${index} does nothing: its output is empty.`);
    if (new Set(inputs).size !== inputs.length) notes.push('The same key is listed twice.');
    notes.forEach(n => detail.append(h('p', {class: 'notice notice-warning', text: n})));
    if (inputs.length) detail.append(h('h3', {class: 'sub-title', text: 'Where the inputs are'}),
      h('ul', {class: 'used-by'}, inputs.map(c => h('li', {text: `${main(c)} (${c}): ${where(c) || 'not on any layer'}`}))));
  }

  /* ---------- key overrides ---------- */
  function layersText(mask, n) {
    const on = [];
    for (let i = 0; i < n; i++) if (bit(mask, i)) on.push(i);
    if (on.length === n) return 'on all layers';
    if (!on.length) return 'on no layer';
    return 'on ' + on.map(i => S.layerName(i)).join(', ');
  }
  function koSentence(item) {
    const n = S.fields().layout.length;
    const mods = modsSummary(item.trigger_mods);
    return `${mods ? mods + ' + ' : ''}${main(item.trigger)} sends ${main(item.replacement)} ${layersText(item.layers, n)}`;
  }
  function overrideDetail(detail, item, index) {
    const n = S.fields().layout.length;
    const set = (patch, what, focus) => S.commit({type: 'keyOverride.set', index, value: Object.assign({}, item, patch)}, `Override ${index}: ${what}`, {focus});
    detail.append(h('p', {class: 'summary-sentence', text: used('overrides', item) ? koSentence(item) + (bit(item.options, 7) ? '.' : '. (Off)') : 'Not set up. Choose a trigger key and a replacement, then turn it on.'}));
    detail.append(h('label', {class: 'toggle toggle-strong'},
      h('input', {type: 'checkbox', checked: bit(item.options, 7), 'data-fid': 'ko-enabled', on: {change: e => set({options: setBit(item.options, 7, e.target.checked)}, e.target.checked ? 'on' : 'off', 'ko-enabled')}}),
      h('span', {text: 'Override is on'})));
    detail.append(h('div', {class: 'wells'}, well({type: 'override', index, field: 'trigger'}, 'Trigger key', item.trigger), well({type: 'override', index, field: 'replacement'}, 'Replacement', item.replacement)));
    detail.append(bitChecks('Trigger modifiers', item.trigger_mods, modLabels(), v => set({trigger_mods: v}, 'trigger modifiers', 'ko-trig'), 'ko-trig'));
    const layerBits = [];
    for (let i = 0; i < Math.min(n, 16); i++) layerBits.push([i, `${i} ${S.layerName(i)}`]);
    detail.append(bitChecks('Active on layers', item.layers, layerBits, v => set({layers: v}, 'layers', 'ko-layers'), 'ko-layers', false));
    const hiddenBits = Math.floor(item.layers / 2 ** n);
    if (n < 16 && hiddenBits) detail.append(h('p', {class: 'hint', text: `Layers ${n}\u201315 aren\u2019t in this file; their bits stay as in the file.`}));
    detail.append(bitChecks('Negative modifiers (block the override)', item.negative_mod_mask, modLabels(), v => set({negative_mod_mask: v}, 'negative modifiers', 'ko-neg'), 'ko-neg'));
    detail.append(bitChecks('Suppressed modifiers (released while it sends)', item.suppressed_mods, modLabels(), v => set({suppressed_mods: v}, 'suppressed modifiers', 'ko-sup'), 'ko-sup'));
    detail.append(bitChecks('Options', item.options, KO_OPTIONS, v => set({options: v}, 'options', 'ko-opt'), 'ko-opt'));
    detail.append(h('p', {class: 'hint', text: 'Modifier bits are shown in QMK order (left Ctrl, Shift, Alt, Super, then right). The stored bytes are shown so you can compare with Vial.'}));
  }

  /* ---------- alt repeat ---------- */
  function altRepeatDetail(detail, item, index) {
    const set = (patch, what, focus) => S.commit({type: 'altRepeat.set', index, value: Object.assign({}, item, patch)}, `Alt repeat ${index}: ${what}`, {focus});
    detail.append(h('p', {class: 'hint', text: 'After the last key, the Alt repeat key sends the alt key instead of repeating.'}));
    detail.append(h('label', {class: 'toggle toggle-strong'},
      h('input', {type: 'checkbox', checked: bit(item.options, 3), 'data-fid': 'ar-enabled', on: {change: e => set({options: setBit(item.options, 3, e.target.checked)}, e.target.checked ? 'on' : 'off', 'ar-enabled')}}),
      h('span', {text: 'Entry is on'})));
    detail.append(h('div', {class: 'wells'}, well({type: 'altrepeat', index, field: 'keycode'}, 'Last key', item.keycode), well({type: 'altrepeat', index, field: 'alt_keycode'}, 'Alt key', item.alt_keycode)));
    detail.append(bitChecks('Allowed modifiers', item.allowed_mods, modLabels(), v => set({allowed_mods: v}, 'allowed modifiers', 'ar-mods'), 'ar-mods'));
    detail.append(bitChecks('Options', item.options, AR_OPTIONS, v => set({options: v}, 'options', 'ar-opt'), 'ar-opt'));
  }

  const DETAILS = {macros: macroDetail, tapdance: tapDanceDetail, combos: comboDetail, overrides: overrideDetail, altrepeat: altRepeatDetail};
  function renderView(main0, view) { main0.append(frame(view, DETAILS[view])); }

  A.features = {renderView, count, used, SECTIONS, safeText, koSentence, isNo};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
