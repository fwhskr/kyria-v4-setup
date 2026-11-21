'use strict';
// Project storage: the keymap is read from and written to layouts/ through the studio server's
// /api/layout, never kept in localStorage (owner order 2026-11-21, .nova/contract.md "Client").
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KS = require('./load-core.js');

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
};
globalThis.window = { addEventListener() {} };
for (const file of ['src/app/project.js', 'src/app/store.js']) require(path.join(__dirname, '..', file));
const A = KS.app;
const P = A.project;

const LAYOUTS = path.join(__dirname, '..', '..', 'layouts');
const PROJECT_VIL = fs.readFileSync(path.join(LAYOUTS, 'kyria.vil'), 'utf8');
const PROJECT_META = JSON.parse(fs.readFileSync(path.join(LAYOUTS, 'kyria.studio.json'), 'utf8'));
const body = (meta) => ({ vil: PROJECT_VIL, meta, path: 'layouts/kyria.vil' });
const DEFAULT_NAMES = ['Base', 'Special', 'Number', 'Symbol', 'Navi', 'Media', 'Function', 'Spare'];
const DEFAULT_COLORS = ['#70b7ff', '#4dd8cc', '#83d38a', '#ffbd68', '#ba9bff', '#ffe071', '#ff8f9c', '#9daabd'];

// A key position that holds a real key (not -1) on layer 0.
function realKey(ws) {
  const layout = ws.doc.fields.layout[0];
  for (let r = 0; r < layout.length; r++) for (let c = 0; c < layout[r].length; c++) if (layout[r][c] !== -1) return { r, c };
  throw new Error('no key');
}
function noKey(ws) {
  const layout = ws.doc.fields.layout[0];
  for (let r = 0; r < layout.length; r++) for (let c = 0; c < layout[r].length; c++) if (layout[r][c] === -1) return { r, c };
  throw new Error('every position has a key');
}

const response = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json });

// Manual timers: run() fires whatever is due, so debounce is observable without waiting.
function fakeTimers() {
  let next = 1;
  const due = new Map();
  return {
    setTimer: (fn, ms) => { const id = next++; due.set(id, { fn, ms }); return id; },
    clearTimer: (id) => { due.delete(id); },
    get count() { return due.size; },
    get lastDelay() { return [...due.values()].pop()?.ms; },
    run() { const list = [...due.values()]; due.clear(); for (const t of list) t.fn(); },
  };
}
// A fetch whose answers the test releases one at a time.
function gatedFetch() {
  const calls = [];
  const fn = (url, init) => new Promise((resolve, reject) => calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null, resolve, reject }));
  return { fn, calls };
}
const settle = () => new Promise((r) => setImmediate(r));

describe('payload: workspace to PUT body', () => {
  it('sends the encoded .vil and schema 1 metadata', () => {
    const ws = P.workspaceFrom(body(PROJECT_META)).ws;
    ws.meta.layerNames[2] = 'Numbers';
    ws.meta.layerColors[2] = '#123abc';
    ws.meta.keyLabels['0:1:2'] = 'Ä';
    const out = P.payload(ws);
    assert.equal(out.vil, KS.vil.encode(ws.doc));
    assert.deepEqual(out.meta, {
      schema: 1, filename: 'kyria.vil',
      layerNames: ['Base', 'Special', 'Numbers', 'Symbol', 'Navi', 'Media', 'Function', 'Spare'],
      layerColors: DEFAULT_COLORS.map((c, i) => (i === 2 ? '#123abc' : c)),
      keyLabels: { '0:1:2': 'Ä' },
    });
    assert.notEqual(out.meta.layerNames, ws.meta.layerNames, 'payload is a copy, later edits do not leak into a queued save');
  });

  it('the project file round-trips byte for byte', () => {
    assert.equal(P.payload(P.workspaceFrom(body(PROJECT_META)).ws).vil, PROJECT_VIL);
  });
});

