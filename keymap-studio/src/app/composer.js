/*
 * Action composer (UI-4 secondary): mod wraps, mod-tap and layer-tap holds, layer
 * functions, one-shot modifiers, macros, tap dances and raw entry with live check.
 * It edits whatever the current target is: a key, encoder direction or editor slot.
 */
(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const {h} = A.dom;
  const S = A.state;

  const MOD_KEYS = [['ctrl', 'Ctrl'], ['shift', 'Shift'], ['alt', 'Alt'], ['gui', 'Super']];
  const KINDS = [
    {id: 'key', label: 'Types a key'}, {id: 'layer', label: 'Layer'}, {id: 'osm', label: 'One-shot modifier'},
    {id: 'macro', label: 'Macro'}, {id: 'td', label: 'Tap dance'}, {id: 'trans', label: 'Pass through'}, {id: 'none', label: 'Nothing'}
  ];
  const LAYER_FNS = [['MO', 'Hold'], ['TG', 'Toggle'], ['TO', 'Switch to'], ['OSL', 'Next key only'], ['TT', 'Hold or tap-toggle'], ['DF', 'Set default'], ['PDF', 'Set persistent default'], ['LM', 'Hold with modifiers']];

  const noMods = () => ({ctrl: false, shift: false, alt: false, gui: false, right: false});
  const anyMod = m => !!m && (m.ctrl || m.shift || m.alt || m.gui);
  function kindOf(a) {
    switch (a.k) {
      case 'basic': case 'named': case 'mods': case 'modtap': case 'layertap': return 'key';
      case 'layer': case 'layermod': return 'layer';
      case 'osm': return 'osm';
      case 'macro': return 'macro';
      case 'tapdance': return 'td';
      case 'trans': return 'trans';
      case 'none': return 'none';
      default: return 'raw';
    }
  }
  function modsText(m) {
    if (!anyMod(m)) return 'none';
    const names = [];
    if (m.ctrl) names.push('Ctrl');
    if (m.shift) names.push('Shift');
    if (m.alt) names.push(m.right && !m.ctrl && !m.shift && !m.gui ? 'AltGr' : 'Alt');
    if (m.gui) names.push('Super');
    return (m.right ? 'right ' : '') + names.join(' + ');
  }

  function write(action, label) {
    const t = A.store.ui.target;
    let code;
    try { code = S.format(action); } catch (e) { S.report(e, label); S.render(); return false; }
    return S.writeTarget(t, code, label);
  }

  function modsFieldset(legendText, mods, onChange, disabledReason, fidPrefix) {
    const name = A.dom.id('side');
    const disabled = !!disabledReason;
    return h('fieldset', {class: 'mods', disabled},
      h('legend', {class: 'field-label', text: legendText}),
      h('div', {class: 'mod-toggles'}, MOD_KEYS.map(([k, label]) => h('label', {class: 'toggle'},
        h('input', {type: 'checkbox', checked: !!mods[k], 'data-fid': `${fidPrefix}:${k}`,
          on: {change: e => onChange(Object.assign({}, mods, {[k]: e.target.checked}), `${fidPrefix}:${k}`)}}),
        h('span', {text: label})))),
      h('div', {class: 'mod-side'},
        h('label', {class: 'toggle'}, h('input', {type: 'radio', name, checked: !mods.right, 'data-fid': `${fidPrefix}:left`,
          on: {change: () => onChange(Object.assign({}, mods, {right: false}), `${fidPrefix}:left`)}}), h('span', {text: 'Left-hand'})),
        h('label', {class: 'toggle'}, h('input', {type: 'radio', name, checked: !!mods.right, 'data-fid': `${fidPrefix}:right`,
          on: {change: () => onChange(Object.assign({}, mods, {right: true}), `${fidPrefix}:right`)}}), h('span', {text: 'Right-hand (right Alt is AltGr)'}))),
      disabledReason ? h('p', {class: 'hint', text: disabledReason}) : null);
  }

  function layerSelect(value, onChange, fid) {
    const id = A.dom.id('layer-select');
    return [h('label', {class: 'field-label', for: id, text: 'Layer'}),
      h('select', {id, class: 'input', 'data-fid': fid, on: {change: e => onChange(Number(e.target.value))}},
        S.fields().layout.map((_, i) => h('option', {value: String(i), selected: i === value, text: `${i} ${S.layerName(i)}`})))];
  }

  function keySection(a, label) {
    const tap = a.k === 'mods' ? a.inner : (a.k === 'modtap' || a.k === 'layertap') ? a.tap : a;
    const wrap = a.k === 'mods' ? a.mods : noMods();
    const hold = a.k === 'modtap' ? 'mod' : a.k === 'layertap' ? 'layer' : 'none';
    const tapLegend = S.legendFor(S.guard(() => S.format(tap), null, false) || '');
    const tapIsBasic = tap && tap.k === 'basic';
    const holdName = A.dom.id('hold');
    const parts = [
      h('div', {class: 'tap-row'},
        h('span', {class: 'field-label', text: 'Tap'}),
        h('span', {class: 'tap-value', text: tapLegend.main || (tap && tap.k === 'none' ? 'nothing' : '?')}),
        h('span', {class: 'hint', text: 'Change it in the picker.'})),
      modsFieldset('Hold these modifiers while it is tapped', wrap, m => {
        const next = anyMod(m) ? {k: 'mods', mods: m, inner: tap} : tap;
        write(next, `${label}: tap modifiers ${modsText(m)}`);
      }, hold !== 'none' ? 'Remove the hold action first: a key can\u2019t have both.' : null, 'wrap'),
      h('fieldset', {class: 'hold', disabled: !tapIsBasic || anyMod(wrap)},
        h('legend', {class: 'field-label', text: 'When held'}),
        h('div', {class: 'mod-side'}, [['none', 'Nothing'], ['mod', 'Modifier'], ['layer', 'Layer']].map(([v, text]) => h('label', {class: 'toggle'},
          h('input', {type: 'radio', name: holdName, checked: hold === v, 'data-fid': `hold:${v}`, on: {change: () => {
            if (v === 'none') write(tap, `${label}: no hold action`);
            if (v === 'mod') write({k: 'modtap', mods: Object.assign(noMods(), {shift: true}), tap}, `${label}: hold for Shift`);
            if (v === 'layer') write({k: 'layertap', layer: firstOtherLayer(), tap}, `${label}: hold for a layer`);
          }}}), h('span', {text})))),
        hold === 'mod' ? modsFieldset('Modifier while held', a.mods, m => {
          if (!anyMod(m)) { write(tap, `${label}: no hold action`); return; }
          write({k: 'modtap', mods: m, tap}, `${label}: hold for ${modsText(m)}`);
        }, null, 'holdmods') : null,
        hold === 'layer' ? h('div', {class: 'field'}, layerSelect(a.layer, l => write({k: 'layertap', layer: l, tap}, `${label}: hold for layer ${l} ${S.layerName(l)}`), 'hold-layer')) : null,
        !tapIsBasic ? h('p', {class: 'hint', text: 'Hold actions need a plain key as the tap, such as a letter or Enter. Shifted and AltGr characters can\u2019t have one.'})
          : anyMod(wrap) ? h('p', {class: 'hint', text: 'Clear the tap modifiers first to add a hold action.'}) : null)
    ];
    return parts;
  }

  function firstOtherLayer() {
    const n = S.fields().layout.length, cur = A.store.ui.layer;
    return n > 1 ? (cur === 1 ? 2 % n : 1) : 0;
  }

  function layerSection(a, label) {
    const fn = a.k === 'layermod' ? 'LM' : a.fn;
    const fnId = A.dom.id('fn');
    const make = (nextFn, layer, mods) => nextFn === 'LM' ? {k: 'layermod', layer, mods: anyMod(mods) ? mods : Object.assign(noMods(), {ctrl: true})} : {k: 'layer', fn: nextFn, layer};
    return [
      h('div', {class: 'field'}, layerSelect(a.layer, l => write(make(fn, l, a.mods), `${label}: layer ${l} ${S.layerName(l)}`), 'layer-target')),
      h('div', {class: 'field'},
        h('label', {class: 'field-label', for: fnId, text: 'How'}),
        h('select', {id: fnId, class: 'input', 'data-fid': 'layer-fn', on: {change: e => write(make(e.target.value, a.layer, a.mods), `${label}: ${LAYER_FNS.find(x => x[0] === e.target.value)[1].toLowerCase()} layer ${a.layer}`)}},
          LAYER_FNS.map(([v, text]) => h('option', {value: v, selected: v === fn, text})))),
      fn === 'LM' ? modsFieldset('Modifiers held with the layer', a.mods || noMods(), m => write(make('LM', a.layer, m), `${label}: layer ${a.layer} with ${modsText(m)}`), null, 'lm') : null
    ];
  }

  function indexSection(kind, a, label) {
    const f = S.fields();
    const list = kind === 'macro' ? f.macro : f.tap_dance;
    const id = A.dom.id('idx');
    if (!Array.isArray(list) || !list.length) return [h('p', {class: 'hint', text: kind === 'macro' ? 'This file has no macros.' : 'This file has no tap dances.'})];
    const summary = i => {
      if (S.isRaw(list[i])) return 'kept as is';
      if (kind === 'macro') return list[i].length ? `types ${S.macroText(list[i]).text || '\u2026'}` : 'empty';
      const lg = S.legendFor(S.guard(() => S.format({k: 'tapdance', index: i}), `TD(${i})`));
      return lg.detail || lg.main || '';
    };
    return [h('div', {class: 'field'},
      h('label', {class: 'field-label', for: id, text: kind === 'macro' ? 'Macro' : 'Tap dance'}),
      h('select', {id, class: 'input', 'data-fid': `${kind}-index`, on: {change: e => write({k: kind === 'macro' ? 'macro' : 'tapdance', index: Number(e.target.value)}, `${label}: ${kind === 'macro' ? 'macro M' : 'tap dance TD'}${e.target.value}`)}},
        list.map((_, i) => h('option', {value: String(i), selected: i === a.index, text: `${kind === 'macro' ? 'M' : 'TD'}${i}: ${summary(i)}`})))),
    h('button', {type: 'button', class: 'button button-quiet', text: kind === 'macro' ? `Edit macro M${a.index}` : `Edit tap dance TD${a.index}`,
      on: {click: () => { A.store.ui.index[kind === 'macro' ? 'macros' : 'tapdance'] = a.index; A.shell.go(kind === 'macro' ? 'macros' : 'tapdance'); }}})];
  }

  function switchKind(kind, current, label) {
    const f = S.fields();
    switch (kind) {
      case 'key': A.store.ui.composerHint = true; S.setMessage('Pick a character or key in the picker.', 'status'); S.render('kind:key'); return;
      case 'layer': write({k: 'layer', fn: 'MO', layer: firstOtherLayer()}, `${label}: hold a layer`); return;
      case 'osm': write({k: 'osm', mods: Object.assign(noMods(), {shift: true})}, `${label}: one-shot Shift`); return;
      case 'macro':
        if (!Array.isArray(f.macro) || !f.macro.length) { S.setMessage('This file has no macros to assign.', 'alert'); S.render('kind:macro'); return; }
        write({k: 'macro', index: 0}, `${label}: macro M0`); return;
      case 'td':
        if (!Array.isArray(f.tap_dance) || !f.tap_dance.length) { S.setMessage('This file has no tap dances to assign.', 'alert'); S.render('kind:td'); return; }
        write({k: 'tapdance', index: 0}, `${label}: tap dance TD0`); return;
      case 'trans': write({k: 'trans'}, `${label}: passes through to the layer below`); return;
      case 'none': write({k: 'none'}, `${label}: does nothing`); return;
      default: return current;
    }
  }

  function rawEntry(info, label) {
    const id = A.dom.id('raw'), msgId = A.dom.id('raw-msg');
    const f = S.fields();
    const ctx = {layers: f.layout.length, macros: Array.isArray(f.macro) ? f.macro.length : 0, tapDances: Array.isArray(f.tap_dance) ? f.tap_dance.length : 0};
    const msg = h('p', {id: msgId, class: 'hint', 'aria-live': 'polite'});
    const input = h('input', {id, class: 'input input-code', type: 'text', value: typeof info.code === 'string' ? info.code : '', spellcheck: 'false', autocomplete: 'off',
      'aria-describedby': msgId, 'data-fid': 'raw-code', maxlength: 200});
    const check = () => {
      const text = input.value.trim();
      if (!text) { msg.textContent = 'Enter a Vial keycode such as KC_A, MO(2) or LSFT_T(KC_A).'; input.removeAttribute('aria-invalid'); return false; }
      if (text === info.code) { msg.textContent = 'This is the current keycode.'; input.removeAttribute('aria-invalid'); return true; }
      const issues = S.guard(() => KS.keycodes.check(text, ctx), [{severity: 'error', message: 'Keycode checking is unavailable.'}]);
      const err = issues.find(i => i.severity === 'error');
      if (err) { msg.textContent = err.message; input.setAttribute('aria-invalid', 'true'); return false; }
      input.removeAttribute('aria-invalid');
      const lg = S.legendFor(text);
      msg.textContent = `Valid. ${lg.a11y || lg.main || ''}`.trim();
      return true;
    };
    input.addEventListener('input', check);
    const apply = () => { if (!check()) { input.focus(); return; } const text = input.value.trim(); if (text !== info.code) S.writeTarget(A.store.ui.target, text, `${label}: keycode ${text}`); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    return h('div', {class: 'raw-entry'},
      h('label', {class: 'field-label', for: id, text: 'Vial keycode'}),
      h('div', {class: 'input-row'}, input, h('button', {type: 'button', class: 'button', text: 'Apply', 'data-fid': 'raw-apply', on: {click: apply}})),
      msg);
  }

  function labelEntry(t) {
    if (t.type !== 'key') return null;
    const id = A.dom.id('label');
    const k = `${t.layer}:${t.row}:${t.col}`;
    const current = S.ws().meta.keyLabels[k] || '';
    return h('div', {class: 'field'},
      h('label', {class: 'field-label', for: id, text: 'Own label on board and image'}),
      h('input', {id, class: 'input', type: 'text', maxlength: 24, value: current, 'data-fid': 'key-label', placeholder: 'Automatic',
        on: {change: e => {
          const v = e.target.value.trim();
          if (v === current) return;
          S.commit({type: 'meta.keyLabel', layer: t.layer, row: t.row, col: t.col, value: v || null}, v ? `Label for ${S.keyName(t.row, t.col)} set to ${v}` : `Automatic label for ${S.keyName(t.row, t.col)}`, {focus: 'key-label'});
        }}}),
      h('p', {class: 'hint', text: 'Replaces the automatic legend only. Kept in this browser, not in the .vil file.'}));
  }

  function render() {
    const ui = A.store.ui, t = ui.target;
    const info = S.targetInfo(t);
    const wrap = h('section', {class: 'composer panel', 'aria-labelledby': 'composer-title'});
    if (!info) {
      wrap.append(h('h2', {id: 'composer-title', class: 'section-title', text: 'Nothing selected'}),
        h('p', {class: 'hint', text: 'Select a key on the board, an encoder direction or a slot in an editor. Then pick the character it should type, or build an action here.'}),
        h('ul', {class: 'tips'},
          h('li', {text: 'Arrow keys move between keys; Enter selects.'}),
          h('li', {text: 'Delete clears a key; Ctrl+C and Ctrl+V copy and paste keys.'}),
          h('li', {text: 'Ctrl+Z undoes, Ctrl+Shift+Z redoes.'})));
      return wrap;
    }
    const label = info.title;
    const legend = typeof info.code === 'string' ? S.legendFor(info.code) : null;
    wrap.append(h('div', {class: 'composer-head'},
      h('h2', {id: 'composer-title', class: 'section-title', text: info.title}),
      info.sub ? h('span', {class: 'hint', text: info.sub}) : null,
      h('button', {type: 'button', class: 'button button-quiet button-small', text: 'Done', 'data-fid': 'composer-done', on: {click: () => { ui.target = null; S.render(); }}})));
    if (info.readOnly) { wrap.append(h('p', {class: 'notice', text: info.readOnly})); return wrap; }
    if (info.append) { wrap.append(h('p', {class: 'hint', text: 'Pick a character or key in the picker; it is added to the end of this step.'})); return wrap; }
    if (legend) wrap.append(h('p', {class: ['current', legend.unknown && 'is-unknown']},
      h('span', {class: 'current-label', text: 'Now: '}), legend.a11y || legend.main || 'nothing',
      legend.unknown ? h('span', {class: 'unknown-note', text: ' Vial loads this unknown keycode as KC_NO.'}) : null));
    const a = S.parse(info.code);
    const kind = ui.composerHint ? 'key' : kindOf(a);
    ui.composerHint = false;
    const kindName = A.dom.id('kind');
    wrap.append(h('fieldset', {class: 'kinds'},
      h('legend', {class: 'field-label', text: 'What it does'}),
      h('div', {class: 'kind-options'}, KINDS.filter(k => k.id !== 'trans' || t.type === 'key' || t.type === 'encoder').map(k => h('label', {class: 'toggle'},
        h('input', {type: 'radio', name: kindName, checked: kind === k.id, 'data-fid': `kind:${k.id}`, on: {change: () => switchKind(k.id, a, label)}}),
        h('span', {text: k.label}))))));
    if (kind === 'key' && ['basic', 'named', 'mods', 'modtap', 'layertap'].includes(a.k)) wrap.append(...keySection(a, label));
    else if (kind === 'key') wrap.append(h('p', {class: 'hint hint-strong', text: 'Pick a character or key in the picker.'}));
    if (kind === 'layer') wrap.append(...layerSection(a, label));
    if (kind === 'osm') wrap.append(modsFieldset('One-shot modifiers (apply to the next key only)', a.mods || noMods(), m => {
      if (!anyMod(m)) { S.setMessage('A one-shot modifier needs at least one modifier.', 'alert'); S.render(); return; }
      write({k: 'osm', mods: m}, `${label}: one-shot ${modsText(m)}`);
    }, null, 'osm'));
    if (kind === 'macro' || kind === 'td') wrap.append(...indexSection(kind, a, label));
    if (kind === 'raw') wrap.append(h('p', {class: 'notice', text: 'The studio can\u2019t break this keycode into parts. Edit it as text below.'}));
    wrap.append(rawEntry(info, label));
    const le = labelEntry(t);
    if (le) wrap.append(le);
    return wrap;
  }

  A.composer = {render, kindOf, modsText};
  A.dock = () => h('div', {class: 'dock'}, render(), A.picker.render());
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
