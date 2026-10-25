(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const {h, s} = A.dom;
  const S = A.state;
  const KEY_U = 0.92; // keycap side in geometry units (original 44/48)

  /* ---------- geometry ---------- */
  let extentCache = null;
  function extent() {
    if (extentCache) return extentCache;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const half = KEY_U / 2 + 0.1;
    for (const key of KS.board.keys) {
      const a = (key.angle || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      for (const [dx, dy] of [[-half, -half], [half, -half], [half, half], [-half, half]]) {
        const x = key.x + dx * c - dy * sn, y = key.y + dx * sn + dy * c;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    extentCache = {minX, maxX, minY: Math.min(minY, 0.2), maxY, w: maxX - minX, h: maxY - Math.min(minY, 0.2)};
    return extentCache;
  }

  function encoderSlots() {
    const list = (KS.board.encoders || []).slice().sort((a, b) => a.index - b.index);
    const left = list.filter(e => /left/i.test(e.label)), right = list.filter(e => !/left/i.test(e.label));
    const slots = [];
    left.forEach((e, i) => slots.push({enc: e, col: 0, row: i}));
    right.forEach((e, i) => slots.push({enc: e, col: 1, row: i}));
    return slots;
  }
  const shortEncoderLabel = label => {
    const t = String(label).replace(/\s*encoder\s*/i, ' ').replace(/^Halcyon\s+/i, '').replace(/\s+/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  /* Layout-option state for an encoder or module, by matching the definition labels. */
  function optionState(label) {
    const f = S.fields();
    if (typeof f.layout_options !== 'number') return null;
    const decoded = S.guard(() => KS.vil.layoutOptions.decode(f.layout_options, KS.board.layoutOptionLabels), null);
    if (!decoded) return null;
    const o = decoded.find(x => x.label === label);
    if (!o) return null;
    const on = o.kind === 'bool' ? o.value === 1 : (o.choices && /encoder/i.test(o.choices[o.value] || ''));
    return {on, text: o.kind === 'bool' ? (o.value ? 'on' : 'off') : (o.choices ? o.choices[o.value] : String(o.value))};
  }

  /* ---------- reached-by and pass-through text ---------- */
  const FN_TEXT = {MO: 'hold', TG: 'toggle', TO: 'switch with', OSL: 'one-shot', TT: 'hold or tap-toggle', DF: 'set default with', PDF: 'set persistent default with'};
  function reachedBy(layer) {
    const f = S.fields(), found = [];
    f.layout.forEach((rows, l) => rows.forEach((cells, r) => cells.forEach((code, c) => {
      if (typeof code !== 'string' || l === layer) return;
      const a = S.parse(code);
      if ((a.k === 'layer' || a.k === 'layertap' || a.k === 'layermod') && a.layer === layer) {
        const how = a.k === 'layer' ? (FN_TEXT[a.fn] || a.fn) : a.k === 'layertap' ? 'hold' : 'hold with modifiers';
        found.push(`${how} ${S.keyName(r, c)} (${S.layerName(l)})`);
      }
    })));
    if (layer === 0) return 'Active when no other layer is held.';
    if (!found.length) return 'No key on any layer switches to this layer.';
    const more = found.length > 2 ? ` and ${found.length - 2} more` : '';
    return `Reached with: ${found.slice(0, 2).join('; ')}${more}.`;
  }
  function hasTransparent(layer) {
    return layer > 0 && S.fields().layout[layer].some(row => row.some(c => c === 'KC_TRNS' || c === 'KC_TRANSPARENT'));
  }

  /* ---------- key models ---------- */
  /* Mod-tap and layer-tap legends describe the tap only; the tap key's Shift and AltGr outputs still apply. */
  function tapLegend(legend) {
    if (!legend || !legend.hold || typeof legend.code !== 'string') return null;
    const a = S.parse(legend.code);
    const tap = (a.k === 'modtap' || a.k === 'layertap') ? a.tap : null;
    return tap && tap.k === 'basic' ? S.legendFor(tap.id) : null;
  }
  function keyModel(layer, row, col, k, minPx) {
    const ws = S.ws();
    const legend = S.legendAt(layer, row, col);
    return A.keycap.model(legend, {
      k, minPx, layerHex: S.layerColor(layer), colorOf: S.layerColor, parse: S.parse, tapLegend: tapLegend(legend),
      label: ws.meta.keyLabels[`${layer}:${row}:${col}`] || null,
      inheritedName: legend.inherited ? S.layerName(Number.isInteger(legend.fromLayer) ? legend.fromLayer : 0) : null
    });
  }
  function encoderModel(layer, index, dir, k, minPx) {
    const legend = S.legendEncoder(layer, index, dir);
    return A.keycap.model(legend, {k, minPx, layerHex: S.layerColor(layer), colorOf: S.layerColor, parse: S.parse, tapLegend: tapLegend(legend),
      inheritedName: legend.inherited ? S.layerName(Number.isInteger(legend.fromLayer) ? legend.fromLayer : 0) : null});
  }

  const sameTarget = (a, b) => !!a && !!b && a.type === b.type && ['layer', 'row', 'col', 'index', 'dir'].every(p => a[p] === b[p]);

  /* ---------- selection and keyboard handling ---------- */
  function select(target, focusId) {
    A.store.ui.target = target;
    S.setMessage('', 'status');
    S.render(focusId);
  }

  function clearTarget(t) {
    const info = S.targetInfo(t);
    if (!info || info.readOnly) { if (info) S.setMessage(info.readOnly, 'alert'); S.render(); return; }
    S.writeTarget(t, 'KC_NO', `Cleared ${info.title}`);
  }

  function copyTarget(t) {
    const info = S.targetInfo(t);
    if (!info || typeof info.code !== 'string') return;
    A.store.clipboard = info.code;
    S.setMessage(`Copied ${info.code}. Select another key and press Ctrl+V to paste.`, 'status');
    S.render();
  }
  function pasteTarget(t) {
    const code = A.store.clipboard;
    const info = S.targetInfo(t);
    if (!code || !info) { S.setMessage('Nothing copied yet. Select a key and press Ctrl+C first.', 'status'); S.render(); return; }
    if (info.readOnly) { S.setMessage(info.readOnly, 'alert'); S.render(); return; }
    S.writeTarget(t, code, `Pasted ${code} to ${info.title}`);
  }

  /* Nearest key in the arrow direction. Column stagger makes neighbours tie, so keys
     in the same matrix row (left/right) or column (up/down) win ties. */
  function nearest(items, from, key) {
    const dir = {ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1]}[key];
    const ft = from.target;
    let best = null, bestScore = Infinity;
    for (const it of items) {
      if (it === from) continue;
      const dx = it.cx - from.cx, dy = it.cy - from.cy;
      const along = dx * dir[0] + dy * dir[1];
      if (along <= 0.2) continue;
      const across = Math.abs(dx * dir[1] - dy * dir[0]);
      const t = it.target;
      const sameLine = ft && t && ft.row !== undefined && (dir[0] ? t.row === ft.row : t.col === ft.col);
      const score = along + across * 2.2 + (sameLine ? 0 : 0.6);
      if (score < bestScore) { bestScore = score; best = it; }
    }
    return best;
  }

  function onKeyNav(e, items, current) {
    const t = current.target;
    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const next = nearest(items, current, e.key);
      if (next) { focusItem(items, next); }
      return;
    }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); focusItem(items, e.key === 'Home' ? items[0] : items[items.length - 1]); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t, current.fid); return; }
    if (e.key === 'Escape') { e.preventDefault(); select(null, current.fid); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); A.store.ui.target = t; clearTarget(t); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copyTarget(t); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); A.store.ui.target = t; pasteTarget(t); }
  }
  function focusItem(items, it) {
    for (const x of items) x.el.setAttribute('tabindex', x === it ? '0' : '-1');
    it.el.focus({preventScroll: false});
  }

  /* ---------- layer bar ---------- */
  function layerBar() {
    const ui = A.store.ui, ws = S.ws();
    const n = ws.doc.fields.layout.length;
    const tabs = [];
    for (let i = 0; i < n; i++) {
      const selected = i === ui.layer;
      const tab = h('button', {type: 'button', role: 'tab', class: 'layer-tab', 'aria-selected': String(selected), tabindex: selected ? '0' : '-1',
        'data-fid': `layer-tab:${i}`, style: {'--layer': S.layerColor(i)},
        on: {click: () => switchLayer(i, `layer-tab:${i}`), keydown: e => tabKeys(e, i, n)}},
      h('span', {class: 'layer-num', text: String(i)}), h('span', {class: 'layer-name', text: S.layerName(i)}));
      tabs.push(tab);
    }
    return h('div', {class: 'layer-bar'},
      h('div', {class: 'layer-tabs', role: 'tablist', 'aria-label': 'Layers'}, tabs),
      h('button', {type: 'button', class: 'button button-quiet', 'data-fid': 'layer-settings', text: 'Rename or recolour', on: {click: layerSettings}}));
  }
  function tabKeys(e, i, n) {
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % n;
    if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = n - 1;
    if (j !== null) { e.preventDefault(); switchLayer(j, `layer-tab:${j}`); }
  }
  function switchLayer(i, fid) {
    const ui = A.store.ui;
    const n = S.fields().layout.length;
    if (i < 0 || i >= n) return;
    ui.layer = i;
    if (ui.target && (ui.target.type === 'key' || ui.target.type === 'encoder')) ui.target = Object.assign({}, ui.target, {layer: i});
    S.persistUi();
    S.setMessage('', 'status');
    S.render(fid);
  }

  function layerSettings() {
    const ui = A.store.ui, layer = ui.layer;
    const {h: hh} = A.dom;
    const nameId = A.dom.id('layer-name'), colorId = A.dom.id('layer-color');
    const name = hh('input', {id: nameId, class: 'input', type: 'text', maxlength: 35, value: S.layerName(layer), autocomplete: 'off'});
    const color = hh('input', {id: colorId, class: 'input-color', type: 'color', value: S.layerColor(layer)});
    const palette = ['#70b7ff', '#4dd8cc', '#83d38a', '#ffbd68', '#ba9bff', '#ffe071', '#ff8f9c', '#9daabd'];
    const swatches = hh('div', {class: 'swatches', role: 'group', 'aria-label': 'Palette colours'},
      palette.map((c, i) => hh('button', {type: 'button', class: 'swatch', style: {'--swatch': c}, 'aria-label': `Palette colour ${i + 1} (${c})`,
        on: {click: () => { color.value = c; }}})));
    const body = [
      hh('p', {class: 'dialog-text', text: 'Names and colours appear on the board and in reference images. They stay in this browser and are not written to the .vil file.'}),
      hh('label', {class: 'field-label', for: nameId, text: 'Layer name'}), name,
      hh('label', {class: 'field-label', for: colorId, text: 'Layer colour'}), hh('div', {class: 'color-row'}, color, swatches)
    ];
    A.dom.choose({title: `Layer ${layer}`, body, actions: [{label: 'Cancel', value: null}, {label: 'Save', value: 'save', primary: true}]}).then(v => {
      if (v !== 'save') return;
      const ops = [];
      const newName = name.value.trim();
      if (newName !== S.layerName(layer)) ops.push({type: 'meta.layerName', layer, value: newName});
      if (color.value.toLowerCase() !== S.layerColor(layer).toLowerCase()) ops.push({type: 'meta.layerColor', layer, value: color.value});
      if (!ops.length) return;
      S.commit({type: 'batch', ops}, `Changed layer ${layer} name or colour`, {focus: 'layer-settings'});
    });
  }

  /* ---------- the board ---------- */
  function boardSvg(k) {
    const ui = A.store.ui, layer = ui.layer, ext = extent();
    const p = k / KEY_U;
    const W = Math.ceil(ext.w * p), H = Math.ceil(ext.h * p);
    const ox = -ext.minX * p, oy = -ext.minY * p;
    const svg = s('svg', {class: 'board', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group',
      'aria-label': `${S.layerName(layer)} layer keys. Arrow keys move between keys; Enter selects.`});
    const items = [];
    const f = S.fields();
    for (const key of KS.board.keys) {
      const code = f.layout[layer] && f.layout[layer][key.row] ? f.layout[layer][key.row][key.col] : -1;
      if (code === -1 || code === undefined) continue;
      const m = keyModel(layer, key.row, key.col, k, 12);
      const t = {type: 'key', layer, row: key.row, col: key.col};
      const fid = `key:${key.row}:${key.col}`;
      const selected = sameTarget(ui.target, t);
      const g = A.keycap.svg(m, {class: ['key', selected && 'is-selected'], role: 'button', tabindex: '-1', 'aria-pressed': String(selected),
        'aria-label': `${S.keyName(key.row, key.col)}: ${m.a11y}`, 'data-fid': fid, 'data-row': key.row, 'data-col': key.col,
        transform: `translate(${(ox + key.x * p).toFixed(2)} ${(oy + key.y * p).toFixed(2)}) rotate(${key.angle || 0})`});
      g.append(s('title', {}, `${S.keyName(key.row, key.col)} (matrix ${key.row}, ${key.col}): ${typeof code === 'string' ? code : code}`));
      svg.append(g);
      items.push({el: g, cx: key.x, cy: key.y, target: t, fid});
    }
    wireRoving(items, ui.target, 'key');

    // Encoder dials in the empty region between the halves.
    const encCount = Array.isArray(f.encoder_layout) && Array.isArray(f.encoder_layout[layer]) ? f.encoder_layout[layer].length : 0;
    if (encCount && !S.isRaw(f.encoder_layout)) {
      const km = Math.round(k * 0.8), gap = Math.round(k * 0.14);
      const colX = [7.25, 9.75], rowY = [0.3, 1.72];
      const encItems = [];
      for (const slot of encoderSlots()) {
        const idx = slot.enc.index;
        if (idx >= encCount || slot.row > 1) continue;
        const pair = f.encoder_layout[layer][idx];
        if (!Array.isArray(pair) || S.isRaw(pair)) continue;
        const cx = ox + colX[slot.col] * p, top = oy + rowY[slot.row] * p;
        const state = optionState(slot.enc.label);
        const caption = shortEncoderLabel(slot.enc.label) + (state && !state.on ? ' (off)' : '');
        const dial = s('g', {class: 'dial', 'aria-hidden': 'false'});
        dial.append(s('text', {x: cx.toFixed(1), y: (top + 13).toFixed(1), class: 'dial-label', 'text-anchor': 'middle'}, caption));
        if (state && !state.on) dial.append(s('title', {}, `${slot.enc.label}: off in layout options. The mapping is still kept in the file.`));
        [1, 0].forEach((dir, i) => {
          const mx = cx + (i === 0 ? -(gap / 2 + km / 2) : (gap / 2 + km / 2)), my = top + 22 + km / 2;
          const m = encoderModel(layer, idx, dir, km, 12);
          const t = {type: 'encoder', layer, index: idx, dir};
          const fid = `enc:${idx}:${dir}`;
          const selected = sameTarget(ui.target, t);
          const name = `${slot.enc.label}, ${dir === 0 ? 'clockwise' : 'counter-clockwise'}`;
          const g = A.keycap.svg(m, {class: ['key', 'key-mini', selected && 'is-selected'], role: 'button', tabindex: '-1', 'aria-pressed': String(selected),
            'aria-label': `${name}: ${m.a11y}${state && !state.on ? '. Off in layout options' : ''}`, 'data-fid': fid,
            transform: `translate(${mx.toFixed(2)} ${my.toFixed(2)})`});
          g.append(s('title', {}, name));
          dial.append(g);
          dial.append(s('text', {x: mx.toFixed(1), y: (my + km / 2 + 15).toFixed(1), class: 'dial-arrow', 'text-anchor': 'middle', 'aria-hidden': 'true'}, dir === 0 ? '\u21bb CW' : '\u21ba CCW'));
          encItems.push({el: g, cx: mx / p, cy: my / p, target: t, fid});
        });
        svg.append(dial);
      }
      wireRoving(encItems, ui.target, 'encoder');
    }
    return svg;
  }

  function wireRoving(items, target, type) {
    if (!items.length) return;
    const current = items.find(it => sameTarget(target, it.target)) || items[0];
    current.el.setAttribute('tabindex', '0');
    for (const it of items) {
      it.el.addEventListener('click', () => select(it.target, it.fid));
      it.el.addEventListener('keydown', e => onKeyNav(e, items, it));
      it.el.addEventListener('focus', () => { for (const x of items) x.el.setAttribute('tabindex', x === it ? '0' : '-1'); });
    }
    return type;
  }

  function moduleStrip(k) {
    const ui = A.store.ui, layer = ui.layer, f = S.fields();
    const cells = (KS.board.moduleCells || []).filter(c => f.layout[layer] && f.layout[layer][c.row] && f.layout[layer][c.row][c.col] !== -1);
    if (!cells.length) return null;
    const km = Math.round(k * 0.8), gap = Math.round(k * 0.12);
    const groups = ['left', 'right'].map(side => {
      const list = cells.filter(c => c.side === side);
      if (!list.length) return null;
      const label = side === 'left' ? 'Halcyon module left' : 'Halcyon module right';
      const state = optionState(label);
      const W = list.length * km + (list.length - 1) * gap + 12, H = km + 12;
      const svg = s('svg', {class: 'module-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': `${label} buttons`});
      const items = [];
      list.forEach((c, i) => {
        const x = 6 + km / 2 + i * (km + gap), y = 6 + km / 2;
        const m = keyModel(layer, c.row, c.col, km, 12);
        const t = {type: 'key', layer, row: c.row, col: c.col};
        const fid = `key:${c.row}:${c.col}`;
        const selected = sameTarget(ui.target, t);
        const g = A.keycap.svg(m, {class: ['key', 'key-mini', selected && 'is-selected'], role: 'button', tabindex: '-1', 'aria-pressed': String(selected),
          'aria-label': `${S.keyName(c.row, c.col)} (matrix ${c.row}, ${c.col}): ${m.a11y}`, 'data-fid': fid, transform: `translate(${x} ${y})`});
        g.append(s('title', {}, `Matrix ${c.row}, ${c.col}`));
        svg.append(g);
        items.push({el: g, cx: x / km, cy: 0, target: t, fid});
      });
      wireRoving(items, ui.target, 'module');
      return h('div', {class: 'module-group'},
        h('p', {class: 'module-title'}, h('strong', {text: side === 'left' ? 'Left module' : 'Right module'}),
          state ? ` (layout options: ${state.text})` : ''),
        svg);
    }).filter(Boolean);
    return h('section', {class: 'modules', 'aria-labelledby': 'modules-title'},
      h('h2', {id: 'modules-title', class: 'section-title', text: 'Module buttons'}),
      h('p', {class: 'hint', text: 'These matrix positions are in the file but have no drawn position on the board. Whether they exist depends on the module fitted.'}),
      h('div', {class: 'module-row'}, groups));
  }

  function computeK(width) {
    const ext = extent();
    return Math.max(60, Math.min(84, Math.floor(width / ext.w * KEY_U)));
  }

  function renderView(main) {
    const ui = A.store.ui;
    const n = S.fields().layout.length;
    if (ui.layer >= n) ui.layer = 0;
    main.append(h('h1', {class: 'visually-hidden', text: 'Keymap'}));
    main.append(layerBar());
    const meta = h('p', {class: 'layer-meta'},
      h('span', {class: 'layer-swatch', style: {'--layer': S.layerColor(ui.layer)}, 'aria-hidden': 'true'}),
      h('span', {text: reachedBy(ui.layer)}),
      hasTransparent(ui.layer) ? h('span', {class: 'layer-meta-note', text: `Dashed keys pass through to ${S.layerName(0)}.`}) : null);
    main.append(meta);
    const frame = h('div', {class: 'board-frame'});
    main.append(frame);
    const k = computeK(Math.max(0, frame.clientWidth - 8));
    frame.append(boardSvg(k));
    const mods = moduleStrip(k);
    if (mods) main.append(mods);
    main.append(A.dock());
  }

  A.board = {renderView, computeK, extent, KEY_U, keyModel, tapLegend, encoderModel, encoderSlots, shortEncoderLabel, optionState, reachedBy, select, sameTarget, clearTarget, copyTarget, pasteTarget, switchLayer};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
