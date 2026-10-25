(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const STORAGE_KEY = 'kyria-keymap-studio/v2';
  const UI_KEY = 'kyria-keymap-studio/v2/ui';
  const VIEWS = ['keymap', 'macros', 'tapdance', 'combos', 'overrides', 'altrepeat', 'settings', 'sheet'];
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isRaw = v => !!v && typeof v === 'object' && !Array.isArray(v) && own(v, '$raw');

  const store = {
    hist: null,
    labels: {past: [], future: []},
    ui: defaultUi(),
    loadIssues: [],
    baselineHash: null,
    baselineKind: 'built-in',
    banners: {storage: null, otherTab: false, restore: null},
    message: {text: '', tone: 'status'},
    saved: false
  };

  function defaultUi() {
    return {view: 'keymap', layer: 0, target: null, level: 0, pickerTab: 'chars', search: '', keyCategory: null,
      index: {macros: 0, tapdance: 0, combos: 0, overrides: 0, altrepeat: 0}, showUnused: {},
      sheet: {scale: 1, actual: false}};
  }

  /* ---------- small pure helpers ---------- */
  function hash(text) {
    let h1 = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h1 ^= text.charCodeAt(i); h1 = Math.imul(h1, 0x01000193); }
    return (h1 >>> 0).toString(16) + ':' + text.length;
  }
  const ws = () => store.hist.present;
  const fields = () => ws().doc.fields;

  function report(error, context) {
    const message = error && typeof error.message === 'string' && error.code ? error.message
      : `${context || 'That action'} failed unexpectedly${error && error.message ? ': ' + error.message : ''}.`;
    if (!(error && error.code)) console.error(error);
    setMessage(message.endsWith('.') ? message : message + '.', 'alert');
  }

  function guard(fn, fallback, context) {
    try { return fn(); } catch (e) { if (context !== false) console.error(context || 'Kyria Keymap Studio', e); return typeof fallback === 'function' ? fallback(e) : fallback; }
  }

  /* ---------- rendering hook ---------- */
  let renderer = null;
  function onRender(fn) { renderer = fn; }
  function render(focus) { if (renderer) renderer(focus); }

  function setMessage(text, tone) { store.message = {text, tone: tone || 'status', at: Date.now()}; }

  /* ---------- persistence ---------- */
  function uiSnapshot() {
    const u = store.ui;
    return {view: u.view, layer: u.layer, level: u.level, index: u.index, sheet: {scale: u.sheet.scale, actual: u.sheet.actual},
      baselineHash: store.baselineHash, baselineKind: store.baselineKind};
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ws()));
      localStorage.setItem(UI_KEY, JSON.stringify(uiSnapshot()));
      store.banners.storage = null;
      store.saved = true;
    } catch (e) {
      store.saved = false;
      store.banners.storage = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) ? 'full' : 'blocked';
    }
  }
  function persistUi() {
    try { localStorage.setItem(UI_KEY, JSON.stringify(uiSnapshot())); } catch (_) { /* reported by persist() */ }
  }

  function restoreUi(layers) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); } catch (_) { saved = null; }
    if (!saved || typeof saved !== 'object') return;
    const u = store.ui;
    if (VIEWS.includes(saved.view)) u.view = saved.view;
    if (Number.isInteger(saved.layer) && saved.layer >= 0 && saved.layer < layers) u.layer = saved.layer;
    if ([0, 1, 2, 3].includes(saved.level)) u.level = saved.level;
    if (saved.index && typeof saved.index === 'object') for (const k of Object.keys(u.index)) if (Number.isInteger(saved.index[k]) && saved.index[k] >= 0) u.index[k] = saved.index[k];
    // Older versions also saved layer filters (sheet.mode, layers, includeEmpty). The image now
    // always holds every layer, so only the pixel size is restored and the filters are dropped.
    const sh = saved.sheet;
    if (sh && typeof sh === 'object') u.sheet.scale = sh.scale === 2 ? 2 : 1;
    if (typeof saved.baselineHash === 'string') store.baselineHash = saved.baselineHash;
    if (['built-in', 'import', 'export'].includes(saved.baselineKind)) store.baselineKind = saved.baselineKind;
  }

  function boot() {
    let restored = null, storageBlocked = false;
    try {
      const rawText = localStorage.getItem(STORAGE_KEY);
      if (rawText !== null) {
        const r = KS.workspace.restore(rawText);
        if (r.ok) restored = r;
        else store.banners.restore = (r.issues && r.issues[0] && r.issues[0].message) || 'unreadable data';
      }
    } catch (_) { storageBlocked = true; }
    const start = restored ? restored.ws : KS.workspace.fromDefault();
    store.hist = KS.history.create(start);
    if (restored) {
      store.loadIssues = restored.issues || [];
      restoreUi(start.doc.fields.layout.length);
      if (!store.baselineHash) { store.baselineHash = hash(KS.DEFAULT_VIL_TEXT); store.baselineKind = 'built-in'; }
      store.saved = true;
    } else {
      const d = guard(() => KS.vil.decode(KS.DEFAULT_VIL_TEXT, KS.board), {issues: []});
      store.loadIssues = d.issues || [];
      store.baselineHash = hash(KS.DEFAULT_VIL_TEXT);
      store.baselineKind = 'built-in';
    }
    if (storageBlocked) store.banners.storage = 'blocked';
    window.addEventListener('storage', e => {
      if (e.key === STORAGE_KEY) { store.banners.otherTab = true; render(); }
    });
  }

  /* ---------- history ---------- */
  function commit(op, label, opts) {
    try {
      store.hist = KS.history.commit(store.hist, op);
    } catch (e) {
      report(e, label);
      render(opts && opts.focus);
      return false;
    }
    store.labels.past.push(label);
    if (store.labels.past.length > (store.hist.limit || 200)) store.labels.past.shift();
    store.labels.future = [];
    persist();
    setMessage(`${label}.`, 'status');
    if (!(opts && opts.noRender)) render(opts && opts.focus);
    return true;
  }
  function undo() {
    if (!KS.history.canUndo(store.hist)) { setMessage('Nothing to undo.', 'status'); render(); return; }
    store.hist = KS.history.undo(store.hist);
    const label = store.labels.past.pop() || 'last change';
    store.labels.future.unshift(label);
    persist();
    setMessage(`Undid: ${label}.`, 'status');
    render();
  }
  function redo() {
    if (!KS.history.canRedo(store.hist)) { setMessage('Nothing to redo.', 'status'); render(); return; }
    store.hist = KS.history.redo(store.hist);
    const label = store.labels.future.shift() || 'change';
    store.labels.past.push(label);
    persist();
    setMessage(`Redid: ${label}.`, 'status');
    render();
  }
  function replaceWorkspace(next, {issues, baselineKind, message}) {
    store.hist = KS.history.create(next);
    store.labels = {past: [], future: []};
    store.loadIssues = issues || [];
    store.baselineHash = hash(guard(() => KS.vil.encode(next.doc), ''));
    store.baselineKind = baselineKind;
    store.ui.target = null;
    store.ui.layer = 0;
    store.ui.index = {macros: 0, tapdance: 0, combos: 0, overrides: 0, altrepeat: 0};
    store.banners.restore = null;
    persist();
    setMessage(message, 'status');
    render();
  }

  /* ---------- geometry names ---------- */
  const FINGERS = {6: 'outer pinky', 5: 'pinky', 4: 'ring', 3: 'middle', 2: 'index', 1: 'inner index'};
  let thumbOrder = null;
  function thumbs() {
    if (thumbOrder) return thumbOrder;
    const isThumb = k => (k.row % 5) === 3 || ((k.row % 5) === 2 && k.col === 0);
    const left = KS.board.keys.filter(k => k.row < 5 && isThumb(k)).sort((a, b) => a.x - b.x);
    const right = KS.board.keys.filter(k => k.row >= 5 && isThumb(k)).sort((a, b) => b.x - a.x);
    thumbOrder = {left, right};
    return thumbOrder;
  }
  function keyName(row, col) {
    const right = row >= 5, r = row % 5, side = right ? 'Right' : 'Left';
    if (r <= 2 && col >= 1 && FINGERS[col]) return `${side} ${['top', 'home', 'bottom'][r]} row, ${FINGERS[col]}`;
    if (r === 4) return `${side} module button ${col + 1}`;
    const list = thumbs()[right ? 'right' : 'left'];
    const i = list.findIndex(k => k.row === row && k.col === col);
    return i >= 0 ? `${side} thumb ${i + 1}` : `Matrix ${row}, ${col}`;
  }
  const layerName = n => ws().meta.layerNames[n] ?? `Layer ${n}`;
  const layerColor = n => ws().meta.layerColors[n] ?? '#9daabd';

  /* ---------- targets: everything the picker and composer can write to ---------- */
  function targetInfo(t) {
    if (!t) return null;
    const f = fields();
    const ro = reason => ({readOnly: reason});
    try {
      switch (t.type) {
        case 'key': {
          const v = f.layout[t.layer][t.row][t.col];
          return {code: v, title: `${layerName(t.layer)}: ${keyName(t.row, t.col)}`, sub: `matrix ${t.row}, ${t.col}`,
            ...(typeof v !== 'string' ? ro(v === -1 ? 'No key at this matrix position.' : 'Numeric keycode from the file; kept as is.') : {})};
        }
        case 'encoder': {
          const enc = (KS.board.encoders || []).find(e => e.index === t.index);
          const v = f.encoder_layout[t.layer][t.index][t.dir];
          return {code: v, title: `${layerName(t.layer)}: ${enc ? enc.label : 'Encoder ' + t.index}, ${t.dir === 0 ? 'clockwise' : 'counter-clockwise'}`,
            sub: `encoder ${t.index}`, ...(typeof v !== 'string' ? ro('Numeric keycode from the file; kept as is.') : {})};
        }
        case 'tapdance': {
          const item = f.tap_dance[t.index];
          if (isRaw(item)) return {code: null, title: `Tap dance ${t.index}`, readOnly: 'Kept as is: this entry isn\u2019t in a format the studio edits.'};
          const v = item[t.slot];
          return {code: v, title: `Tap dance ${t.index}: ${['on tap', 'on hold', 'on double tap', 'on tap then hold'][t.slot]}`, sub: `TD(${t.index})`,
            ...(typeof v !== 'string' ? ro('Numeric keycode from the file; kept as is.') : {})};
        }
        case 'combo': {
          const item = f.combo[t.index];
          if (isRaw(item)) return {code: null, title: `Combo ${t.index}`, readOnly: 'Kept as is: this entry isn\u2019t in a format the studio edits.'};
          const v = item[t.slot];
          return {code: v, title: `Combo ${t.index}: ${t.slot === 4 ? 'output' : 'key ' + (t.slot + 1)}`, sub: `combo ${t.index}`,
            ...(typeof v !== 'string' ? ro('Numeric keycode from the file; kept as is.') : {})};
        }
        case 'override': case 'altrepeat': {
          const section = t.type === 'override' ? 'key_override' : 'alt_repeat_key';
          const item = f[section][t.index];
          if (isRaw(item)) return {code: null, title: `${t.type === 'override' ? 'Key override' : 'Alt repeat'} ${t.index}`, readOnly: 'Kept as is.'};
          const v = item[t.field];
          const names = {trigger: 'trigger key', replacement: 'replacement', keycode: 'last key', alt_keycode: 'alt key'};
          return {code: v, title: `${t.type === 'override' ? 'Key override' : 'Alt repeat'} ${t.index}: ${names[t.field]}`, sub: `${section}[${t.index}]`,
            ...(typeof v !== 'string' ? ro('Numeric keycode from the file; kept as is.') : {})};
        }
        case 'macroKey': {
          const item = f.macro[t.index];
          if (isRaw(item)) return {code: null, title: `Macro M${t.index}`, readOnly: 'Kept as is.'};
          const kindName = {tap: 'tap', down: 'press', up: 'release'};
          if (t.step < 0) return {code: null, append: true, title: t.kind === 'down' || t.kind === 'up' ? `Macro M${t.index}: new ${kindName[t.kind]} step` : `Macro M${t.index}: add a character or key`, sub: `M${t.index}`};
          const step = item[t.step];
          return {code: null, append: true, title: `Macro M${t.index}, step ${t.step + 1}: ${step ? kindName[step[0]] || step[0] : 'step'} keys`, sub: `M${t.index}`};
        }
        default: return null;
      }
    } catch (_) { return null; }
  }

  function writeTarget(t, code, label) {
    let op;
    try { op = opFor(t, code); } catch (e) { report(e, label); render(); return false; }
    if (!op) return false;
    if (t.type === 'macroKey' && t.step < 0 && (t.kind === 'down' || t.kind === 'up')) {
      const next = fields().macro[t.index].length;
      const ok = commit(op, label, {noRender: true});
      if (ok) store.ui.target = Object.assign({}, t, {step: next});
      render();
      return ok;
    }
    return commit(op, label);
  }

  function opFor(t, code) {
    const f = fields();
    const ops = {
      key: () => ({type: 'key.set', layer: t.layer, row: t.row, col: t.col, code}),
      encoder: () => ({type: 'encoder.set', layer: t.layer, index: t.index, dir: t.dir, code}),
      tapdance: () => { const v = f.tap_dance[t.index].slice(); v[t.slot] = code; return {type: 'tapDance.set', index: t.index, value: v}; },
      combo: () => { const v = f.combo[t.index].slice(); v[t.slot] = code; return {type: 'combo.set', index: t.index, value: v}; },
      override: () => ({type: 'keyOverride.set', index: t.index, value: Object.assign({}, f.key_override[t.index], {[t.field]: code})}),
      altrepeat: () => ({type: 'altRepeat.set', index: t.index, value: Object.assign({}, f.alt_repeat_key[t.index], {[t.field]: code})}),
      macroKey: () => {
        const actions = f.macro[t.index].map(a => a.slice());
        const plainKey = () => { const a = parse(code); if (a.k !== 'basic' && a.k !== 'named') throw keyError('Press and release steps take plain keys only. Use \u201cCharacter or key\u201d for shifted and AltGr characters.'); };
        if (t.step >= 0) { plainKey(); actions[t.step].push(code); }
        else if (t.kind === 'down' || t.kind === 'up') { plainKey(); actions.push([t.kind, code]); }
        else {
          const add = macroActionsFor(code);
          if (!add) throw keyError('This action can\u2019t be typed by a macro.');
          actions.push(...add.map(a => a.slice()));
        }
        return {type: 'macro.set', index: t.index, actions};
      }
    };
    const make = t && ops[t.type];
    return make ? make() : null;
  }

  /* ---------- legends (guarded so a core error never blanks the UI) ---------- */
  function fallbackLegend(code) {
    const text = String(code);
    return {code: text, inherited: false, fromLayer: 0, kind: 'raw', main: text, unknown: true, a11y: `Unrecognised keycode ${text}`};
  }
  function legendAt(layer, row, col) {
    return guard(() => KS.legend.at(ws(), layer, row, col), () => fallbackLegend(fields().layout[layer][row][col]));
  }
  function legendFor(code) {
    if (code === null || code === undefined) return {code: '', kind: 'none', main: '', a11y: 'empty'};
    return guard(() => KS.legend.describe(code, ws()), () => fallbackLegend(code));
  }
  function legendEncoder(layer, index, dir) {
    return guard(() => KS.legend.encoder(ws(), layer, index, dir), () => fallbackLegend(fields().encoder_layout[layer][index][dir]));
  }
  function keyError(message) { const e = new Error(message); e.code = 'E_MACRO_KEY'; return e; }
  /* Basic-keycode macro actions for a picked code (LLA API-KC macroActions); never compound codes in macros. */
  function macroActionsFor(code) {
    const viaCore = guard(() => (KS.keycodes.macroActions ? KS.keycodes.macroActions(code) : null), null);
    if (Array.isArray(viaCore) && viaCore.length) return viaCore;
    const a = parse(code);
    return a.k === 'basic' || a.k === 'named' ? [['tap', code]] : null;
  }
  function checkMacroText(text) {
    if (KS.vil && typeof KS.vil.checkMacroText === 'function') {
      const issues = guard(() => KS.vil.checkMacroText(text), null);
      if (Array.isArray(issues)) return issues.filter(i => i.severity === 'error');
    }
    const bad = Array.from(text).filter(ch => { const c = ch.codePointAt(0); return !(c === 8 || c === 9 || c === 10 || c === 27 || (c >= 32 && c <= 126)); });
    return bad.length ? [{severity: 'error', code: 'E_MACRO_TEXT', path: '', message: 'Firmware text macros send US-ASCII only; add Estonian characters with the character picker'}] : [];
  }
  function parse(code) { return guard(() => KS.keycodes.parse(code), {k: 'raw', text: String(code)}); }
  function format(action) { return KS.keycodes.format(action); }
  function macroText(actions) { return guard(() => KS.legend.macroText(actions), {text: '', complete: false}); }

  /* ---------- issues ---------- */
  const VALIDATE_CODES = new Set(['E_VIAL_REQUIRED', 'E_UID', 'W_UID_ROUNDED', 'W_UID_OTHER', 'E_LAYOUT', 'E_MATRIX', 'E_ENCODER', 'E_LAYOUT_OPTIONS', 'W_UNKNOWN_KEYCODE', 'E_DOCUMENT']);
  function issues() {
    const live = guard(() => KS.vil.validate(ws().doc, KS.board), () => [{severity: 'error', code: 'E_VALIDATE', path: '', message: 'Validation failed unexpectedly; export is blocked until it works.'}]);
    const seen = new Set(live.map(i => i.code + '|' + i.path));
    const extra = store.loadIssues.filter(i => !VALIDATE_CODES.has(i.code) && !seen.has(i.code + '|' + i.path));
    const order = {error: 0, warning: 1, info: 2};
    return live.concat(extra).sort((a, b) => order[a.severity] - order[b.severity]);
  }

  function docState() {
    const text = guard(() => KS.vil.encode(ws().doc), null);
    const same = text !== null && hash(text) === store.baselineHash;
    const what = {'built-in': 'built-in layout', import: 'opened file', export: 'last export'}[store.baselineKind];
    return {same, text: same ? `Matches the ${what}` : `Changed since the ${what}`};
  }

  A.store = store;
  A.state = {
    STORAGE_KEY, UI_KEY, boot, persist, persistUi, commit, undo, redo, replaceWorkspace, onRender, render, setMessage, report, guard,
    ws, fields, hash, isRaw, keyName, layerName, layerColor, targetInfo, writeTarget, opFor, legendAt, legendFor, legendEncoder, parse, format,
    macroText, macroActionsFor, checkMacroText, issues, docState, defaultUi
  };
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
