/*
 * Write to keyboard: reads the connected Kyria half through the studio server (/api/keyboard),
 * previews what differs from the open keymap and writes only that (.nova/contract-keyboard.md).
 * groupChanges, writeBody and createFlow are pure and take fetch, timers and KS.wire as arguments so
 * the tests drive them without a browser; only open() touches the DOM.
 */
(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const API = '/api/keyboard';
  const POLL_MS = 120;
  const UNLOCK_LIMIT_MS = 60000;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const lowerFirst = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  const clean = s => String(s).replace(/\.$/, '');

  const GROUPS = [
    {id: 'keys', kinds: ['key'], title: 'Keys', byLayer: true},
    {id: 'macros', kinds: ['macro'], title: 'Macros'},
    {id: 'tapdance', kinds: ['tap_dance'], title: 'Tap dances'},
    {id: 'combos', kinds: ['combo'], title: 'Combos'},
    {id: 'overrides', kinds: ['key_override'], title: 'Key overrides'},
    {id: 'altrepeat', kinds: ['alt_repeat_key'], title: 'Alt repeat'},
    {id: 'encoders', kinds: ['encoder'], title: 'Encoders', byLayer: true},
    {id: 'layout', kinds: ['layout_options'], title: 'Layout options'},
    {id: 'settings', kinds: ['setting'], title: 'Settings'}
  ];
  const DYNAMIC_KINDS = ['tap_dance', 'combo', 'key_override', 'alt_repeat_key'];

  function shown(value) {
    if (value === null || value === undefined || value === '') return 'empty';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  // One diff item as the preview shows it. `names` supplies the studio's own naming.
  function itemLabel(item, names) {
    const describe = v => (typeof v === 'string' && v ? names.describe(v) : shown(v));
    const plain = {from: shown(item.from), to: shown(item.to)};
    const index = Number.isInteger(item.index) ? item.index : '?';
    switch (item.kind) {
      case 'key': {
        const place = names.keyName(item.row, item.col);
        return {label: place, full: `${names.layerName(item.layer)}, ${lowerFirst(place)}`, from: describe(item.from), to: describe(item.to)};
      }
      case 'encoder': {
        const place = names.encoderName(item.index);
        return {label: place, full: `${names.layerName(item.layer)}, ${lowerFirst(place)}`, from: describe(item.from), to: describe(item.to)};
      }
      case 'macro': return Object.assign({label: `Macro M${index}`}, plain);
      case 'tap_dance': return Object.assign({label: `Tap dance ${index}`}, plain);
      case 'combo': return Object.assign({label: `Combo ${index}`}, plain);
      case 'key_override': return Object.assign({label: `Key override ${index}`}, plain);
      case 'alt_repeat_key': return Object.assign({label: `Alt repeat ${index}`}, plain);
      case 'layout_options': return Object.assign({label: 'Layout options'}, plain);
      case 'setting': return Object.assign({label: names.settingName(item.qsid)}, plain);
      default: return Object.assign({label: String(item.kind || 'Unknown change')}, plain);
    }
  }

  /*
   * Diff items grouped in the preview's order. Keys and encoders are split per layer. A kind the
   * contract doesn't list goes to "Other" instead of being dropped.
   */
  function groupChanges(items, names) {
    const out = [];
    const known = new Set(GROUPS.flatMap(g => g.kinds));
    const labelled = it => Object.assign({raw: `${shown(it.from)} \u2192 ${shown(it.to)}`}, itemLabel(it, names));
    for (const g of GROUPS) {
      const mine = items.filter(it => g.kinds.includes(it.kind));
      if (!mine.length) continue;
      const group = {id: g.id, title: g.title, count: mine.length};
      if (g.byLayer) {
        const layers = [...new Set(mine.map(it => it.layer))].sort((a, b) => a - b);
        group.layers = layers.map(layer => ({layer, title: names.layerName(layer), items: mine.filter(it => it.layer === layer).map(labelled)}));
      } else group.items = mine.map(labelled);
      out.push(group);
    }
    const other = items.filter(it => !known.has(it.kind));
    if (other.length) out.push({id: 'other', title: 'Other', count: other.length, items: other.map(labelled)});
    return out;
  }

  // POST /api/keyboard/write body: parts without a diff item are null so the server leaves them alone.
  function writeBody(target, items) {
    const has = kinds => items.some(it => kinds.includes(it.kind));
    let settings = null;
    for (const it of items) {
      if (it.kind !== 'setting') continue;
      const key = String(it.qsid);
      if (isObject(target.settings) && own(target.settings, key)) (settings = settings || {})[key] = target.settings[key];
    }
    return {
      keymap: target.keymap,
      macros: has(['macro']) ? target.macros : null,
      dynamic: has(DYNAMIC_KINDS) ? target.dynamic : null,
      encoders: has(['encoder']) ? target.encoders : null,
      layoutOptions: has(['layout_options']) ? target.layoutOptions : null,
      settings
    };
  }

  function writtenSummary(written) {
    const w = isObject(written) ? written : {};
    const n = k => (Number.isInteger(w[k]) ? w[k] : 0);
    const parts = [];
    if (n('keymap')) parts.push(`keymap ${plural(n('keymap'), 'block', 'blocks')}`);
    if (n('macros')) parts.push(`macros ${plural(n('macros'), 'block', 'blocks')}`);
    if (n('dynamic')) parts.push(`${plural(n('dynamic'), 'entry', 'entries')} in tap dances, combos, overrides or alt repeat`);
    if (n('encoders')) parts.push(plural(n('encoders'), 'encoder', 'encoders'));
    if (n('layoutOptions')) parts.push('layout options');
    if (n('settings')) parts.push(plural(n('settings'), 'setting', 'settings'));
    return parts;
  }

  function errorText(r) {
    return r.body && typeof r.body.error === 'string' && r.body.error ? clean(r.body.error) : '';
  }
  function readFailure(r) {
    if (r.status === 0) return `The studio server didn\u2019t answer (${clean(r.network)}). Check that \u201cmake studio\u201d is running.`;
    if (r.status === 404) return 'This studio server can\u2019t talk to the keyboard. Restart \u201cmake studio\u201d from the current kyria folder.';
    const e = errorText(r);
    return `The studio server answered ${r.status}${e ? `: ${e}` : ''}.`;
  }
  function writeFailure(r, retried) {
    const e = errorText(r);
    if (r.status === 0) return {message: `The studio server didn\u2019t answer (${clean(r.network)}). The keyboard may or may not have been written; read it again to check.`, partial: true};
    if (r.ok) return {message: 'The server didn\u2019t confirm the write, so it isn\u2019t counted as done. Read the keyboard again to check.', partial: true};
    if (r.status === 409 && e === 'busy') return {message: 'The keyboard is busy with another request. Nothing was written; try again in a moment.'};
    if (r.status === 409 && r.body && r.body.needUnlock && retried) return {message: 'Nothing was written: the keyboard is still locked.'};
    if (r.status === 503) return {message: `Nothing was written: the keyboard isn\u2019t connected${e ? ` (${e})` : ''}.`};
    if (r.status === 500) return {message: `The write stopped: ${e || 'the server failed'}. Part of the change may already be on the keyboard. Read it again to see what still differs; the state before writing is saved in backups/before-write/.`, partial: true};
    if (r.status === 409 || r.status === 400) return {message: `Nothing was written: ${e || `the server refused (${r.status})`}.`};
    return {message: `The server answered ${r.status}${e ? `: ${e}` : ''}. Read the keyboard again to check what was written.`, partial: true};
  }

  /*
   * The dialog's state machine. Phases: idle, unavailable, blocked, reading, error, disconnected,
   * mismatch, prepare, same, preview, unlocking, writing, done, failed, closed. onChange gets each
   * new state object; state objects are never mutated after they are emitted.
   */
  function createFlow({fetch: fetchFn, wire, doc, errors = 0, onChange = () => {}, pollMs = POLL_MS, unlockLimitMs = UNLOCK_LIMIT_MS,
    setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = t => clearTimeout(t), now = () => Date.now()} = {}) {
    let state = {phase: 'idle'};
    let gen = 0;
    let closed = false;
    let mustLock = false;   // the studio sent "start", so it owes the keyboard a "lock"
    let unlockWait = null;
    let unlockCall = Promise.resolve();   // last unlock request; "lock" waits for it so the server isn't busy

    function set(next) { if (!closed) { state = next; onChange(state); } return state; }

    async function call(path, body) {
      const init = body === undefined
        ? {method: 'GET', cache: 'no-store', headers: {Accept: 'application/json'}}
        : {method: 'POST', cache: 'no-store', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify(body)};
      let res;
      try { res = await fetchFn(API + path, init); }
      catch (e) { return {status: 0, ok: false, body: null, network: e && e.message ? e.message : 'no answer'}; }
      let json = null;
      try { json = await res.json(); } catch (_) { json = null; }
      return {status: res.status, ok: !!res.ok, body: json};
    }

    async function relock() {
      if (!mustLock) return {lockError: null};
      await unlockCall;
      const r = await call('/unlock', {action: 'lock'});
      if (r.ok && isObject(r.body) && r.body.unlocked === false) { mustLock = false; return {lockError: null, relocked: true}; }
      return {lockError: r.status === 0 ? `the studio server didn\u2019t answer (${clean(r.network)})` : (errorText(r) || `the server answered ${r.status}`)};
    }

    async function read() {
      if (closed || state.phase === 'writing' || state.phase === 'unlocking') return state;
      const my = ++gen;
      if (!wire || typeof wire.build !== 'function' || typeof wire.diff !== 'function') return set({phase: 'unavailable'});
      if (errors > 0) return set({phase: 'blocked', errors});
      set({phase: 'reading'});
      const r = await call('');
      if (my !== gen) return state;
      if (!r.ok || !isObject(r.body)) return set({phase: 'error', message: readFailure(r), retry: true});
      const current = r.body;
      if (current.connected !== true) return set({phase: 'disconnected', detail: typeof current.error === 'string' ? clean(current.error) : ''});
      if (current.uidOk !== true) return set({phase: 'mismatch', identity: typeof current.identity === 'string' ? current.identity : ''});
      let target, items;
      try {
        target = wire.build(doc, current);
        items = wire.diff(current, target);
      } catch (e) {
        return set({phase: 'prepare', message: e && e.message ? clean(e.message) : 'unknown error'});
      }
      const unsupported = isObject(target) && Array.isArray(target.unsupported) ? target.unsupported : [];
      const list = Array.isArray(items) ? items : [];
      if (!list.length && !unsupported.length) return set({phase: 'same'});
      const macrosChange = list.some(it => it.kind === 'macro');
      return set({phase: 'preview', current, target, items: list, unsupported, macrosChange,
        needUnlock: macrosChange && current.unlocked !== true, canWrite: list.length > 0 && unsupported.length === 0});
    }

    // Resolves {ok: true} once unlocked, or {ok: false, cancelled|closed|message}.
    function unlock(plan) {
      return new Promise(resolve => {
        const started = now();
        let total = null;
        const wait = {timer: null, plan, finish: result => {
          if (unlockWait !== wait) return;
          if (wait.timer !== null) clearTimer(wait.timer);
          unlockWait = null;
          resolve(result);
        }};
        unlockWait = wait;
        set({phase: 'unlocking', counter: null, total: null, fraction: 0, plan});
        const step = async action => {
          const pending = call('/unlock', {action});
          unlockCall = pending;
          const r = await pending;
          if (unlockWait !== wait) return;
          if (!r.ok || !isObject(r.body)) {
            wait.finish({ok: false, message: r.status === 0 ? `The studio server didn\u2019t answer while unlocking (${clean(r.network)}). Nothing was written.`
              : `Unlocking failed: ${errorText(r) || `the server answered ${r.status}`}. Nothing was written.`});
            return;
          }
          const b = r.body;
          if (b.unlocked === true) {
            // Unlocked by the very first answer means it already was; the studio didn't unlock it.
            if (action === 'start') mustLock = false;
            wait.finish({ok: true});
            return;
          }
          if (action === 'poll' && b.inProgress !== true) {
            wait.finish({ok: false, message: 'The keyboard ended the unlock before it finished. Nothing was written; try again and keep B and J held until the bar fills.'});
            return;
          }
          if (now() - started > unlockLimitMs) {
            wait.finish({ok: false, message: 'The keyboard wasn\u2019t unlocked within a minute. Nothing was written.'});
            return;
          }
          const counter = Number.isInteger(b.counter) && b.counter >= 0 ? b.counter : null;
          if (counter !== null && (total === null || counter > total)) total = counter;
          set({phase: 'unlocking', counter, total, fraction: total ? (total - counter) / total : 0, plan});
          wait.timer = setTimer(() => { wait.timer = null; step('poll'); }, pollMs);
        };
        mustLock = true;
        step('start');
      });
    }

    async function send(plan, retried) {
      set({phase: 'writing', count: plan.items.length});
      const r = await call('/write', writeBody(plan.target, plan.items));
      if (r.ok && isObject(r.body) && r.body.ok === true) {
        const lock = await relock();
        return set(Object.assign({phase: 'done', count: plan.items.length, written: r.body.written || {},
          backup: typeof r.body.backup === 'string' ? r.body.backup : ''}, lock));
      }
      if (r.status === 409 && isObject(r.body) && r.body.needUnlock === true && !retried) {
        const u = await unlock(plan);
        if (closed) return state;
        if (!u.ok) return settleUnlock(plan, u);
        return send(plan, true);
      }
      const lock = await relock();
      return set(Object.assign({phase: 'failed', retry: true}, writeFailure(r, retried), lock));
    }

    async function settleUnlock(plan, u) {
      const lock = await relock();
      if (u.cancelled) return set(Object.assign({}, plan, {notice: 'Unlock cancelled. Nothing was written.', lockError: lock.lockError}));
      return set(Object.assign({phase: 'failed', retry: true, message: u.message}, lock));
    }

    async function write() {
      if (closed || state.phase !== 'preview' || !state.canWrite) return state;
      const plan = Object.assign({}, state, {notice: null, lockError: null});
      if (plan.needUnlock) {
        const u = await unlock(plan);
        if (closed) return state;
        if (!u.ok) return settleUnlock(plan, u);
      }
      return send(plan, false);
    }

    function cancelUnlock() {
      if (unlockWait) unlockWait.finish({ok: false, cancelled: true});
    }

    const canClose = () => state.phase !== 'writing';

    // Closing during an unlock (or after the studio unlocked) sends "lock"; resolves with its outcome.
    function close() {
      if (!canClose()) return null;
      gen++;
      if (unlockWait) unlockWait.finish({ok: false, closed: true});
      set({phase: 'closed'});
      closed = true;
      return relock();
    }

    return {read, write, cancelUnlock, close, canClose, get state() { return state; }};
  }

  /* ---------- studio naming ---------- */
  function shortLegend(legend, code) {
    if (!legend || legend.unknown || legend.kind === 'raw') return String(code);
    if (legend.hold && legend.hold.text) return `${legend.main} hold ${legend.hold.text}`;
    if ((legend.kind === 'layer' || legend.kind === 'modifier') && legend.detail && legend.detail !== legend.code) return legend.detail;
    return legend.main || String(code);
  }
  function settingName(qsid) {
    const tabs = KS.QMK_SETTINGS && Array.isArray(KS.QMK_SETTINGS.tabs) ? KS.QMK_SETTINGS.tabs : [];
    const id = Number(qsid);
    const hits = [];
    for (const tab of tabs) for (const f of tab.fields || []) if (f.qsid === id) hits.push({tab: tab.name, title: f.title});
    if (hits.length === 1) return hits[0].title;
    if (hits.length > 1) return hits[0].tab;
    return `Setting ${qsid}`;
  }
  function studioNames() {
    const S = A.state;
    return {
      layerName: n => S.layerName(n),
      keyName: (row, col) => S.keyName(row, col),
      encoderName: i => { const e = ((KS.board && KS.board.encoders) || []).find(x => x.index === i); return e ? e.label : `Encoder ${i}`; },
      settingName,
      describe: code => shortLegend(S.legendFor(code), code)
    };
  }

  const served = loc => !!loc && /^https?:$/.test(loc.protocol || '');

  /* ---------- dialog ---------- */
  let active = null;

  function open() {
    if (active) return active;
    const {h} = A.dom;
    const S = A.state;
    const returnFocus = document.activeElement;
    const titleId = A.dom.id('kb-title');
    const title = h('h2', {id: titleId, class: 'dialog-title', tabindex: '-1', text: 'Write to keyboard'});
    const live = h('p', {class: 'visually-hidden', role: 'status', 'aria-live': 'polite'});
    const body = h('div', {class: 'kb-body'});
    const actions = h('div', {class: 'dialog-actions'});
    const dlg = h('dialog', {class: 'dialog kb-dialog', 'aria-labelledby': titleId, 'data-kb-phase': 'idle'}, title, live, body, actions);
    const names = studioNames();
    let lastPhase = null, progressEl = null, progressText = null, unlockBox = null;

    const errorCount = S.issues().filter(i => i.severity === 'error').length;
    const flow = createFlow({fetch: globalThis.fetch.bind(globalThis), wire: KS.wire, doc: S.ws().doc, errors: errorCount, onChange: paint});

    function finish() {
      const pending = flow.close();
      if (pending === null) return;
      dlg.close();
      dlg.remove();
      active = null;
      // A finished write re-renders the header, which replaces the button that opened the dialog.
      const back = returnFocus && returnFocus.isConnected ? returnFocus : document.querySelector('[data-fid="write-keyboard"]');
      if (back) back.focus();
      pending.then(lock => {
        if (lock && lock.lockError) { S.setMessage(`The keyboard couldn\u2019t be locked again (${lock.lockError}). Unplug it and plug it back in to lock it.`, 'alert'); S.render(); }
      });
    }

    const button = (label, onClick, opts = {}) => h('button', {type: 'button', class: ['button', opts.primary && 'button-primary', opts.quiet && 'button-quiet'],
      text: label, disabled: !!opts.disabled, 'data-kb-action': opts.id || null, on: {click: onClick}});
    const para = (text, cls) => h('p', {class: cls || 'dialog-text', text});
    const closeButton = (primary, label) => button(label || 'Close', finish, {primary, quiet: !primary, id: 'close'});
    const retryButton = label => button(label || 'Try again', () => flow.read(), {primary: true, id: 'retry'});

    function changeList(items) {
      return h('ul', {class: 'kb-list'}, items.map(it => h('li', {class: 'kb-item', title: it.raw},
        h('span', {class: 'kb-place', text: it.label}),
        h('span', {class: 'kb-change'},
          h('span', {class: 'kb-from', text: it.from}),
          h('span', {class: 'kb-arrow', 'aria-hidden': 'true', text: '\u2192'}),
          h('span', {class: 'visually-hidden', text: ' becomes '}),
          h('span', {class: 'kb-to', text: it.to})))));
    }
    function groupsView(items) {
      return h('div', {class: 'kb-groups', tabindex: '0', role: 'region', 'aria-label': 'Changes to write'}, groupChanges(items, names).map(g => {
        const gid = A.dom.id('kb-group');
        return h('section', {class: 'kb-group', 'aria-labelledby': gid},
          h('h3', {id: gid, class: 'kb-group-title'}, h('span', {text: g.title}), h('span', {class: 'kb-group-count', text: String(g.count)})),
          g.layers ? g.layers.map(L => h('div', {class: 'kb-layer'},
            h('h4', {class: 'kb-layer-title'}, h('span', {class: 'layer-swatch', style: {'--layer': S.layerColor(L.layer)}, 'aria-hidden': 'true'}), h('span', {text: L.title})),
            changeList(L.items))) : changeList(g.items));
      }));
    }
    function unsupportedView(list) {
      return h('div', {class: 'notice notice-danger kb-unsupported', role: 'alert'},
        h('p', {class: 'kb-notice-title', text: `${plural(list.length, 'item', 'items')} can\u2019t be written to the keyboard, so Write stays off:`}),
        h('ul', {class: 'kb-unsupported-list'}, list.map(u => h('li', {},
          u.path ? h('span', {class: 'mono', text: String(u.path)}) : null, u.path ? ': ' : null,
          `${clean(u.message || 'not supported')}${u.code !== undefined && u.code !== null ? ` (${u.code})` : ''}.`))));
    }
    function unlockView(st) {
      progressEl = h('progress', {class: 'kb-progress', max: '100', value: String(Math.round(st.fraction * 100)), 'aria-labelledby': 'kb-unlock-label'});
      progressText = h('p', {class: 'hint kb-progress-text'});
      unlockBox = h('div', {class: 'kb-unlock'},
        h('div', {class: 'kb-caps', 'aria-hidden': 'true'}, h('span', {class: 'kb-cap', text: 'B'}), h('span', {class: 'kb-plus', text: '+'}), h('span', {class: 'kb-cap', text: 'J'})),
        h('p', {class: 'kb-unlock-title', id: 'kb-unlock-label', text: 'Hold B and J until the bar fills'}),
        progressEl, progressText);
      updateProgress(st);
      return [unlockBox,
      para('Macros can only be changed while the keyboard is unlocked. B is on the left half and J on the right; letting go starts the count again. The studio locks the keyboard again after writing.', 'hint')];
    }
    function updateProgress(st) {
      if (!progressEl) return;
      const pct = Math.round(st.fraction * 100);
      progressEl.value = pct;
      unlockBox.classList.toggle('is-held', pct > 0);
      progressText.textContent = st.counter === null ? 'Waiting for the keyboard\u2026' : (pct > 0 ? `${pct}%, keep holding` : 'Press and hold both keys now');
    }

    function view(st) {
      switch (st.phase) {
        case 'reading': return {text: 'Reading the keyboard\u2026', busy: true, nodes: [para('Reading the keyboard\u2026', 'dialog-text kb-busy')], actions: [closeButton(false, 'Cancel')]};
        case 'unavailable': return {text: 'Writing isn\u2019t available', nodes: [para('Writing isn\u2019t available: src/core/wire.js didn\u2019t load, so the studio can\u2019t turn the keymap into keyboard data. Reload the page; if it stays, the keymap-studio folder is incomplete.')],
          actions: [closeButton(true)]};
        case 'blocked': return {text: 'Fix errors first', nodes: [para(`Fix ${plural(st.errors, 'error', 'errors')} before writing to the keyboard. The issues list shows where.`)],
          actions: [closeButton(false), button('Show issues', () => { finish(); A.shell.openIssues(); }, {primary: true, id: 'issues'})]};
        case 'error': return {text: 'Couldn\u2019t read the keyboard', nodes: [para(st.message)], actions: [closeButton(false), retryButton()]};
        case 'disconnected': return {text: 'No keyboard connected', nodes: [
          h('p', {class: 'kb-lead', text: 'No Kyria half is connected.'}),
          para('Plug one half in with its USB cable the normal way, not in flash (bootloader) mode, then try again.'),
          st.detail ? para(`The server said: ${st.detail}.`, 'hint') : null], actions: [closeButton(false), retryButton()]};
        case 'mismatch': return {text: 'Different keyboard', nodes: [
          h('p', {class: 'kb-lead', text: 'This isn\u2019t the keyboard this keymap belongs to.'}),
          para('Its Vial identity doesn\u2019t match the Kyria uid, so the studio won\u2019t write to it. Nothing was changed.'),
          st.identity ? h('p', {class: 'hint'}, 'Identity: ', h('span', {class: 'mono', text: st.identity})) : null], actions: [closeButton(true)]};
        case 'prepare': return {text: 'Couldn\u2019t prepare the keymap', nodes: [para(`The keymap couldn\u2019t be turned into keyboard data: ${st.message}. Nothing was written.`)], actions: [closeButton(false), retryButton('Read again')]};
        case 'same': return {text: 'No changes', nodes: [h('p', {class: 'kb-lead', text: 'No changes: the keyboard already matches.'}),
          para('The whole keyboard, both halves, already uses this keymap.', 'hint')], actions: [closeButton(true)]};
        case 'preview': {
          const n = st.items.length;
          return {text: `${plural(n, 'change', 'changes')} to write`, nodes: [
            h('p', {class: 'kb-count', text: n ? plural(n, 'change', 'changes') : 'Nothing writable'}),
            para('This updates the whole keyboard, both halves. Only if you later move the USB cable to the other half, write once more.', 'hint kb-half'),
            st.notice ? para(st.notice, 'notice') : null,
            st.lockError ? h('p', {class: 'notice notice-danger', role: 'alert', text: `The keyboard couldn\u2019t be locked again (${st.lockError}).`}) : null,
            st.needUnlock && st.canWrite ? para('Macros change, so the keyboard has to be unlocked first: you\u2019ll hold B and J for about five seconds.', 'notice notice-warning') : null,
            st.unsupported.length ? unsupportedView(st.unsupported) : null,
            n ? groupsView(st.items) : null],
          actions: [closeButton(false, 'Cancel'), button('Write to keyboard', () => flow.write(), {primary: true, disabled: !st.canWrite, id: 'write'})]};
        }
        case 'unlocking': return {text: 'Hold B and J to unlock', nodes: unlockView(st), actions: [button('Cancel', () => flow.cancelUnlock(), {id: 'cancel-unlock'})]};
        case 'writing': return {text: `Writing ${plural(st.count, 'change', 'changes')}\u2026`, busy: true,
          nodes: [para(`Writing ${plural(st.count, 'change', 'changes')} and reading each one back\u2026`, 'dialog-text kb-busy'), para('Keep the keyboard plugged in.', 'hint')],
          actions: [button('Close', () => {}, {disabled: true, id: 'close'})]};
        case 'done': {
          const parts = writtenSummary(st.written);
          return {text: 'Written to the keyboard', nodes: [
            h('p', {class: 'kb-lead kb-ok', text: 'Written to the keyboard.'}),
            para(parts.length ? `Written and read back: ${parts.join(', ')}.` : 'The server wrote and read back every change.'),
            st.backup ? h('p', {class: 'dialog-text'}, 'The keyboard\u2019s previous state is saved in ', h('span', {class: 'mono kb-path', text: st.backup}), '.') : null,
            st.relocked ? para('The keyboard is locked again.', 'hint') : null,
            st.lockError ? h('p', {class: 'notice notice-danger', role: 'alert', text: `The keyboard couldn\u2019t be locked again (${st.lockError}). Unplug it and plug it back in to lock it.`}) : null,
            para('Only the connected half has the new keymap. Plug in the other half and write again to update it too.', 'hint')],
          actions: [closeButton(true)]};
        }
        case 'failed': return {text: 'Write failed', nodes: [
          h('p', {class: 'kb-lead kb-bad', text: st.partial ? 'The write didn\u2019t finish.' : 'Nothing was written.'}),
          h('p', {class: 'dialog-text', role: 'alert', text: st.message}),
          st.relocked ? para('The keyboard is locked again.', 'hint') : null,
          st.lockError ? h('p', {class: 'notice notice-danger', text: `The keyboard couldn\u2019t be locked again (${st.lockError}). Unplug it and plug it back in to lock it.`}) : null],
        actions: [closeButton(false), retryButton('Read again')]};
        default: return {text: '', nodes: [], actions: [closeButton(true)]};
      }
    }

    function paint(st) {
      if (st.phase === 'closed' || !dlg.isConnected) return;
      dlg.setAttribute('data-kb-phase', st.phase);
      if (st.phase === 'unlocking' && lastPhase === 'unlocking') { updateProgress(st); return; }
      if (st.phase === 'done') {
        S.setMessage(`Wrote ${plural(st.count, 'change', 'changes')} to the keyboard${st.backup ? `; previous state saved in ${st.backup}` : ''}.`, 'status');
        S.render();
      }
      lastPhase = st.phase;
      progressEl = null;
      const v = view(st);
      if (v.busy) body.setAttribute('aria-busy', 'true'); else body.removeAttribute('aria-busy');
      A.dom.clear(body).append(...v.nodes.flat().filter(Boolean));
      A.dom.clear(actions).append(...v.actions);
      live.textContent = v.text;
      const primary = actions.querySelector('.button-primary:not(:disabled)') || actions.querySelector('button:not(:disabled)');
      (primary || title).focus();
    }

    dlg.addEventListener('cancel', e => {
      e.preventDefault();
      if (flow.state.phase === 'unlocking') { flow.cancelUnlock(); return; }
      if (flow.canClose()) finish();
    });
    document.body.append(dlg);
    dlg.showModal();
    active = dlg;
    flow.read();
    return dlg;
  }

  A.keyboard = {API, POLL_MS, groupChanges, itemLabel, writeBody, writtenSummary, createFlow, shortLegend, settingName, studioNames, served, open,
    available: () => !!(KS.wire && typeof KS.wire.build === 'function' && typeof KS.wire.diff === 'function')};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
