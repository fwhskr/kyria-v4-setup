'use strict';
// "Write to keyboard" dialog logic (.nova/contract-keyboard.md, Client UI): labelling and grouping
// of KS.wire.diff items, the write body, and the read/unlock/write state machine driven with an
// injected fetch and manual timers. KS.wire itself is replaced by a small stand-in here.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const KS = require('./load-core.js');

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
for (const file of ['src/app/project.js', 'src/app/store.js', 'src/app/keyboard.js']) require(path.join(__dirname, '..', file));
const A = KS.app;
const K = A.keyboard;
A.store.hist = KS.history.create(KS.workspace.fromDefault());

const names = () => K.studioNames();

describe('change labels use the studio names', () => {
  it('names a key by layer, position and legend, tap and hold included', () => {
    const l = K.itemLabel({ kind: 'key', layer: 0, row: 1, col: 2, from: 'LGUI_T(KC_T)', to: 'LSFT_T(KC_T)' }, names());
    assert.equal(l.full, 'Base, left home row, index');
    assert.equal(l.label, 'Left home row, index');
    assert.equal(l.from, 't hold Super');
    assert.equal(l.to, 't hold Shift');
  });

  it('keeps a code the studio cannot describe as its raw text', () => {
    const l = K.itemLabel({ kind: 'key', layer: 2, row: 6, col: 3, from: '0x7E40', to: 'KC_A' }, names());
    assert.equal(l.full, 'Number, right home row, middle');
    assert.equal(l.from, '0x7E40');
    assert.equal(l.to, 'a');
  });

  it('names encoders from the board, settings from the Vial settings table', () => {
    assert.equal(K.itemLabel({ kind: 'encoder', layer: 0, index: 1, from: 'KC_VOLD', to: 'KC_MUTE' }, names()).full, 'Base, halcyon module left');
    assert.equal(K.itemLabel({ kind: 'setting', qsid: 7, from: '200', to: '180' }, names()).label, 'Tapping Term');
    assert.equal(K.settingName(21), 'Magic', 'a bitfield shared by several switches is named by its tab');
    assert.equal(K.settingName(999), 'Setting 999');
  });

  it('shows empty values as "empty" and objects as JSON, never [object Object]', () => {
    const l = K.itemLabel({ kind: 'combo', index: 3, from: null, to: { keys: ['KC_A'] } }, names());
    assert.equal(l.label, 'Combo 3');
    assert.equal(l.from, 'empty');
    assert.equal(l.to, '{"keys":["KC_A"]}');
  });
});

describe('groupChanges', () => {
  const items = [
    { kind: 'setting', qsid: 7, from: '200', to: '180' },
    { kind: 'key', layer: 3, row: 0, col: 1, from: 'KC_Q', to: 'KC_W' },
    { kind: 'macro', index: 0, from: 'hi', to: 'hello' },
    { kind: 'key', layer: 0, row: 1, col: 2, from: 'KC_T', to: 'KC_Y' },
    { kind: 'alt_repeat_key', index: 1, from: 'KC_A', to: 'KC_B' },
    { kind: 'tap_dance', index: 2, from: 'a', to: 'b' },
    { kind: 'layout_options', from: '00000000', to: '00000001' },
    { kind: 'key_override', index: 0, from: 'x', to: 'y' },
    { kind: 'encoder', layer: 1, index: 0, from: 'KC_VOLD', to: 'KC_VOLU' },
    { kind: 'combo', index: 0, from: 'x', to: 'y' },
    { kind: 'key', layer: 0, row: 6, col: 2, from: 'KC_N', to: 'KC_M' },
  ];

  it('orders groups as the preview lists them and counts every item once', () => {
    const groups = K.groupChanges(items, names());
    assert.deepEqual(groups.map((g) => g.title),
      ['Keys', 'Macros', 'Tap dances', 'Combos', 'Key overrides', 'Alt repeat', 'Encoders', 'Layout options', 'Settings']);
    assert.equal(groups.reduce((n, g) => n + g.count, 0), items.length);
  });

  it('splits keys per layer in layer order, with the layer names', () => {
    const keys = K.groupChanges(items, names())[0];
    assert.deepEqual(keys.layers.map((l) => [l.layer, l.title, l.items.length]), [[0, 'Base', 2], [3, 'Symbol', 1]]);
    assert.deepEqual(keys.layers[0].items.map((i) => i.label), ['Left home row, index', 'Right home row, index']);
    assert.equal(keys.layers[0].items[0].raw, 'KC_T \u2192 KC_Y');
  });

  it('puts a kind the contract does not list under Other instead of dropping it', () => {
    const groups = K.groupChanges([{ kind: 'mystery', from: 1, to: 2 }], names());
    assert.deepEqual(groups.map((g) => [g.title, g.count, g.items[0].label]), [['Other', 1, 'mystery']]);
  });

  it('gives no groups for no changes', () => {
    assert.deepEqual(K.groupChanges([], names()), []);
  });
});

