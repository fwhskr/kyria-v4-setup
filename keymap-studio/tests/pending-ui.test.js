'use strict';
// Changes not on the keyboard yet (.nova/contract-pending.md, UI): the cached keyboard state, the header
// status, the board legend and the discard plan. KS.wire.pending/revert belong to another module, so a
// stand-in that follows the contract's shapes compares the doc with a layout carried in `current`.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const KS = require('./load-core.js');

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
for (const file of ['src/app/dom.js', 'src/app/project.js', 'src/app/store.js', 'src/app/keyboard.js', 'src/app/board.js']) require(path.join(__dirname, '..', file));
const A = KS.app;
const K = A.keyboard;
const START = KS.workspace.fromDefault();
A.store.hist = KS.history.create(START);

const clone = (v) => JSON.parse(JSON.stringify(v));

// Keyboard state whose layout differs from the built-in doc at the given cells.
function keyboardWith(changes) {
  const layout = clone(START.doc.fields.layout);
  for (const [l, r, c, code] of changes) layout[l][r][c] = code;
  return { connected: true, uidOk: true, layers: layout.length, rows: 10, cols: 7, layout };
}

function stubWire({ skip = () => null } = {}) {
  const calls = { pending: 0 };
  function pending(doc, current) {
    calls.pending++;
    const items = [], keys = {}, layers = doc.fields.layout.map(() => 0);
    doc.fields.layout.forEach((rows, l) => rows.forEach((cells, r) => cells.forEach((to, c) => {
      const from = current.layout[l][r][c];
      if (to === -1 || from === to) return;
      items.push({ kind: 'key', layer: l, row: r, col: c, from, to });
      keys[`${l}:${r}:${c}`] = { from, to };
      layers[l]++;
    })));
    return { count: items.length, items, keys, encoders: {}, layers, unsupported: [] };
  }
  function revert(doc, current) {
    const ops = [], skipped = [];
    for (const it of pending(doc, current).items) {
      const why = skip(it);
      if (why) skipped.push({ path: `layout[${it.layer}][${it.row}][${it.col}]`, reason: why });
      else ops.push({ type: 'key.set', layer: it.layer, row: it.row, col: it.col, code: it.from });
    }
    return { ops, skipped };
  }
  return { pending, revert, build() {}, diff() {}, calls };
}

function server(answers) {
  const log = [];
  const queue = answers.slice();
  const fetch = async (url, init) => {
    log.push(`${init.method} ${url}`);
    const r = queue.length > 1 ? queue.shift() : queue[0];
    if (r.network) throw new TypeError(r.network);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json };
  };
  return { fetch, log };
}

// Cells where the built-in layout has other codes (LSFT_T(KC_T), KC_U, KC_NO).
const DIFFERENT = [[0, 1, 2, 'KC_T'], [0, 5, 3, 'KC_I'], [3, 0, 1, 'KC_W']];

function setup(answers, wire = stubWire()) {
  let doc = START.doc;
  const changes = [];
  const srv = server(answers);
  const sync = K.createSync({ fetch: srv.fetch, wire, getDoc: () => doc, onChange: (s) => changes.push(s.phase + (s.checking ? '+' : '')) });
  return { sync, srv, wire, changes, setDoc: (d) => { doc = d; } };
}

