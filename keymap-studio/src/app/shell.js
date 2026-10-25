/*
 * Application shell: header (UI-1), section rail, banners (UI-8), issues (UI-7),
 * status line, routing, import/export and keyboard shortcuts.
 */
(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const {h} = A.dom;
  const S = A.state;
  const T = A.text;

  let root = null, headerEl = null, bannerEl = null, railEl = null, mainEl = null, statusEl = null, alertEl = null, saveEl = null, fileInput = null;

  function viewFromHash() {
    const m = /^#\/([a-z]+)/.exec(location.hash || '');
    return m && T.views.some(v => v.id === m[1]) ? m[1] : null;
  }
  function go(view, focusId) {
    const ui = A.store.ui;
    if (!T.views.some(v => v.id === view)) view = 'keymap';
    const changed = ui.view !== view;
    ui.view = view;
    S.persistUi();
    if (location.hash !== `#/${view}`) history.replaceState(null, '', `#/${view}`);
    render(focusId || (changed ? 'main' : null), changed);
    if (changed && !focusId) window.scrollTo(0, 0);
  }

  /* ---------- import / export ---------- */
  function exportName(name) {
    const base = String(name || 'keymap').replace(/\.(vil|json)$/i, '').replace(/-edited$/i, '');
    return `${base}-edited.vil`;
  }
  function exportVil() {
    const errors = S.issues().filter(i => i.severity === 'error');
    if (errors.length) { S.setMessage(T.exportBlocked(errors.length), 'alert'); render(); openIssues(); return false; }
    let text;
    try { text = KS.vil.encode(S.ws().doc); } catch (e) { S.report(e, 'Export'); render(); return false; }
    const name = exportName(S.ws().filename);
    A.dom.download(new Blob([text], {type: 'application/json'}), name);
    A.store.baselineHash = S.hash(text);
    A.store.baselineKind = 'export';
    S.persistUi();
    S.setMessage(`Exported ${name}. In Vial use File \u2192 Load saved layout to put it on the keyboard.`, 'status');
    render();
    return true;
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > 2000000) { S.setMessage(T.tooLarge, 'alert'); render(); return; }
    let text;
    try { text = await file.text(); } catch (_) { S.setMessage(T.importFailed(file.name, 'the browser couldn\u2019t read it.'), 'alert'); render(); return; }
    const result = S.guard(() => KS.vil.decode(text, KS.board), {ok: false, issues: [{severity: 'error', code: 'E_DECODE', path: '', message: 'it couldn\u2019t be read as a Vial layout'}]});
    if (!result.ok) {
      const err = (result.issues || []).find(i => i.severity === 'error') || (result.issues || [])[0];
      const msg = err ? `${err.message.replace(/\.$/, '')}${err.code ? ` (${err.code})` : ''}.` : 'it isn\u2019t a Vial layout.';
      S.setMessage(T.importFailed(file.name, msg), 'alert'); render(); return;
    }
    if (!S.docState().same) {
      const v = await A.dom.choose({title: 'Replace the current keymap?',
        body: [`Opening ${file.name} replaces the keymap in this browser. Changes since your last export or import would be lost.`],
        actions: [{label: 'Cancel', value: null}, {label: 'Export first', value: 'export'}, {label: 'Replace', value: 'replace', primary: true}], danger: true});
      if (v === null) { S.setMessage('Kept the current keymap.', 'status'); render(); return; }
      if (v === 'export' && !exportVil()) return;
    }
    let ws;
    try { ws = KS.workspace.create(result.doc, {filename: file.name}); }
    catch (e) { S.setMessage(T.importFailed(file.name, `${e.message}.`), 'alert'); render(); return; }
    const warnings = (result.issues || []).filter(i => i.severity !== 'info').length;
    S.replaceWorkspace(ws, {issues: result.issues || [], baselineKind: 'import',
      message: `Opened ${file.name}${warnings ? `, with ${T.plural(warnings, 'warning', 'warnings')}. See Issues` : ''}.`});
  }

  function resetToDefault() {
    A.dom.choose({title: 'Reset to the built-in layout?', danger: true,
      body: ['The keymap in this browser is replaced with the built-in kriskyria.vil layout. Layer names, colours and labels go back to their defaults. Export first if you want to keep your edits.'],
      actions: [{label: 'Cancel', value: null}, {label: 'Reset', value: 'reset', primary: true}]}).then(v => {
      if (v !== 'reset') return;
      let ws;
      try { ws = KS.workspace.fromDefault(); } catch (e) { S.report(e, 'Reset'); render(); return; }
      const d = S.guard(() => KS.vil.decode(KS.DEFAULT_VIL_TEXT, KS.board), {issues: []});
      S.replaceWorkspace(ws, {issues: d.issues || [], baselineKind: 'built-in', message: 'Reset to the built-in layout.'});
    });
  }

  /* ---------- issues ---------- */
  function issueTarget(path) {
    let m = /^layout\[(\d+)\]\[(\d+)\]\[(\d+)\]/.exec(path);
    if (m) return () => { const [l, r, c] = m.slice(1).map(Number); A.store.ui.layer = l; A.store.ui.target = {type: 'key', layer: l, row: r, col: c}; go('keymap', `key:${r}:${c}`); };
    m = /^encoder_layout\[(\d+)\]\[(\d+)\]\[(\d+)\]/.exec(path);
    if (m) return () => { const [l, i, d] = m.slice(1).map(Number); A.store.ui.layer = l; A.store.ui.target = {type: 'encoder', layer: l, index: i, dir: d}; go('keymap', `enc:${i}:${d}`); };
    const map = {macro: 'macros', tap_dance: 'tapdance', combo: 'combos', key_override: 'overrides', alt_repeat_key: 'altrepeat'};
    m = /^(macro|tap_dance|combo|key_override|alt_repeat_key)\[(\d+)\]/.exec(path);
    if (m) return () => { A.store.ui.index[map[m[1]]] = Number(m[2]); go(map[m[1]]); };
    if (/^(uid|layout_options|settings|encoder_layout|vial_protocol)/.test(path)) return () => go('settings');
    return null;
  }
  function openIssues() {
    const list = S.issues();
    const body = list.length ? h('ul', {class: 'issue-list'}, list.map(i => {
      const nav = issueTarget(i.path || '');
      return h('li', {class: ['issue', `issue-${i.severity}`]},
        h('span', {class: 'issue-sev', text: {error: 'Error', warning: 'Warning', info: 'Note'}[i.severity] || i.severity}),
        h('span', {class: 'issue-text'}, `${i.message}${i.path ? ` (${i.path})` : ''}`),
        nav ? h('button', {type: 'button', class: 'button button-small', text: 'Show', on: {click: () => { closeDialog(); nav(); }}}) : null);
    })) : h('p', {class: 'dialog-text', text: 'No issues. The file can be exported.'});
    let closeDialog = () => {};
    const p = A.dom.choose({title: list.length ? T.issues(list.length) : 'Issues', body: [
      h('p', {class: 'dialog-text', text: 'Errors block export. Warnings are kept as they are: the studio never changes imported data on its own.'}), body],
    actions: [{label: 'Close', value: null, primary: true}]});
    const dlg = document.querySelector('dialog.dialog:last-of-type');
    closeDialog = () => { if (dlg) dlg.dispatchEvent(new Event('cancel', {cancelable: true})); };
    return p;
  }

  function shortcuts() {
    const rows = [['Ctrl+Z', 'Undo'], ['Ctrl+Shift+Z or Ctrl+Y', 'Redo'], ['Ctrl+S', 'Export .vil'], ['Ctrl+O', 'Open a .vil file'],
      ['/', 'Find a character'], ['Arrow keys', 'Move between keys on the board'], ['Enter or Space', 'Select the focused key'],
      ['Delete', 'Clear the selected key'], ['Ctrl+C, Ctrl+V', 'Copy and paste a key'], ['Page Up, Page Down', 'Previous or next layer'], ['Escape', 'Clear the selection'], ['?', 'This list']];
    A.dom.choose({title: 'Keyboard shortcuts', body: [h('dl', {class: 'shortcut-list'}, rows.map(([k, v]) => [h('dt', {}, h('kbd', {text: k})), h('dd', {text: v})]))],
      actions: [{label: 'Close', value: null, primary: true}]});
  }

  /* ---------- pieces ---------- */
  function header() {
    const hist = A.store.hist, list = S.issues();
    const errors = list.filter(i => i.severity === 'error').length, warnings = list.filter(i => i.severity === 'warning').length;
    const state = S.docState();
    const lastLabel = A.store.labels.past[A.store.labels.past.length - 1];
    const nextLabel = A.store.labels.future[0];
    return h('div', {class: 'topbar-inner'},
      h('p', {class: 'brand', text: T.appName}),
      h('div', {class: 'doc'}, h('span', {class: 'doc-name', text: S.ws().filename, title: S.ws().filename}), h('span', {class: ['doc-state', !state.same && 'is-changed'], text: state.text})),
      h('div', {class: 'toolbar', role: 'toolbar', 'aria-label': 'File and history'},
        h('button', {type: 'button', class: 'button', 'data-fid': 'undo', disabled: !KS.history.canUndo(hist), text: 'Undo', title: 'Undo (Ctrl+Z)',
          'aria-label': lastLabel ? `Undo: ${lastLabel}` : 'Undo', on: {click: S.undo}}),
        h('button', {type: 'button', class: 'button', 'data-fid': 'redo', disabled: !KS.history.canRedo(hist), text: 'Redo', title: 'Redo (Ctrl+Shift+Z)',
          'aria-label': nextLabel ? `Redo: ${nextLabel}` : 'Redo', on: {click: S.redo}}),
        list.length ? h('button', {type: 'button', class: ['button', errors ? 'button-danger-quiet' : 'button-warning-quiet'], 'data-fid': 'issues',
          text: errors ? `${T.plural(errors, 'error', 'errors')}${warnings ? `, ${warnings} warn.` : ''}` : T.plural(warnings || list.length, warnings ? 'warning' : 'note', warnings ? 'warnings' : 'notes'),
          'aria-label': `Issues: ${errors} errors, ${warnings} warnings`, on: {click: openIssues}}) : null,
        h('button', {type: 'button', class: 'button', 'data-fid': 'open', text: 'Open .vil\u2026', title: 'Open a Vial file (Ctrl+O)', on: {click: () => fileInput.click()}}),
        h('button', {type: 'button', class: 'button', 'data-fid': 'save-image', text: 'Save image', title: 'Save a PNG of all layers (pixel size is set under Reference image)',
          on: {click: () => A.sheet.save()}}),
        h('button', {type: 'button', class: 'button button-primary', 'data-fid': 'export', text: 'Export .vil', title: 'Download the edited Vial file (Ctrl+S)', on: {click: exportVil}})));
  }

  function rail() {
    const ui = A.store.ui;
    return h('ul', {class: 'rail-list'}, T.views.map(v => {
      const n = A.features.SECTIONS[v.id] ? A.features.count(v.id) : null;
      return h('li', {}, h('a', {href: `#/${v.id}`, class: ['rail-link', ui.view === v.id && 'is-current'], 'aria-current': ui.view === v.id ? 'page' : undefined, 'data-fid': `rail:${v.id}`,
        on: {click: e => { e.preventDefault(); go(v.id); }}},
      h('span', {class: 'rail-label', text: v.label}), n ? h('span', {class: 'rail-count', 'aria-label': `${n} in use`, text: String(n)}) : null));
    }));
  }

  function banners() {
    const b = A.store.banners, out = [];
    if (b.storage) out.push(h('div', {class: 'banner banner-danger', role: 'alert'}, h('p', {text: b.storage === 'full' ? T.storageFull : T.storageBlocked}),
      h('button', {type: 'button', class: 'button button-small', text: 'Export .vil now', on: {click: exportVil}})));
    if (b.otherTab) out.push(h('div', {class: 'banner banner-warning', role: 'status'}, h('p', {text: T.otherTab}),
      h('button', {type: 'button', class: 'button button-small', text: 'Reload', on: {click: () => location.reload()}}),
      h('button', {type: 'button', class: 'button button-small button-quiet', text: 'Keep this tab\u2019s version', on: {click: () => { b.otherTab = false; S.persist(); render(); }}})));
    if (b.restore) out.push(h('div', {class: 'banner banner-warning', role: 'status'}, h('p', {text: T.restoreFailed(b.restore)}),
      h('button', {type: 'button', class: 'button button-small button-quiet', text: 'Dismiss', on: {click: () => { b.restore = null; render(); }}})));
    return out;
  }

  /* ---------- render ---------- */
  function render(focusId, viewChanged) {
    if (!root) return;
    const active = document.activeElement;
    const keepFid = focusId || (active && active.closest && root.contains(active) ? (active.closest('[data-fid]') || {}).getAttribute?.('data-fid') : null);
    const scrollY = window.scrollY;
    const pickerScroll = (document.getElementById('picker-body') || {}).scrollTop || 0;
    A.dom.clear(headerEl).append(header());
    A.dom.clear(bannerEl).append(...banners());
    A.dom.clear(railEl).append(rail());
    A.dom.clear(mainEl);
    const view = A.store.ui.view;
    try {
      if (view === 'keymap') A.board.renderView(mainEl);
      else if (view === 'settings') A.settings.renderView(mainEl);
      else if (view === 'sheet') A.sheet.renderView(mainEl);
      else A.features.renderView(mainEl, view);
    } catch (e) {
      console.error(e);
      mainEl.append(h('div', {class: 'notice notice-danger', role: 'alert'},
        h('p', {text: `This section couldn\u2019t be shown: ${e && e.message ? e.message : 'unknown error'}. Your keymap is unchanged; export it to keep it safe.`}),
        h('button', {type: 'button', class: 'button', text: 'Go to the keymap', on: {click: () => go('keymap')}})));
    }
    const msg = A.store.message;
    if (msg.tone === 'alert') { statusEl.textContent = ''; alertEl.textContent = msg.text; }
    else { alertEl.textContent = ''; statusEl.textContent = msg.text; }
    saveEl.textContent = A.store.banners.storage ? 'Not saved in this browser' : A.store.saved ? T.saved : 'Not changed yet';
    saveEl.className = ['save-state', A.store.banners.storage && 'is-danger'].filter(Boolean).join(' ');
    if (!viewChanged) window.scrollTo(0, scrollY);
    const pb = document.getElementById('picker-body');
    if (pb && pickerScroll) pb.scrollTop = pickerScroll;
    if (keepFid === 'main') mainEl.focus({preventScroll: true});
    else if (keepFid) {
      const el = root.querySelector(`[data-fid="${CSS.escape(keepFid)}"]`);
      if (el) el.focus({preventScroll: true});
    }
  }

  function onKey(e) {
    if (document.querySelector('dialog[open]')) return;
    const t = e.target;
    const editing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (ctrl && !e.altKey && key === 's') { e.preventDefault(); exportVil(); return; }
    if (ctrl && !e.altKey && key === 'o') { e.preventDefault(); fileInput.click(); return; }
    if (editing) return;
    if (ctrl && !e.altKey && key === 'z') { e.preventDefault(); if (e.shiftKey) S.redo(); else S.undo(); return; }
    if (ctrl && !e.altKey && key === 'y') { e.preventDefault(); S.redo(); return; }
    if (ctrl || e.altKey) return;
    if (e.key === '/') { const s = document.querySelector('[data-fid="picker-search"]'); if (s) { e.preventDefault(); s.focus(); } return; }
    if (e.key === '?') { e.preventDefault(); shortcuts(); return; }
    if (e.key === 'Escape' && A.store.ui.target) { A.store.ui.target = null; render(); return; }
    if ((e.key === 'PageDown' || e.key === 'PageUp') && A.store.ui.view === 'keymap') {
      e.preventDefault();
      const n = S.fields().layout.length, cur = A.store.ui.layer;
      A.board.switchLayer((cur + (e.key === 'PageDown' ? 1 : -1) + n) % n, `layer-tab:${(cur + (e.key === 'PageDown' ? 1 : -1) + n) % n}`);
    }
  }

  function mount() {
    root = document.getElementById('app');
    A.dom.clear(root);
    root.removeAttribute('aria-busy');
    headerEl = h('header', {class: 'topbar'});
    bannerEl = h('div', {class: 'banners'});
    railEl = h('nav', {class: 'rail', 'aria-label': 'Sections'});
    mainEl = h('main', {id: 'main', class: 'main', tabindex: '-1', 'data-fid': 'main'});
    statusEl = h('p', {class: 'status-text', role: 'status', 'aria-live': 'polite'});
    alertEl = h('p', {class: 'status-alert', role: 'alert'});
    saveEl = h('p', {class: 'save-state'});
    fileInput = h('input', {type: 'file', accept: '.vil,.json,application/json', hidden: true, 'aria-hidden': 'true', tabindex: '-1',
      on: {change: e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; importFile(f).catch(err => { S.report(err, 'Opening the file'); render(); }); }}});
    root.append(headerEl, bannerEl, railEl, mainEl,
      h('footer', {class: 'statusbar'}, h('div', {class: 'status-messages'}, statusEl, alertEl), saveEl), fileInput);
    S.onRender(render);
    const hv = viewFromHash();
    if (hv) A.store.ui.view = hv;
    window.addEventListener('hashchange', () => { const v = viewFromHash(); if (v && v !== A.store.ui.view) go(v); });
    document.addEventListener('keydown', onKey);
    let resizeTimer = null;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (A.store.ui.view === 'keymap') render(); }, 150); });
    if (location.hash !== `#/${A.store.ui.view}`) history.replaceState(null, '', `#/${A.store.ui.view}`);
    render();
  }

  A.shell = {mount, render, go, exportVil, importFile, resetToDefault, openIssues, exportName};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
