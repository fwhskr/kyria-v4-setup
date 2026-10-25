/*
 * Learning reference image (UI-6, QA-5). Canvas 2D drawn from the legend model.
 * The image always holds every layer of the file, layers that do nothing included,
 * whatever layer is on screen: two columns of layer panels. A file with a single layer
 * gets 1920 x 1080 at 1x. Key text is never smaller than 0.20 of the key.
 */
(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const {h} = A.dom;
  const S = A.state;
  const KEY_U = 0.92;

  function imageLayers() {
    return Array.from({length: S.fields().layout.length}, (_, l) => l);
  }

  /* ---------- text helpers ---------- */
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/), lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width <= maxW || !line) line = test;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines;
  }
  function textBlock(ctx, text, x, y, maxW, size, weight, color, family, lineH, log, k) {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const lines = wrap(ctx, text, maxW);
    lines.forEach((l, i) => { ctx.fillText(l, x, y + i * lineH); if (log) log.push({text: l, size, k: k || null, role: 'note'}); });
    return lines.length * lineH;
  }
  function measureBlock(ctx, text, maxW, size, weight, family, lineH) {
    ctx.font = `${weight} ${size}px ${family}`;
    return wrap(ctx, text, maxW).length * lineH;
  }

  /* ---------- per-layer content ---------- */
  function layerNotes(l, withHidden) {
    const f = S.fields(), notes = [], seen = new Set();
    if (withHidden && hiddenParts()) notes.push('Encoders or module buttons that this file\u2019s layout options mark as not fitted are not shown.');
    f.layout[l].forEach((row, r) => row.forEach((code, c) => {
      if (typeof code !== 'string') return;
      const a = S.parse(code);
      if (a.k === 'macro' && !seen.has('M' + a.index) && Array.isArray(f.macro) && f.macro[a.index] && !S.isRaw(f.macro[a.index])) {
        seen.add('M' + a.index);
        const t = S.macroText(f.macro[a.index]);
        notes.push(`M${a.index} types ${t.text || '(nothing visible)'}${t.complete ? '' : ' (approximate)'}.`);
      }
      if (a.k === 'tapdance' && !seen.has('TD' + a.index)) {
        seen.add('TD' + a.index);
        const lg = S.legendFor(code);
        notes.push(`TD${a.index}: ${lg.detail || lg.a11y || code}.`);
      }
      const lg = S.legendAt(l, r, c);
      if (lg.unknown && !lg.inherited) notes.push(`${S.keyName(r, c)} has keycode ${code}, which Vial doesn\u2019t know; it loads it as KC_NO.`);
    }));
    return notes;
  }
  /* Encoders and module buttons the file's layout options mark as not fitted are left
     out of the image (they stay editable in the studio). Unknown option state shows them. */
  const fitted = label => { const st = A.board.optionState(label); return !st || st.on || (st.text && !/^none$/i.test(st.text) && st.text !== 'off'); };
  function hiddenParts() {
    const enc = (KS.board.encoders || []).some(e => !fitted(e.label));
    const mod = ['Halcyon module left', 'Halcyon module right'].some(l => !fitted(l));
    return enc || mod;
  }
  function moduleCells(l) {
    const f = S.fields();
    return (KS.board.moduleCells || []).filter(c => {
      if (!fitted(c.side === 'left' ? 'Halcyon module left' : 'Halcyon module right')) return false;
      const code = f.layout[l][c.row] && f.layout[l][c.row][c.col];
      if (code === -1 || code === undefined) return false;
      return S.legendAt(l, c.row, c.col).kind !== 'none';
    });
  }
  function encoderList(l) {
    const f = S.fields();
    if (!Array.isArray(f.encoder_layout) || S.isRaw(f.encoder_layout) || !Array.isArray(f.encoder_layout[l])) return [];
    return A.board.encoderSlots().filter(slot => {
      if (!fitted(slot.enc.label)) return false;
      const pair = f.encoder_layout[l][slot.enc.index];
      if (!Array.isArray(pair) || slot.row > 1) return false;
      return [0, 1].some(d => S.legendEncoder(l, slot.enc.index, d).kind !== 'none');
    });
  }

  /* Draw one layer's board (keys, encoder dials, module buttons) at keycap size k.
     Returns the height used. */
  function drawBoard(ctx, l, x0, y0, k, log, dry) {
    const ext = A.board.extent(), p = k / KEY_U, t = A.keycap.tokens();
    const ox = x0 - ext.minX * p, oy = y0 - ext.minY * p;
    const f = S.fields();
    if (!dry) for (const key of KS.board.keys) {
      const code = f.layout[l][key.row][key.col];
      if (code === -1 || code === undefined) continue;
      const m = A.board.keyModel(l, key.row, key.col, k, 0);
      A.keycap.draw(ctx, m, ox + key.x * p, oy + key.y * p, key.angle || 0, log);
    }
    let height = ext.h * p;
    const encs = encoderList(l);
    if (encs.length && !dry) {
      const km = k * 0.8, gap = k * 0.14, colX = [7.25, 9.75], rowY = [0.3, 1.72];
      const cap = Math.ceil(k * 0.2);
      for (const slot of encs) {
        const cx = ox + colX[slot.col] * p, top = oy + rowY[slot.row] * p;
        ctx.font = `600 ${cap}px ${t.fontUi}`; ctx.fillStyle = t.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        const caption = A.board.shortEncoderLabel(slot.enc.label);
        ctx.fillText(caption, cx, top + cap);
        if (log) log.push({text: caption, size: cap, k, role: 'dial'});
        [1, 0].forEach((dir, i) => {
          const mx = cx + (i === 0 ? -(gap / 2 + km / 2) : (gap / 2 + km / 2)), my = top + cap * 1.4 + km / 2;
          const m = A.board.encoderModel(l, slot.enc.index, dir, km, k * 0.2);
          A.keycap.draw(ctx, m, mx, my, 0, log);
          ctx.font = `600 ${cap}px ${t.fontUi}`; ctx.fillStyle = t.muted; ctx.textAlign = 'center';
          const arrow = dir === 0 ? '\u21bb CW' : '\u21ba CCW';
          ctx.fillText(arrow, mx, my + km / 2 + cap * 1.1);
          if (log) log.push({text: arrow, size: cap, k, role: 'dial'});
        });
      }
    }
    const mods = moduleCells(l);
    if (mods.length) {
      const km = k * 0.8, gap = k * 0.12, cap = Math.ceil(k * 0.2);
      const rowTop = oy + ext.h * p + k * 0.2;
      if (!dry) {
        ctx.font = `700 ${cap}px ${t.fontUi}`; ctx.fillStyle = t.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        const title = 'Module buttons (no drawn position)';
        ctx.fillText(title, x0, rowTop + cap);
        if (log) log.push({text: title, size: cap, k, role: 'dial'});
        ['left', 'right'].forEach(side => {
          const list = mods.filter(c => c.side === side);
          const span = list.length * km + (list.length - 1) * gap;
          const startX = side === 'left' ? x0 + km / 2 : x0 + ext.w * p - span + km / 2;
          list.forEach((c, i) => {
            const m = A.board.keyModel(l, c.row, c.col, km, k * 0.2);
            A.keycap.draw(ctx, m, startX + i * (km + gap), rowTop + cap * 1.5 + km / 2, 0, log);
          });
        });
      }
      height += k * 0.2 + cap * 1.5 + km;
    }
    return height;
  }

  function samples(l) {
    const list = [
      {code: 'KC_2', caption: 'Shift top left, AltGr top right. Letters: Shift types the capital.'},
      {code: 'LSFT_T(KC_A)', caption: 'Bottom band: what it does when held.'},
      {code: 'KC_E', inherited: true, caption: `Dashed: passes through to ${S.layerName(0)}.`},
      {code: 'KC_GRAVE', caption: 'Dotted circle: dead key, adds an accent to the next letter.'}
    ];
    const f = S.fields();
    for (const row of f.layout[l]) for (const code of row) {
      if (typeof code === 'string' && S.legendFor(code).unknown) { list.push({code, caption: 'Dotted amber: a keycode Vial doesn\u2019t know.'}); return list; }
    }
    return list;
  }
  /* Explanation strip: real legends of a few codes, one caption each. ctx null = measure only. */
  function drawSamples(ctx, x, y, w, k, log, l, cap) {
    const t = A.keycap.tokens(), list = samples(l);
    const meas = ctx || document.createElement('canvas').getContext('2d');
    const colW = w / list.length;
    let maxH = 0;
    list.forEach((s2, i) => {
      const capX = x + i * colW + k + 16, capW = colW - k - 28;
      const hgt = ctx ? textBlock(ctx, s2.caption, capX, y + cap, capW, cap, 400, t.text, t.fontUi, cap * 1.3, log, null)
        : measureBlock(meas, s2.caption, capW, cap, 400, t.fontUi, cap * 1.3);
      maxH = Math.max(maxH, k, hgt);
      if (!ctx) return;
      const legend = Object.assign({}, S.legendFor(s2.code));
      if (s2.inherited) { legend.inherited = true; legend.fromLayer = 0; }
      const m = A.keycap.model(legend, {k, minPx: cap * 0.96, layerHex: S.layerColor(0), colorOf: S.layerColor, parse: S.parse, tapLegend: A.board.tapLegend(legend), inheritedName: s2.inherited ? S.layerName(0) : null});
      A.keycap.draw(ctx, m, x + i * colW + k / 2 + 4, y + k / 2, 0, log);
    });
    return maxH;
  }

  /* ---------- composition ---------- */
  function renderSingle(l, scale, log) {
    const t = A.keycap.tokens();
    const W = 1920, margin = 48, k = 96, sk = 80, noteSize = 20, noteLine = 27;
    const ext = A.board.extent(), p = k / KEY_U;
    const meas = document.createElement('canvas').getContext('2d');
    const notes = layerNotes(l, true);
    const boardH = drawBoard(null, l, 0, 0, k, null, true);
    const samplesH = drawSamples(null, margin, 0, W - 2 * margin, sk, null, l, noteSize);
    const notesH = notes.length ? 34 + notes.reduce((sum, n) => sum + measureBlock(meas, n, W - 2 * margin, noteSize, 400, t.fontUi, noteLine), 0) : 0;
    const top = margin + 88;
    const H = Math.max(1080, Math.ceil(top + boardH + 32 + samplesH + (notesH ? 24 + notesH : 0) + margin));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Object.assign(new Error('The browser couldn\u2019t create a drawing surface.'), {code: 'E_CANVAS'});
    ctx.scale(scale, scale);
    ctx.fillStyle = t.app; ctx.fillRect(0, 0, W, H);
    // header
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 40px ${t.fontUi}`; ctx.fillStyle = S.layerColor(l); ctx.textAlign = 'left';
    const title = `${l}  ${S.layerName(l)}`;
    ctx.fillText(title, margin, margin + 38); if (log) log.push({text: title, size: 40, role: 'title'});
    ctx.font = `400 ${noteSize}px ${t.fontUi}`; ctx.fillStyle = t.muted;
    const reached = A.board.reachedBy(l);
    ctx.fillText(reached, margin, margin + 72); if (log) log.push({text: reached, size: noteSize, role: 'note'});
    ctx.textAlign = 'right'; ctx.font = `600 ${noteSize}px ${t.fontUi}`; ctx.fillStyle = t.text;
    ctx.fillText('Kyria rev4, Estonian layout', W - margin, margin + 30);
    if (log) log.push({text: 'Kyria rev4, Estonian layout', size: noteSize, role: 'note'});
    ctx.font = `400 ${noteSize}px ${t.fontUi}`; ctx.fillStyle = t.muted;
    const sub = `${S.ws().filename}, ${new Date().toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}`;
    ctx.fillText(sub, W - margin, margin + 58);
    if (log) log.push({text: sub, size: noteSize, role: 'note'});
    // board, centred
    drawBoard(ctx, l, (W - ext.w * p) / 2, top, k, log, false);
    // explanation strip, then notes
    const fy = top + boardH + 32;
    ctx.strokeStyle = t.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(margin, fy - 14); ctx.lineTo(W - margin, fy - 14); ctx.stroke();
    drawSamples(ctx, margin, fy, W - 2 * margin, sk, log, l, noteSize);
    if (notes.length) {
      const ny0 = fy + samplesH + 24;
      ctx.font = `700 ${noteSize}px ${t.fontUi}`; ctx.fillStyle = t.text; ctx.textAlign = 'left';
      ctx.fillText('On this layer', margin, ny0 + 20); if (log) log.push({text: 'On this layer', size: noteSize, role: 'note'});
      let ny = ny0 + 20 + 34;
      for (const n of notes) ny += textBlock(ctx, n, margin, ny, W - 2 * margin, noteSize, 400, t.text, t.fontUi, noteLine, log, null);
    }
    return {canvas, width: W, height: H};
  }

  function renderGrid(layers, scale, log) {
    const t = A.keycap.tokens();
    const k = 64, p = k / KEY_U, ext = A.board.extent();
    const pad = 24, gap = 32, margin = 40;
    const panelW = Math.ceil(ext.w * p + pad * 2), cols = layers.length > 1 ? 2 : 1;
    const W = margin * 2 + cols * panelW + (cols - 1) * gap;
    const meas = document.createElement('canvas').getContext('2d');
    const panels = layers.map(l => {
      const notes = layerNotes(l);
      const boardH = drawBoard(null, l, 0, 0, k, null, true);
      const notesH = notes.reduce((sum, n) => sum + measureBlock(meas, n, panelW - pad * 2, 16, 400, t.fontUi, 22), 0);
      return {l, notes, boardH, h: pad + 34 + 26 + boardH + (notes.length ? 12 + notesH : 0) + pad};
    });
    const rows = [];
    for (let i = 0; i < panels.length; i += cols) rows.push(panels.slice(i, i + cols));
    const headerH = 112;
    const legendH = 64 + 40;
    const combos = comboNotes();
    if (hiddenParts()) combos.unshift('Encoders or module buttons that this file\u2019s layout options mark as not fitted are not shown.');
    const comboH = combos.length ? 30 + combos.reduce((sum, n) => sum + measureBlock(meas, n, W - margin * 2, 16, 400, t.fontUi, 22), 0) : 0;
    const H = Math.ceil(headerH + rows.reduce((sum, r) => sum + Math.max(...r.map(x => x.h)) + gap, 0) + legendH + comboH + margin);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Object.assign(new Error('The browser couldn\u2019t create a drawing surface this large.'), {code: 'E_CANVAS'});
    ctx.scale(scale, scale);
    ctx.fillStyle = t.app; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = `700 32px ${t.fontUi}`; ctx.fillStyle = t.text;
    ctx.fillText('Kyria rev4 keymap, Estonian layout', margin, margin + 30); if (log) log.push({text: 'Kyria rev4 keymap, Estonian layout', size: 32, role: 'title'});
    ctx.font = `400 18px ${t.fontUi}`; ctx.fillStyle = t.muted;
    ctx.fillText(`${S.ws().filename}, ${new Date().toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}`, margin, margin + 60);
    let y = headerH;
    for (const row of rows) {
      const rowH = Math.max(...row.map(x => x.h));
      row.forEach((pnl, i) => {
        const x = margin + i * (panelW + gap);
        A.keycap.roundRect(ctx, x, y, panelW, rowH, 14);
        ctx.fillStyle = t.panel; ctx.fill();
        ctx.font = `700 26px ${t.fontUi}`; ctx.fillStyle = S.layerColor(pnl.l); ctx.textAlign = 'left';
        const title = `${pnl.l}  ${S.layerName(pnl.l)}`;
        ctx.fillText(title, x + pad, y + pad + 24); if (log) log.push({text: title, size: 26, role: 'title'});
        ctx.font = `400 16px ${t.fontUi}`; ctx.fillStyle = t.muted;
        const reached = A.board.reachedBy(pnl.l);
        ctx.fillText(ctx.measureText(reached).width > panelW - pad * 2 ? A.keycap.truncate(reached, 16, panelW - pad * 2, 400, t.fontUi) : reached, x + pad, y + pad + 50); if (log) log.push({text: reached, size: 16, role: 'note'});
        drawBoard(ctx, pnl.l, x + pad, y + pad + 34 + 26, k, log, false);
        let ny = y + pad + 34 + 26 + pnl.boardH + 12 + 16;
        for (const n of pnl.notes) ny += textBlock(ctx, n, x + pad, ny, panelW - pad * 2, 16, 400, t.text, t.fontUi, 22, log, null);
      });
      y += rowH + gap;
    }
    drawSamples(ctx, margin, y, W - margin * 2, k, log, layers[0], 16);
    y += legendH;
    if (combos.length) {
      ctx.font = `700 18px ${t.fontUi}`; ctx.fillStyle = t.text; ctx.textAlign = 'left';
      ctx.fillText('Notes', margin, y + 18);
      let cy = y + 44;
      for (const n of combos) cy += textBlock(ctx, n, margin, cy, W - margin * 2, 16, 400, t.text, t.fontUi, 22, log, null);
    }
    return {canvas, width: W, height: H};
  }

  function comboNotes() {
    const f = S.fields();
    if (!Array.isArray(f.combo)) return [];
    return f.combo.map((c, i) => {
      if (S.isRaw(c)) return null;
      const inputs = c.slice(0, 4).filter(x => x !== 'KC_NO');
      if (!inputs.length) return null;
      const name = x => { const lg = S.legendFor(x); return lg.main || x; };
      return `Combo ${i}: ${inputs.map(name).join(' + ')} together \u2192 ${c[4] === 'KC_NO' ? 'nothing' : name(c[4])}.`;
    }).filter(Boolean);
  }

  function render(opts) {
    const layers = opts && opts.layers ? opts.layers : imageLayers();
    const scale = opts && opts.scale ? opts.scale : 1;
    const log = opts && opts.log ? opts.log : null;
    return layers.length === 1 ? renderSingle(layers[0], scale, log) : renderGrid(layers, scale, log);
  }

  function fileName() { return 'kyria-all-layers.png'; }

  function save() {
    const ui = A.store.ui;
    let out;
    A.store.sheetBusy = true;
    try { out = render({layers: imageLayers(), scale: ui.sheet.scale}); }
    catch (e) { A.store.sheetBusy = false; S.setMessage(`The image couldn\u2019t be drawn: ${(e.message || 'unknown error').replace(/\.?$/, '.')} Choose Normal (1\u00d7) under Reference image and try again.`, 'alert'); S.render(); return; }
    const name = fileName();
    S.setMessage('Saving the image\u2026', 'status'); S.render();
    try {
      out.canvas.toBlob(blob => {
        A.store.sheetBusy = false;
        if (!blob) { S.setMessage('Your browser couldn\u2019t create an image this large. Choose Normal (1\u00d7) under Reference image and try again.', 'alert'); S.render(); return; }
        A.dom.download(blob, name);
        S.setMessage(`Saved ${name} (${out.canvas.width} \u00d7 ${out.canvas.height} pixels).`, 'status'); S.render();
      }, 'image/png');
    } catch (e) {
      A.store.sheetBusy = false;
      S.setMessage(`The image couldn\u2019t be saved: ${e.message || 'unknown error'}.`, 'alert'); S.render();
    }
  }

  /* ---------- view ---------- */
  function renderView(main) {
    const ui = A.store.ui, layers = imageLayers();
    const scaleName = A.dom.id('scale');
    const setScale = v => { ui.sheet.scale = v; S.persistUi(); S.render(`scale:${v}`); };
    const previewWrap = h('div', {class: ['sheet-preview', ui.sheet.actual && 'is-actual']});
    let out = null;
    try { out = render({layers, scale: 1}); }
    catch (e) { previewWrap.append(h('p', {class: 'notice notice-danger', text: `The preview couldn\u2019t be drawn: ${e.message}`})); }
    const size = f => out ? `: ${out.width * f} \u00d7 ${out.height * f} pixels` : '';
    const contents = layers.length > 1 ? `all ${layers.length} layers, including layers that do nothing` : 'its only layer';
    const options = h('form', {class: 'panel sheet-options', on: {submit: e => { e.preventDefault(); save(); }}},
      h('h2', {class: 'section-title', text: 'Image options'}),
      h('fieldset', {class: 'radio-list'}, h('legend', {class: 'field-label', text: 'Pixel size'}),
        [[1, `Normal (1\u00d7)${size(1)}`], [2, `Sharp (2\u00d7)${size(2)}, for high-resolution screens`]].map(([v, text]) => h('label', {class: 'toggle'},
          h('input', {type: 'radio', name: scaleName, checked: ui.sheet.scale === v, 'data-fid': `scale:${v}`, on: {change: () => setScale(v)}}), h('span', {text})))),
      h('button', {type: 'submit', class: 'button button-primary', 'data-fid': 'save-png', disabled: !!A.store.sheetBusy, text: A.store.sheetBusy ? 'Saving\u2026' : 'Save PNG'}),
      h('p', {class: 'hint', text: `Saves ${fileName()} with ${contents}. Names and colours come from this browser.`}));
    if (out) {
      out.canvas.setAttribute('role', 'img');
      out.canvas.setAttribute('aria-label', `Preview of the reference image for ${layers.map(l => S.layerName(l)).join(', ')}, ${out.width} by ${out.height} pixels at 1\u00d7.`);
      out.canvas.className = 'sheet-canvas';
      previewWrap.append(out.canvas);
    }
    main.append(h('h1', {class: 'view-title', text: 'Reference image'}),
      h('p', {class: 'view-lead', text: 'A picture of all your layers to keep on screen while you learn the Kyria. Every key shows what your Estonian computer types.'}),
      h('div', {class: 'sheet-grid'}, options,
        h('section', {class: 'panel sheet-view', 'aria-label': 'Preview'},
          h('div', {class: 'sheet-view-head'},
            h('h2', {class: 'section-title', text: 'Preview'}),
            h('label', {class: 'toggle'}, h('input', {type: 'checkbox', checked: ui.sheet.actual, 'data-fid': 'actual', on: {change: e => { ui.sheet.actual = e.target.checked; S.render('actual'); }}}),
              h('span', {text: 'Show at 100 %'}))),
          previewWrap)));
  }

  A.sheet = {render, save, renderView, imageLayers, fileName};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