describe('keyboard state cache', () => {
  it('reads GET /api/keyboard once and marks exactly the differing cells', async () => {
    const t = setup([{ status: 200, json: keyboardWith(DIFFERENT) }]);
    assert.equal(t.sync.view().phase, 'idle');
    await t.sync.check();
    assert.deepEqual(t.srv.log, ['GET /api/keyboard']);
    const v = t.sync.view();
    assert.equal(v.phase, 'ready');
    assert.deepEqual(Object.keys(v.keys).sort(), ['0:1:2', '0:5:3', '3:0:1']);
    assert.equal(v.keys['0:1:2'].from, 'KC_T');
    assert.deepEqual(v.layers.slice(0, 4), [2, 0, 0, 1]);
    assert.deepEqual(t.changes, ['checking+', 'ready']);
    assert.equal(K.syncStatus(v).text, '3 changes not on the keyboard yet');
    assert.equal(K.syncStatus(v).tone, 'pending');
  });

  it('recomputes on every edit from the cached read, without reading the keyboard again', async () => {
    const t = setup([{ status: 200, json: keyboardWith(DIFFERENT) }]);
    await t.sync.check();
    const first = t.sync.view();
    assert.equal(t.sync.view(), first, 'same doc and same read give the cached view');
    const current = keyboardWith(DIFFERENT);
    const edited = KS.workspace.apply(START, { type: 'key.set', layer: 0, row: 1, col: 2, code: current.layout[0][1][2] });
    t.setDoc(edited.doc);
    const v = t.sync.view();
    assert.equal(v.count, 2);
    assert.equal(v.keys['0:1:2'], undefined, 'the key edited to the keyboard value is no longer marked');
    const another = KS.workspace.apply(edited, { type: 'key.set', layer: 2, row: 0, col: 1, code: 'KC_F13' });
    t.setDoc(another.doc);
    assert.equal(t.sync.view().count, 3);
    assert.equal(t.sync.view().keys['2:0:1'].to, 'KC_F13');
    assert.deepEqual(t.srv.log, ['GET /api/keyboard']);
  });

  it('says the keyboard matches when nothing differs', async () => {
    const t = setup([{ status: 200, json: keyboardWith([]) }]);
    await t.sync.check();
    assert.deepEqual(K.syncStatus(t.sync.view()), { text: 'Keyboard matches', tone: 'ok', detail: 'Everything in the keymap is on the connected keyboard.' });
  });

  it('shows no marks and "Keyboard not connected" when no keyboard is plugged in, even after a good read', async () => {
    const t = setup([{ status: 200, json: keyboardWith(DIFFERENT) }, { status: 200, json: { connected: false, error: 'no Vial device found.' } }]);
    await t.sync.check();
    assert.equal(t.sync.view().count, 3);
    await t.sync.check();
    const v = t.sync.view();
    assert.equal(v.phase, 'disconnected');
    assert.equal(v.count, 0);
    assert.deepEqual(v.keys, {});
    assert.deepEqual(v.layers, []);
    const st = K.syncStatus(v);
    assert.equal(st.text, 'Keyboard not connected');
    assert.match(st.detail, /no Vial device found\./);
  });

  it('drops the marks when the read fails or another keyboard is connected', async () => {
    const t = setup([{ status: 200, json: keyboardWith(DIFFERENT) }, { status: 404, json: null }, { status: 200, json: { connected: true, uidOk: false } }, { network: 'Failed to fetch' }]);
    await t.sync.check();
    await t.sync.check();
    assert.equal(t.sync.view().phase, 'error');
    assert.equal(t.sync.view().count, 0);
    assert.equal(K.syncStatus(t.sync.view()).text, 'Couldn\u2019t read the keyboard');
    assert.match(K.syncStatus(t.sync.view()).detail, /can\u2019t talk to the keyboard/);
    await t.sync.check();
    assert.equal(K.syncStatus(t.sync.view()).text, 'A different keyboard is connected');
    assert.deepEqual(t.sync.view().keys, {});
    await t.sync.check();
    assert.match(K.syncStatus(t.sync.view()).detail, /didn\u2019t answer \(Failed to fetch\)/);
  });

  it('keeps the previous read when the server is busy with another keyboard request', async () => {
    const t = setup([{ status: 200, json: keyboardWith(DIFFERENT) }, { status: 409, json: { error: 'busy' } }]);
    await t.sync.check();
    const before = t.sync.view().keys;
    await t.sync.check();
    assert.equal(t.sync.view().phase, 'ready');
    assert.deepEqual(t.sync.view().keys, before);
    assert.equal(t.sync.state.checking, false);
  });

  it('shares one request between overlapping checks', async () => {
    const t = setup([{ status: 200, json: keyboardWith(DIFFERENT) }]);
    const a = t.sync.check(), b = t.sync.check();
    assert.equal(a, b);
    await Promise.all([a, b, t.sync.settled()]);
    assert.equal(t.srv.log.length, 1);
  });

  it('shows the last result while checking again', async () => {
    const t = setup([{ status: 200, json: keyboardWith(DIFFERENT) }]);
    await t.sync.check();
    const again = t.sync.check();
    assert.equal(t.sync.view().phase, 'ready');
    assert.equal(t.sync.view().checking, true);
    assert.equal(t.sync.view().count, 3);
    await again;
  });

  it('never reads and says so when wire.js has no pending/revert', async () => {
    const t = setup([{ status: 200, json: keyboardWith(DIFFERENT) }], { build() {}, diff() {} });
    await t.sync.check();
    assert.equal(t.srv.log.length, 0);
    assert.equal(t.sync.view().phase, 'unavailable');
    assert.equal(K.syncStatus(t.sync.view()).text, 'Keyboard comparison isn\u2019t available');
  });

  it('reports a doc that cannot be compared instead of showing marks', async () => {
    const wire = stubWire();
    wire.pending = () => { throw new Error('Keymap dimensions differ.'); };
    const t = setup([{ status: 200, json: keyboardWith(DIFFERENT) }], wire);
    await t.sync.check();
    const v = t.sync.view();
    assert.equal(v.phase, 'compare');
    assert.deepEqual(v.keys, {});
    assert.match(K.syncStatus(v).detail, /Keymap dimensions differ:?\./);
  });
});