const TARGET = Object.freeze({
  keymap: 'k-new', macros: 'm-new', dynamic: [['td'], ['co'], ['ko'], ['ar']], encoders: [['e']], layoutOptions: '00000001',
  settings: { 7: 'b400', 2: '01' }, unsupported: [],
});

describe('writeBody', () => {
  it('always sends the keymap and leaves every unchanged part null', () => {
    assert.deepEqual(K.writeBody(TARGET, [{ kind: 'key', layer: 0, row: 0, col: 1 }]),
      { keymap: 'k-new', macros: null, dynamic: null, encoders: null, layoutOptions: null, settings: null });
  });

  it('sends each changed part, and only the settings that changed', () => {
    const body = K.writeBody(TARGET, [{ kind: 'macro', index: 0 }, { kind: 'combo', index: 1 }, { kind: 'encoder', layer: 0, index: 0 },
      { kind: 'layout_options' }, { kind: 'setting', qsid: 7 }]);
    assert.deepEqual(body, { keymap: 'k-new', macros: 'm-new', dynamic: TARGET.dynamic, encoders: TARGET.encoders, layoutOptions: '00000001', settings: { 7: 'b400' } });
  });

  it('sends the dynamic lists for an alt repeat change alone', () => {
    assert.equal(K.writeBody(TARGET, [{ kind: 'alt_repeat_key', index: 0 }]).dynamic, TARGET.dynamic);
  });
});

/* ---------- state machine ---------- */

const KEYBOARD = Object.freeze({
  connected: true, identity: '06000000ea1d9b8a6dce1294'.padEnd(64, '0'), uidOk: true, vialProtocol: 6, layers: 8, rows: 10, cols: 7,
  unlocked: false, keymap: 'k-old', macroSize: 795, macros: 'm-old', dynamicCounts: [32, 32, 32, 32], dynamic: [[], [], [], []],
  encoders: [], layoutOptions: '00000000', settings: {},
});
const KEY_ITEM = { kind: 'key', layer: 0, row: 1, col: 2, from: 'KC_T', to: 'LSFT_T(KC_T)' };
const MACRO_ITEM = { kind: 'macro', index: 0, from: 'hi', to: 'hello' };

// Scripted server: `routes` maps "METHOD path action" to a response or a list consumed in order.
function server(routes) {
  const log = [];
  const fetch = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    const key = `${init.method} ${url}${body && body.action ? ' ' + body.action : ''}`;
    log.push({ key, body });
    let r = routes[key];
    if (Array.isArray(r)) r = r.length > 1 ? r.shift() : r[0];
    if (typeof r === 'function') r = r(body);
    if (!r) throw new Error(`no route for ${key}`);
    if (r.network) throw new TypeError(r.network);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json };
  };
  return { fetch, log, keys: () => log.map((e) => e.key) };
}
const ok = (json) => ({ status: 200, json });

function timers() {
  const queue = [];
  return {
    setTimer: (fn, ms) => { const t = { fn, ms }; queue.push(t); return t; },
    clearTimer: (t) => { const i = queue.indexOf(t); if (i >= 0) queue.splice(i, 1); },
    queue,
    runNext() { const t = queue.shift(); if (t) t.fn(); return t; },
  };
}
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