describe('workspaceFrom: GET body to workspace', () => {
  it('builds the workspace from the .vil and applies valid metadata', () => {
    const meta = { schema: 1, filename: 'mine.vil', layerNames: DEFAULT_NAMES.map((n) => `${n} x`), layerColors: DEFAULT_COLORS.map(() => '#ABCDEF'), keyLabels: {} };
    const probe = P.workspaceFrom(body(null)).ws;
    const k = realKey(probe);
    meta.keyLabels[`0:${k.r}:${k.c}`] = 'Hi';
    const r = P.workspaceFrom(body(meta));
    assert.equal(r.ws.filename, 'mine.vil');
    assert.deepEqual(r.ws.meta.layerNames, meta.layerNames);
    assert.deepEqual(r.ws.meta.layerColors, DEFAULT_COLORS.map(() => '#abcdef'));
    assert.deepEqual(r.ws.meta.keyLabels, { [`0:${k.r}:${k.c}`]: 'Hi' });
    assert.equal(r.path, 'layouts/kyria.vil');
    assert.equal(r.issues.filter((i) => i.code === 'W_STUDIO_META').length, 0);
    assert.equal(KS.vil.encode(r.ws.doc), PROJECT_VIL);
  });

  it('missing metadata gives kyria.vil and the default names without warnings', () => {
    const r = P.workspaceFrom({ vil: PROJECT_VIL, meta: null });
    assert.equal(r.ws.filename, 'kyria.vil');
    assert.deepEqual(r.ws.meta.layerNames, DEFAULT_NAMES);
    assert.deepEqual(r.ws.meta.layerColors, DEFAULT_COLORS);
    assert.deepEqual(r.ws.meta.keyLabels, {});
    assert.equal(r.path, 'layouts/kyria.vil');
    assert.equal(r.issues.filter((i) => i.code === 'W_STUDIO_META').length, 0);
  });

  it('metadata that does not fit the layers falls back part by part, with a warning each', () => {
    const probe = P.workspaceFrom(body(null)).ws;
    const k = realKey(probe), hole = noKey(probe);
    const r = P.workspaceFrom(body({
      schema: 1, filename: 42,
      layerNames: DEFAULT_NAMES.slice(0, 7),
      layerColors: DEFAULT_COLORS.map((c, i) => (i === 3 ? 'red' : c)),
      keyLabels: { [`0:${k.r}:${k.c}`]: 'ok', [`0:${hole.r}:${hole.c}`]: 'hole', '9:0:0': 'no layer', 'x': 'bad id', [`1:${k.r}:${k.c}`]: 'x'.repeat(25) },
    }));
    assert.equal(r.ws.filename, 'kyria.vil', 'non-string filename falls back');
    assert.deepEqual(r.ws.meta.layerNames, DEFAULT_NAMES);
    assert.deepEqual(r.ws.meta.layerColors, DEFAULT_COLORS);
    assert.deepEqual(r.ws.meta.keyLabels, { [`0:${k.r}:${k.c}`]: 'ok' });
    const warnings = r.issues.filter((i) => i.code === 'W_STUDIO_META');
    assert.equal(warnings.length, 3);
    assert.ok(warnings.every((w) => w.severity === 'warning'));
    assert.match(warnings[2].message, /^4 key labels/);
  });

  it('metadata that is not an object is ignored with a warning', () => {
    const r = P.workspaceFrom(body(['nope']));
    assert.deepEqual(r.ws.meta.layerNames, DEFAULT_NAMES);
    assert.equal(r.issues.filter((i) => i.code === 'W_STUDIO_META').length, 1);
  });

  it('a body without a readable .vil is refused', () => {
    assert.throws(() => P.workspaceFrom({ meta: null }), { code: 'E_PROJECT' });
    assert.throws(() => P.workspaceFrom({ vil: '{"not": "vial"}', meta: null }), (e) => e.code === 'E_PROJECT' && /isn’t a Vial layout/.test(e.message));
  });
});