describe('discard unwritten changes', () => {
  const current = keyboardWith(DIFFERENT);

  it('reverts every differing cell as one undoable batch', () => {
    const plan = K.discardPlan({ wire: stubWire(), workspace: KS.workspace, ws: START, current });
    assert.equal(plan.op.type, 'batch');
    assert.equal(plan.ops.length, 3);
    assert.equal(plan.discarded, 3);
    assert.equal(K.discardLabel(plan.discarded), 'Discarded 3 unwritten changes');
    assert.equal(K.discardLabel(1), 'Discarded 1 unwritten change');
    const h1 = KS.history.commit(KS.history.create(START), plan.op);
    assert.equal(stubWire().pending(h1.present.doc, current).count, 0);
    assert.equal(h1.past.length, 1, 'one history step');
    const back = KS.history.undo(h1);
    assert.equal(stubWire().pending(back.present.doc, current).count, 3, 'undo brings every mark back');
  });

  it('lists skipped items, leaves them alone and counts only what really goes back', () => {
    const wire = stubWire({ skip: (it) => (it.layer === 3 ? 'unknown keycode 0x7E40' : null) });
    const plan = K.discardPlan({ wire, workspace: KS.workspace, ws: START, current });
    assert.equal(plan.ops.length, 2);
    assert.deepEqual(plan.skipped, [{ path: 'layout[3][0][1]', reason: 'unknown keycode 0x7E40' }]);
    assert.equal(plan.discarded, 2);
    assert.equal(plan.after.count, 1);
  });

  it('has nothing to commit when every item is skipped', () => {
    const plan = K.discardPlan({ wire: stubWire({ skip: () => 'not decodable' }), workspace: KS.workspace, ws: START, current });
    assert.equal(plan.op, null);
    assert.equal(plan.discarded, 0);
    assert.equal(plan.skipped.length, 3);
  });
});

describe('board text for unwritten changes', () => {
  const names = () => K.studioNames();

  it('names what the keyboard has, with the code when the legend differs from it', () => {
    assert.equal(K.onKeyboardText('LGUI_T(KC_T)', names()), 'On the keyboard: t hold Super (LGUI_T(KC_T))');
    assert.equal(K.onKeyboardText('0x7E40', names()), 'On the keyboard: 0x7E40');
    assert.equal(A.board.pendingText(null).label, '');
    assert.equal(A.board.pendingText({ from: 'KC_A', to: 'KC_B' }).label, '. Not on the keyboard yet. On the keyboard: a (KC_A)');
  });

  it('names both directions of an encoder pair with their legends', () => {
    const l = K.itemLabel({ kind: 'encoder', layer: 0, index: 0, from: 'KC_VOLD, KC_VOLU', to: 'KC_VOLD, KC_MUTE' }, names());
    assert.equal(l.from, `CW ${K.shortLegend(A.state.legendFor('KC_VOLD'), 'KC_VOLD')}, CCW ${K.shortLegend(A.state.legendFor('KC_VOLU'), 'KC_VOLU')}`);
    assert.doesNotMatch(l.to, /KC_/);
    assert.equal(K.itemLabel({ kind: 'encoder', layer: 0, index: 0, from: 'KC_VOLD', to: 'KC_MUTE' }, names()).from, K.shortLegend(A.state.legendFor('KC_VOLD'), 'KC_VOLD'));
  });

  it('counts this layer, all layers and changes off the board in one line', () => {
    const P = (layers, kinds) => ({ layers, items: kinds.map((kind) => ({ kind })) });
    assert.equal(A.board.legendText(P([2, 0, 1], ['key', 'key', 'key']), 0), 'Marked keys aren\u2019t on the keyboard yet: 2 on this layer, 3 on all layers.');
    assert.equal(A.board.legendText(P([2, 0], ['key', 'key']), 0), 'Marked keys aren\u2019t on the keyboard yet (2).');
    assert.equal(A.board.legendText(P([1, 0], ['key', 'macro', 'setting', 'macro']), 1),
      'Marked keys aren\u2019t on the keyboard yet: 0 on this layer, 1 on all layers. 3 more in macros and settings.');
    assert.equal(A.board.legendText(P([0, 0], ['combo']), 0), 'No key differs from the keyboard; 1 change in combos isn\u2019t on it yet.');
  });
});