function stubWire(items, extra = {}) {
  const calls = [];
  return {
    calls,
    build(doc, current) { calls.push('build'); return Object.assign({}, TARGET, extra, { unsupported: extra.unsupported || [] }); },
    diff(current, target) { calls.push('diff'); return items; },
  };
}

function flowWith(routes, { items = [KEY_ITEM], wire, extra, errors = 0 } = {}) {
  const srv = server(routes);
  const tm = timers();
  const states = [];
  const w = wire === undefined ? stubWire(items, extra) : wire;
  const flow = K.createFlow({ fetch: srv.fetch, wire: w, doc: { fields: {} }, errors, onChange: (s) => states.push(s), setTimer: tm.setTimer, clearTimer: tm.clearTimer });
  return { flow, srv, tm, states, wire: w, phases: () => states.map((s) => s.phase) };
}

// Runs timers and microtasks until `done()` or the step budget runs out (fails the test then).
async function drive(t, done, steps = 50) {
  for (let i = 0; i < steps; i++) {
    await settle();
    if (done()) return;
    if (!t.tm.runNext()) { await settle(); if (done()) return; }
  }
  assert.fail(`state machine stuck in ${t.flow.state.phase}`);
}

describe('reading the keyboard', () => {
  it('explains that KS.wire is missing without asking the server', async () => {
    const t = flowWith({}, { wire: null });
    await t.flow.read();
    assert.equal(t.flow.state.phase, 'unavailable');
    assert.deepEqual(t.srv.keys(), []);
  });

  it('refuses to read while the keymap has validation errors', async () => {
    const t = flowWith({}, { errors: 2 });
    await t.flow.read();
    assert.deepEqual([t.flow.state.phase, t.flow.state.errors], ['blocked', 2]);
    assert.deepEqual(t.srv.keys(), []);
  });

  it('shows not connected with the server detail, and Retry reads again', async () => {
    const t = flowWith({ 'GET /api/keyboard': [ok({ connected: false, error: 'no Vial device found.' }), ok(KEYBOARD)] });
    await t.flow.read();
    assert.deepEqual([t.flow.state.phase, t.flow.state.detail], ['disconnected', 'no Vial device found']);
    await t.flow.read();
    assert.equal(t.flow.state.phase, 'preview');
    assert.deepEqual(t.phases(), ['reading', 'disconnected', 'reading', 'preview']);
  });

  it('refuses a keyboard whose uid does not match, before building anything', async () => {
    const t = flowWith({ 'GET /api/keyboard': ok(Object.assign({}, KEYBOARD, { uidOk: false })) });
    await t.flow.read();
    assert.equal(t.flow.state.phase, 'mismatch');
    assert.equal(t.flow.state.identity, KEYBOARD.identity);
    assert.deepEqual(t.wire.calls, []);
  });

  it('reports an unreachable server and a server error as errors, not as not connected', async () => {
    const t = flowWith({ 'GET /api/keyboard': [{ network: 'Failed to fetch' }, { status: 403, json: { error: 'Forbidden host' } }] });
    await t.flow.read();
    assert.equal(t.flow.state.phase, 'error');
    assert.match(t.flow.state.message, /didn’t answer \(Failed to fetch\)/);
    await t.flow.read();
    assert.match(t.flow.state.message, /answered 403: Forbidden host/);
  });

  it('says "no changes" when the keyboard already matches', async () => {
    const t = flowWith({ 'GET /api/keyboard': ok(KEYBOARD) }, { items: [] });
    await t.flow.read();
    assert.equal(t.flow.state.phase, 'same');
  });

  it('lists unsupported items and keeps Write off, even with changes', async () => {
    const unsupported = [{ path: 'layout[0][1][2]', code: 'QK_FOO', message: 'not a Vial keycode' }];
    const t = flowWith({ 'GET /api/keyboard': ok(KEYBOARD) }, { extra: { unsupported } });
    await t.flow.read();
    assert.equal(t.flow.state.phase, 'preview');
    assert.equal(t.flow.state.canWrite, false);
    assert.deepEqual(t.flow.state.unsupported, unsupported);
    await t.flow.write();
    assert.deepEqual(t.srv.keys(), ['GET /api/keyboard'], 'nothing is posted while unsupported items exist');
  });

  it('turns a KS.wire failure into a visible prepare error', async () => {
    const wire = { build() { throw Object.assign(new Error('macro M3 does not fit.'), { code: 'E_WIRE_UNSUPPORTED' }); }, diff() { return []; } };
    const t = flowWith({ 'GET /api/keyboard': ok(KEYBOARD) }, { wire });
    await t.flow.read();
    assert.deepEqual([t.flow.state.phase, t.flow.state.message], ['prepare', 'macro M3 does not fit']);
  });
});