describe('load: GET /api/layout', () => {
  it('asks the server without caching and returns the workspace', async () => {
    const calls = [];
    const r = await P.load({ fetch: async (url, init) => { calls.push({ url, init }); return response(200, body(PROJECT_META)); } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/layout');
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.cache, 'no-store');
    assert.equal(KS.vil.encode(r.ws.doc), PROJECT_VIL);
  });

  it('reports the server error and network failures', async () => {
    await assert.rejects(P.load({ fetch: async () => response(404, { error: 'layouts/kyria.vil is missing' }) }),
      (e) => e.code === 'E_PROJECT' && e.message === 'layouts/kyria.vil is missing');
    await assert.rejects(P.load({ fetch: async () => { throw new TypeError('NetworkError when attempting to fetch resource.'); } }),
      (e) => e.code === 'E_PROJECT' && /didn’t answer \(NetworkError/.test(e.message));
  });
});

describe('saver: debounced PUT, last write wins', () => {
  let timers, net, states, saver;
  beforeEach(() => {
    timers = fakeTimers();
    net = gatedFetch();
    states = [];
    saver = P.createSaver({ fetch: net.fn, delay: 300, onState: (s) => states.push(s), setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  });

  it('a burst of changes sends one PUT with the newest payload after the delay', async () => {
    saver.schedule({ vil: 'a', meta: {} });
    saver.schedule({ vil: 'b', meta: {} });
    saver.schedule({ vil: 'c', meta: {} });
    assert.equal(net.calls.length, 0, 'nothing is sent before the delay');
    assert.equal(timers.count, 1, 'one pending timer');
    assert.equal(timers.lastDelay, 300);
    timers.run();
    assert.equal(net.calls.length, 1);
    const call = net.calls[0];
    assert.equal(call.url, '/api/layout');
    assert.equal(call.init.method, 'PUT');
    assert.equal(call.init.headers['Content-Type'], 'application/json');
    assert.deepEqual(call.body, { vil: 'c', meta: {} });
    call.resolve(response(200, { ok: true, path: 'layouts/kyria.vil' }));
    await settle();
    assert.deepEqual(states.at(-1), { state: 'saved', path: 'layouts/kyria.vil' });
    assert.equal(saver.hasPending(), false);
  });

  it('changes made while a save runs go out afterwards, only the newest', async () => {
    saver.schedule({ vil: '1', meta: {} });
    timers.run();
    saver.schedule({ vil: '2', meta: {} });
    saver.schedule({ vil: '3', meta: {} });
    timers.run();
    assert.equal(net.calls.length, 1, 'never two requests at once');
    net.calls[0].resolve(response(200, { ok: true, path: 'layouts/kyria.vil' }));
    await settle();
    assert.equal(net.calls.length, 2);
    assert.deepEqual(net.calls[1].body, { vil: '3', meta: {} });
    assert.ok(!states.some((s) => s.state === 'saved'), 'not reported saved while a newer change waits');
    net.calls[1].resolve(response(200, { ok: true, path: 'layouts/kyria.vil' }));
    await settle();
    assert.equal(states.at(-1).state, 'saved');
  });

  it('a failed save is reported, kept and sent again on retry', async () => {
    saver.schedule({ vil: 'x', meta: {} });
    timers.run();
    net.calls[0].resolve(response(400, { error: 'vil is not a Vial layout' }));
    await settle();
    assert.deepEqual(states.at(-1), { state: 'error', error: 'vil is not a Vial layout' });
    assert.equal(saver.hasPending(), true, 'edits stay queued');
    saver.retry();
    assert.equal(net.calls.length, 2);
    assert.deepEqual(net.calls[1].body, { vil: 'x', meta: {} });
    net.calls[1].reject(new TypeError('Failed to fetch'));
    await settle();
    assert.equal(states.at(-1).state, 'error');
    assert.match(states.at(-1).error, /didn’t answer \(Failed to fetch\)/);
    saver.schedule({ vil: 'y', meta: {} });
    timers.run();
    assert.deepEqual(net.calls[2].body, { vil: 'y', meta: {} }, 'the next change replaces the failed one');
  });

  it('an error status without a JSON body still names the status', async () => {
    saver.schedule({ vil: 'x', meta: {} });
    timers.run();
    net.calls[0].resolve({ ok: false, status: 503, json: async () => { throw new SyntaxError('no body'); } });
    await settle();
    assert.deepEqual(states.at(-1), { state: 'error', error: 'the server answered 503' });
  });

  it('pagehide flush sends the waiting change at once with keepalive', () => {
    saver.schedule({ vil: 'late', meta: {} });
    saver.flush({ keepalive: true });
    assert.equal(timers.count, 0, 'debounce timer cancelled');
    assert.equal(net.calls.length, 1);
    assert.equal(net.calls[0].init.keepalive, true);
    assert.deepEqual(net.calls[0].body, { vil: 'late', meta: {} });
  });

  it('flush with nothing waiting sends nothing', async () => {
    assert.equal(await saver.flush({ keepalive: true }), null);
    assert.equal(net.calls.length, 0);
  });
});

describe('store: boot and save through the project', () => {
  beforeEach(() => {
    memory.clear();
    A.store.ui = A.state.defaultUi();
    A.store.baselineHash = null;
  });

  it('served over http: loads the project keymap and PUTs every committed change, nothing in localStorage', async () => {
    const puts = [];
    const fetch = async (url, init) => {
      if (init.method === 'GET') return response(200, body({ ...PROJECT_META, layerNames: DEFAULT_NAMES.map((n) => n.toUpperCase()) }));
      puts.push(JSON.parse(init.body));
      return response(200, { ok: true, path: 'layouts/kyria.vil' });
    };
    await A.state.boot({ location: { protocol: 'http:' }, fetch, window: { addEventListener() {} } });
    assert.equal(A.store.project.mode, 'server');
    assert.equal(A.store.project.path, 'layouts/kyria.vil');
    assert.equal(A.state.layerName(0), 'BASE');
    assert.equal(KS.vil.encode(A.state.ws().doc), PROJECT_VIL);

    assert.ok(A.state.commit({ type: 'meta.layerName', layer: 1, value: 'Extra' }, 'Renamed layer 1'));
    A.state.undo();
    A.state.redo();
    await A.state.flushSave();
    assert.equal(puts.length, 1, 'debounced to one PUT');
    assert.equal(puts[0].vil, PROJECT_VIL);
    assert.equal(puts[0].meta.schema, 1);
    assert.equal(puts[0].meta.filename, 'kyria.vil');
    assert.equal(puts[0].meta.layerNames[1], 'Extra');
    assert.equal(A.store.project.state, 'saved');
    assert.deepEqual([...memory.keys()], [A.state.UI_KEY], 'only view preferences are in localStorage');
    assert.ok(!memory.get(A.state.UI_KEY).includes('"doc"'));
  });

  it('a failing GET leaves the built-in layout in memory and never PUTs', async () => {
    const methods = [];
    const fetch = async (url, init) => { methods.push(init.method); return response(404, { error: 'layouts/kyria.vil is missing' }); };
    await A.state.boot({ location: { protocol: 'http:' }, fetch, window: { addEventListener() {} } });
    assert.deepEqual(A.store.project, { mode: 'memory', path: null, state: 'idle', error: 'layouts/kyria.vil is missing', reason: 'load' });
    assert.equal(KS.vil.encode(A.state.ws().doc), KS.vil.encode(KS.workspace.fromDefault().doc));
    A.state.commit({ type: 'meta.layerName', layer: 1, value: 'Extra' }, 'Renamed layer 1');
    await A.state.flushSave();
    assert.deepEqual(methods, ['GET']);
  });

  it('opened as a file: no request at all, built-in layout, file banner reason', async () => {
    let fetched = false;
    await A.state.boot({ location: { protocol: 'file:' }, fetch: async () => { fetched = true; }, window: { addEventListener() {} } });
    assert.equal(fetched, false);
    assert.equal(A.store.project.mode, 'memory');
    assert.equal(A.store.project.reason, 'file');
    assert.equal(A.state.layerName(7), 'Spare');
  });
});