const WRITE_OK = ok({ ok: true, written: { keymap: 1, macros: 2, dynamic: 0, encoders: 0, layoutOptions: 0, settings: 0 }, backup: 'backups/before-write/20261122-101500.json' });

describe('writing', () => {
  it('writes key changes straight away when macros are unchanged, without unlocking', async () => {
    const t = flowWith({ 'GET /api/keyboard': ok(KEYBOARD), 'POST /api/keyboard/write': WRITE_OK });
    await t.flow.read();
    await t.flow.write();
    assert.deepEqual(t.srv.keys(), ['GET /api/keyboard', 'POST /api/keyboard/write']);
    assert.deepEqual(t.srv.log[1].body, { keymap: 'k-new', macros: null, dynamic: null, encoders: null, layoutOptions: null, settings: null });
    assert.equal(t.flow.state.phase, 'done');
    assert.equal(t.flow.state.backup, 'backups/before-write/20261122-101500.json');
  });

  it('unlocks a locked keyboard for a macro change, polling every 120 ms, then writes and locks again', async () => {
    const t = flowWith({
      'GET /api/keyboard': ok(KEYBOARD),
      'POST /api/keyboard/unlock start': ok({ unlocked: false, inProgress: true, counter: 50 }),
      'POST /api/keyboard/unlock poll': [ok({ unlocked: false, inProgress: true, counter: 50 }), ok({ unlocked: false, inProgress: true, counter: 25 }),
        ok({ unlocked: true, inProgress: false, counter: 0 })],
      'POST /api/keyboard/write': WRITE_OK,
      'POST /api/keyboard/unlock lock': ok({ unlocked: false, inProgress: false, counter: 0 }),
    }, { items: [KEY_ITEM, MACRO_ITEM] });
    await t.flow.read();
    assert.equal(t.flow.state.needUnlock, true);
    const done = t.flow.write();
    const delays = [];
    const origRun = t.tm.runNext;
    t.tm.runNext = () => { if (t.tm.queue[0]) delays.push(t.tm.queue[0].ms); return origRun(); };
    await drive(t, () => t.flow.state.phase === 'done');
    await done;
    assert.deepEqual(t.srv.keys(), ['GET /api/keyboard', 'POST /api/keyboard/unlock start', 'POST /api/keyboard/unlock poll',
      'POST /api/keyboard/unlock poll', 'POST /api/keyboard/unlock poll', 'POST /api/keyboard/write', 'POST /api/keyboard/unlock lock']);
    assert.deepEqual(delays, [120, 120, 120]);
    const progress = t.states.filter((s) => s.phase === 'unlocking').map((s) => s.fraction);
    assert.deepEqual(progress, [0, 0, 0, 0.5]);
    assert.equal(t.srv.log[5].body.macros, 'm-new');
    assert.equal(t.flow.state.relocked, true);
    assert.equal(t.flow.state.lockError, null);
  });

  it('Cancel during the unlock sends lock, writes nothing and returns to the preview', async () => {
    const t = flowWith({
      'GET /api/keyboard': ok(KEYBOARD),
      'POST /api/keyboard/unlock start': ok({ unlocked: false, inProgress: true, counter: 50 }),
      'POST /api/keyboard/unlock poll': ok({ unlocked: false, inProgress: true, counter: 40 }),
      'POST /api/keyboard/unlock lock': ok({ unlocked: false, inProgress: false, counter: 50 }),
    }, { items: [MACRO_ITEM] });
    await t.flow.read();
    const p = t.flow.write();
    await drive(t, () => t.states.some((s) => s.phase === 'unlocking' && s.counter === 40));
    t.flow.cancelUnlock();
    await p;
    assert.equal(t.flow.state.phase, 'preview');
    assert.match(t.flow.state.notice, /Unlock cancelled/);
    assert.equal(t.tm.queue.length, 0, 'no poll is left scheduled');
    const keys = t.srv.keys();
    assert.equal(keys[keys.length - 1], 'POST /api/keyboard/unlock lock');
    assert.ok(!keys.includes('POST /api/keyboard/write'));
  });

  it('closing during the unlock stops polling and sends lock', async () => {
    const t = flowWith({
      'GET /api/keyboard': ok(KEYBOARD),
      'POST /api/keyboard/unlock start': ok({ unlocked: false, inProgress: true, counter: 50 }),
      'POST /api/keyboard/unlock lock': ok({ unlocked: false, inProgress: false, counter: 50 }),
    }, { items: [MACRO_ITEM] });
    await t.flow.read();
    const p = t.flow.write();
    await settle();
    assert.equal(t.flow.state.phase, 'unlocking');
    const lock = await t.flow.close();
    await p;
    assert.deepEqual(lock, { lockError: null, relocked: true });
    assert.equal(t.tm.queue.length, 0);
    assert.deepEqual(t.srv.keys(), ['GET /api/keyboard', 'POST /api/keyboard/unlock start', 'POST /api/keyboard/unlock lock']);
  });

  it('does not lock a keyboard that was already unlocked when the studio asked', async () => {
    const t = flowWith({
      'GET /api/keyboard': ok(KEYBOARD),
      'POST /api/keyboard/unlock start': ok({ unlocked: true, inProgress: false, counter: 0 }),
      'POST /api/keyboard/write': WRITE_OK,
    }, { items: [MACRO_ITEM] });
    await t.flow.read();
    await t.flow.write();
    await drive(t, () => t.flow.state.phase === 'done');
    assert.deepEqual(t.srv.keys(), ['GET /api/keyboard', 'POST /api/keyboard/unlock start', 'POST /api/keyboard/write']);
  });

  it('fails visibly when the keyboard ends the unlock, and locks again', async () => {
    const t = flowWith({
      'GET /api/keyboard': ok(KEYBOARD),
      'POST /api/keyboard/unlock start': ok({ unlocked: false, inProgress: true, counter: 50 }),
      'POST /api/keyboard/unlock poll': ok({ unlocked: false, inProgress: false, counter: 50 }),
      'POST /api/keyboard/unlock lock': ok({ unlocked: false, inProgress: false, counter: 50 }),
    }, { items: [MACRO_ITEM] });
    await t.flow.read();
    t.flow.write();
    await drive(t, () => t.flow.state.phase === 'failed');
    assert.match(t.flow.state.message, /ended the unlock/);
    assert.equal(t.flow.state.relocked, true);
    assert.ok(!t.srv.keys().includes('POST /api/keyboard/write'));
  });

  it('shows a readback error as failed, never as success, and still locks again', async () => {
    const t = flowWith({
      'GET /api/keyboard': ok(KEYBOARD),
      'POST /api/keyboard/unlock start': ok({ unlocked: false, inProgress: true, counter: 1 }),
      'POST /api/keyboard/unlock poll': ok({ unlocked: true, inProgress: false, counter: 0 }),
      'POST /api/keyboard/write': { status: 500, json: { error: 'readback mismatch in keymap block 3' } },
      'POST /api/keyboard/unlock lock': ok({ unlocked: false, inProgress: false, counter: 50 }),
    }, { items: [MACRO_ITEM] });
    await t.flow.read();
    t.flow.write();
    await drive(t, () => t.flow.state.phase === 'failed');
    assert.equal(t.flow.state.partial, true);
    assert.match(t.flow.state.message, /readback mismatch in keymap block 3/);
    assert.equal(t.srv.keys().at(-1), 'POST /api/keyboard/unlock lock');
    assert.ok(!t.states.some((s) => s.phase === 'done'));
  });

  it('never claims success on a 200 without ok: true', async () => {
    const t = flowWith({ 'GET /api/keyboard': ok(KEYBOARD), 'POST /api/keyboard/write': ok({ written: {} }) });
    await t.flow.read();
    await t.flow.write();
    assert.equal(t.flow.state.phase, 'failed');
    assert.match(t.flow.state.message, /didn’t confirm/);
  });

  it('tells busy and refused writes apart from partial ones', async () => {
    const t = flowWith({ 'GET /api/keyboard': ok(KEYBOARD), 'POST /api/keyboard/write': [{ status: 409, json: { error: 'busy' } }, { status: 409, json: { error: 'layer count differs' } }] });
    await t.flow.read();
    await t.flow.write();
    assert.match(t.flow.state.message, /busy with another request/);
    assert.notEqual(t.flow.state.partial, true);
    await t.flow.read();
    await t.flow.write();
    assert.equal(t.flow.state.message, 'Nothing was written: layer count differs.');
  });

  it('unlocks and retries once when the server answers needUnlock', async () => {
    const unlockedBoard = Object.assign({}, KEYBOARD, { unlocked: true });
    const t = flowWith({
      'GET /api/keyboard': ok(unlockedBoard),
      'POST /api/keyboard/write': [{ status: 409, json: { error: 'keyboard is locked', needUnlock: true } }, WRITE_OK],
      'POST /api/keyboard/unlock start': ok({ unlocked: false, inProgress: true, counter: 1 }),
      'POST /api/keyboard/unlock poll': ok({ unlocked: true, inProgress: false, counter: 0 }),
      'POST /api/keyboard/unlock lock': ok({ unlocked: false, inProgress: false, counter: 50 }),
    }, { items: [MACRO_ITEM] });
    await t.flow.read();
    assert.equal(t.flow.state.needUnlock, false);
    t.flow.write();
    await drive(t, () => t.flow.state.phase === 'done');
    assert.deepEqual(t.srv.keys(), ['GET /api/keyboard', 'POST /api/keyboard/write', 'POST /api/keyboard/unlock start',
      'POST /api/keyboard/unlock poll', 'POST /api/keyboard/write', 'POST /api/keyboard/unlock lock']);
  });

  it('cannot be closed while the write is in flight', async () => {
    let release;
    const t = flowWith({ 'GET /api/keyboard': ok(KEYBOARD) });
    await t.flow.read();
    const srv2 = server({ 'POST /api/keyboard/write': WRITE_OK });
    // Hold the write request open to observe the writing phase.
    const t2 = K.createFlow({
      fetch: (url, init) => (init.method === 'GET' ? t.srv.fetch(url, init) : new Promise((r) => { release = () => r(srv2.fetch(url, init)); })),
      wire: stubWire([KEY_ITEM]), doc: {}, setTimer: t.tm.setTimer, clearTimer: t.tm.clearTimer,
    });
    await t2.read();
    const p = t2.write();
    await settle();
    assert.equal(t2.state.phase, 'writing');
    assert.equal(t2.canClose(), false);
    assert.equal(t2.close(), null);
    release();
    await p;
    assert.equal(t2.state.phase, 'done');
  });
});

describe('written summary', () => {
  it('lists only the parts that were written', () => {
    assert.deepEqual(K.writtenSummary({ keymap: 3, macros: 1, dynamic: 2, encoders: 0, layoutOptions: 1, settings: 1 }),
      ['keymap 3 blocks', 'macros 1 block', '2 entries in tap dances, combos, overrides or alt repeat', 'layout options', '1 setting']);
    assert.deepEqual(K.writtenSummary(undefined), []);
  });
});

describe('header button placement', () => {
  it('is offered only over http', () => {
    assert.equal(K.served({ protocol: 'http:' }), true);
    assert.equal(K.served({ protocol: 'https:' }), true);
    assert.equal(K.served({ protocol: 'file:' }), false);
  });
});
