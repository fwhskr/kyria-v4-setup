'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KS = require('./load-core');

test('all catalog names and aliases encode to the same value', () => {
  for (const entry of KS.keycodes.catalog) {
    const n = KS.wire.encode(entry.id);
    if (Number.isInteger(entry.hid)) assert.equal(n, entry.hid, entry.id);
    for (const alias of entry.aliases) assert.equal(KS.wire.encode(alias), n, alias);
  }
});

test('composed keycodes use protocol 6 bit fields', () => {
  const cases = {'LSFT(KC_A)':0x0204, 'RCTL_T(KC_A)':0x3104, 'LT3(KC_A)':0x4304,
    'LM(3, MOD_RALT)':0x5074, 'OSM(MOD_LCTL)':0x52a1, 'TO(3)':0x5203,
    'MO(3)':0x5223, 'DF(3)':0x5243, 'TG(3)':0x5263, 'OSL(3)':0x5283,
    'TT(3)':0x52c3, 'PDF(3)':0x52e3, 'TD(3)':0x5703, 'M3':0x7703, 'USER00':0x7e00};
  for (const [name,n] of Object.entries(cases)) {
    assert.equal(KS.wire.encode(name), n, name);
    assert.equal(KS.wire.decode(n), KS.keycodes.format(KS.keycodes.parse(name)), name);
  }
  assert.throws(() => KS.wire.encode('not-a-key'), {code:'E_WIRE_UNSUPPORTED'});
  assert.equal(KS.wire.decode(0xdead), '0xDEAD');
});

test('the fixture matrix has encodable cells', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/kriskyria.vil'), 'utf8'));
  for (const layer of doc.layout) for (const row of layer) for (const cell of row) {
    if (cell !== -1) assert.ok(Number.isInteger(KS.wire.encode(cell)), String(cell));
  }
});

test('shifted symbol and composed modifier share a wire value', () => {
  assert.equal(KS.wire.encode('KC_EXLM'), KS.wire.encode('LSFT(KC_1)'));
  assert.notEqual(KS.keycodes.format(KS.keycodes.parse('KC_EXLM')),
    KS.keycodes.format(KS.keycodes.parse('LSFT(KC_1)')));
});

test('catalog and composed names survive numeric round trip', () => {
  const composed = ['LSFT(KC_1)', 'RALT(KC_Z)', 'RSFT_T(KC_N)', 'MT(MOD_RCTL, KC_A)',
    'LT0(KC_A)', 'LT15(KC_Z)', 'LM(3, MOD_RALT)', 'OSM(MOD_LCTL)', 'OSM(23)', 'MT(23, KC_A)', 'LM(3, 23)', 'TD(255)', 'M255'];
  for (const fn of ['TO', 'MO', 'DF', 'TG', 'OSL', 'TT', 'PDF']) for (const n of [0, 3, 31]) composed.push(`${fn}(${n})`);
  for (const name of [...KS.keycodes.catalog.map(e => e.id), ...composed]) {
    const n = KS.wire.encode(name);
    assert.equal(KS.wire.encode(KS.wire.decode(n)), n, name);
  }
});

// Pinned Vial QMK source, fetched by ./setup.sh into .deps/ (not tracked).
const HEADER = path.resolve(__dirname, '../../.deps/vial-qmk/quantum/keycodes.h');
const NO_HEADER = fs.existsSync(HEADER) ? false : 'needs .deps/vial-qmk from ./setup.sh';

function headerValue() {
  const root = path.resolve(__dirname, '../..');
  const header = fs.readFileSync(HEADER, 'utf8');
  const expressions = new Map([...header.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(0x[\da-f]+|[A-Z][A-Z0-9_]*)\s*,/gmi)].map(m => [m[1], m[2]]));
  const value = (name, visited = new Set()) => {
    const v = expressions.get(name);
    if (!v || visited.has(name)) return undefined;
    if (/^0x/i.test(v)) return parseInt(v, 16);
    visited.add(name);
    return value(v, visited);
  };
  return value;
}

test('direct header constants agree with the catalog', {skip: NO_HEADER}, () => {
  const value = headerValue(); let checked = 0;
  for (const entry of KS.keycodes.catalog) if (value(entry.id) !== undefined) {
    assert.equal(KS.wire.encode(entry.id), value(entry.id), entry.id);
    checked++;
  }
  assert.ok(checked > 50, `only ${checked} header constants matched`);
  assert.equal(value('QK_KB_0'), KS.wire.encode('USER00'));
});

test('every fixture key has its independently derived QMK number', {skip: NO_HEADER}, () => {
  const value = headerValue(), doc = fixture();
  function oracle(action) {
    if (action.k === 'none') return 0;
    if (action.k === 'trans') return 1;
    if (action.k === 'basic' || action.k === 'named') {
      const e = KS.keycodes.byId(action.id);
      const vialNames = {KC__VOLUP:'KC_KB_VOLUME_UP', KC__VOLDOWN:'KC_KB_VOLUME_DOWN'};
      for (const name of [e.id, ...e.aliases, vialNames[e.id]]) {
        const n = value(name);
        if (n !== undefined) return n;
      }
      assert.fail(`No header name for ${action.id}`);
    }
    if (action.k === 'mods' || action.k === 'modtap') return (action.k === 'modtap' ? value('QK_MOD_TAP') : 0) | KS.keycodes.modsBits(action.mods) << 8 | oracle(action.inner || action.tap);
    if (action.k === 'layer') return value({MO:'QK_MOMENTARY', DF:'QK_DEF_LAYER', TO:'QK_TO', TG:'QK_TOGGLE_LAYER', OSL:'QK_ONE_SHOT_LAYER', TT:'QK_LAYER_TAP_TOGGLE', PDF:'QK_PERSISTENT_DEF_LAYER'}[action.fn]) | action.layer;
    if (action.k === 'macro') return value('QK_MACRO') | action.index;
    assert.fail(`No oracle for ${action.k}`);
  }
  for (const layer of doc.fields.layout) for (const row of layer) for (const code of row) {
    if (code !== -1) assert.equal(KS.wire.encode(code), oracle(KS.keycodes.parse(code)), code);
  }
});

function liveState() {
  const root = path.resolve(__dirname, '../..');
  const live = JSON.parse(fs.readFileSync(path.join(root, 'backups/live-keymap.json')));
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'backups/live-settings.json')));
  return {...live, macroSize:live.macros.length / 2, dynamicCounts:saved.dynamic_counts,
    dynamic:saved.dynamic, encoders:saved.encoders, layoutOptions:saved.layout_options,
    settings:Object.fromEntries(Object.entries(saved.qmk_settings).map(([id, value]) => [id, value.slice(2)]))};
}
function fixture() {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures/kriskyria.vil'), 'utf8');
  const parsed = KS.vil.decode(text, KS.board);
  assert.equal(parsed.ok, true);
  return parsed.doc;
}

test('live backup keys match the independent renderer', () => {
  const root = path.resolve(__dirname, '../..');
  const live = JSON.parse(fs.readFileSync(path.join(root, 'backups/live-keymap.json')));
  const settings = JSON.parse(fs.readFileSync(path.join(root, 'backups/live-settings.json')));
  const reference = require(path.join(root, 'tools/render_keymap.cjs')).decode(live, settings, KS);
  const bytes = Buffer.from(live.keymap, 'hex');
  reference.fields.layout.forEach((layer, l) => layer.forEach((row, r) => row.forEach((name, c) => {
    const n = bytes.readUInt16BE(2 * ((l * live.rows + r) * live.cols + c));
    if (name === -1) assert.ok(n === 0 || n === 1);
    else assert.equal(KS.wire.decode(n), name, `${l}:${r}:${c}`);
  })));
});

test('build fixture preserves unmapped cells and serializes keyboard sections', () => {
  const current = liveState(), doc = fixture();
  doc.fields.layout[0][0][1] = 'KC_C';
  const target = KS.wire.build(doc, current);
  assert.deepEqual(target.unsupported, []);
  assert.equal(target.keymap.slice(0, 4), current.keymap.slice(0, 4));
  assert.ok(target.macros.startsWith('7e6e00'));
  assert.equal(target.macros.length, current.macros.length);
  assert.equal(target.dynamic[1][0], '21522452000000000000');
  assert.equal(target.encoders[0][0], '00aa00a9');
  assert.equal(target.layoutOptions, '00000000');
  assert.equal(target.settings['7'], 'c800');
  const changes = KS.wire.diff(current, target);
  assert.ok(changes.some(x => x.kind === 'key' && x.to === 'KC_C'));
  assert.ok(changes.some(x => x.kind === 'macro'));
  assert.ok(changes.some(x => x.kind === 'macro' && x.to === '"~n"'));
  assert.ok(changes.some(x => x.kind === 'combo' && x.to.includes('MO(1)')));
});

test('excess dynamic entries are accepted only when empty', () => {
  const current = liveState(), doc = fixture();
  doc.fields.combo.push(['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO']);
  assert.deepEqual(KS.wire.build(doc, current).unsupported, []);
  doc.fields.combo[32][0] = 'KC_A';
  assert.ok(KS.wire.build(doc, current).unsupported.some(x => x.path === 'combo[32]'));
});

test('numeric equality suppresses alias-only key changes', () => {
  const current = liveState(), doc = fixture();
  doc.fields.layout[0][0][1] = 'KC_B';
  const target = KS.wire.build(doc, current);
  assert.ok(!KS.wire.diff(current, target).some(x => x.kind === 'key' && x.layer === 0 && x.row === 0 && x.col === 1));
});

test('macro actions use Vial escaping, delay and little-endian keycodes', () => {
  const current = liveState(), doc = fixture();
  doc.fields.macro = [[['tap', 'KC_A', 'TO(0)'], ['down', 'MO(1)'], ['up', 'KC_A'], ['delay', 255]]];
  const target = KS.wire.build(doc, current);
  assert.deepEqual(target.unsupported, []);
  assert.ok(target.macros.startsWith('010104010552ff010621520103040104010200'));
});

test('bytes after the last macro are kept, so leftovers never force a macro write', () => {
  const doc = fixture(), current = liveState();
  const ours = KS.wire.build(doc, current).macros.slice(0, 6); // "~n" + terminator, then 15 empty macros
  const used = ours + '00'.repeat(15);
  const leftover = Buffer.from('}{KC_O}\n', 'ascii').toString('hex') + '00';
  current.macros = used + leftover + '00'.repeat(current.macroSize - used.length / 2 - leftover.length / 2);
  const target = KS.wire.build(doc, current);
  assert.equal(target.macros, current.macros);
  assert.ok(!KS.wire.diff(current, target).some(x => x.kind === 'macro'));
  // A tail whose last byte is non-zero is an aborted write: it is cleared, never kept.
  current.macros = current.macros.slice(0, -2) + '41';
  const cleared = KS.wire.build(doc, current).macros;
  assert.ok(cleared.endsWith('00'));
  assert.equal(cleared.slice(used.length), '00'.repeat(current.macroSize - used.length / 2));
});

test('oversize macros and unknown setting widths are unsupported', () => {
  const current = liveState(), doc = fixture();
  doc.fields.macro = [[['text', 'x'.repeat(current.macroSize)]]];
  doc.fields.settings.push([999, 3]);
  const target = KS.wire.build(doc, current);
  assert.equal(target.macros, null);
  assert.ok(target.unsupported.some(x => x.path === 'macro'));
  assert.ok(target.unsupported.some(x => x.path === 'settings[999]'));
});

function matchingState(doc) {
  const current = liveState(), target = KS.wire.build(doc, current);
  return {...current, keymap:target.keymap, macros:target.macros, dynamic:target.dynamic,
    encoders:target.encoders, layoutOptions:target.layoutOptions,
    settings:{...current.settings, ...target.settings}};
}

test('pending highlights each changed key and encoder direction', () => {
  const doc = fixture(), current = matchingState(doc);
  const before = doc.fields.layout[0][0][1];
  doc.fields.layout[0][0][1] = 'KC_C';
  doc.fields.encoder_layout[0][0] = ['KC_A', 'KC_B'];
  const result = KS.wire.pending(doc, current);
  assert.deepEqual(result.items, KS.wire.diff(current, KS.wire.build(doc, current)));
  assert.equal(result.count, 2);
  assert.deepEqual(result.keys['0:0:1'], {from:KS.wire.decode(KS.wire.encode(before)), to:'KC_C'});
  assert.deepEqual(result.encoders['0:0:0'], {from:'KC_VOLD', to:'KC_A'});
  assert.deepEqual(result.encoders['0:0:1'], {from:'KC_VOLU', to:'KC_B'});
  assert.equal(result.layers[0], 3);
  assert.ok(result.layers.slice(1).every(n => n === 0));
});

test('revert applies all supported changes as one history step', () => {
  const doc = fixture(), current = matchingState(doc);
  doc.fields.layout[0][0][1] = 'KC_C';
  doc.fields.encoder_layout[0][0] = ['KC_A', 'KC_B'];
  doc.fields.macro[0] = [['text', 'hello']];
  doc.fields.tap_dance[0][0] = 'KC_A';
  doc.fields.combo[0][0] = 'KC_A';
  doc.fields.key_override[0].trigger = 'KC_A';
  doc.fields.alt_repeat_key[0].keycode = 'KC_A';
  doc.fields.settings.find(([id]) => id === 7)[1] = 201;
  doc.fields.layout_options = 1;
  const changes = KS.wire.pending(doc, current);
  assert.ok(changes.count >= 8);
  const result = KS.wire.revert(doc, current);
  assert.deepEqual(result.skipped, []);
  for (const type of ['key.set', 'encoder.set', 'macro.set', 'tapDance.set', 'combo.set', 'keyOverride.set', 'altRepeat.set', 'setting.set', 'layoutOptions.set']) assert.ok(result.ops.some(op => op.type === type), type);
  const history = KS.history.commit(KS.history.create(KS.workspace.create(doc)), {type:'batch', ops:result.ops});
  assert.equal(KS.wire.pending(history.present.doc, current).count, 0);
  assert.equal(KS.wire.pending(KS.history.undo(history).present.doc, current).count, changes.count);
});

test('macro parser round trips text, all key actions, extended escape and delay', () => {
  const doc = fixture(), current = liveState();
  doc.fields.macro = [[['text','Hello'], ['tap','KC_A'], ['down','KC_B'], ['up','KC_C'],
    ['tap','TO(0)'], ['down','MO(1)'], ['up','TO(0)'], ['delay',0], ['delay',65024]]];
  const bytes = KS.wire.build(doc, current).macros;
  assert.ok(bytes.includes('010552ff'));
  assert.deepEqual(KS.wire.macroActions(bytes, 1), doc.fields.macro);
  doc.fields.macro = KS.wire.macroActions(bytes, 1);
  assert.equal(KS.wire.build(doc, current).macros, bytes);
});

test('revert skips unknown keycodes and malformed macros', () => {
  const doc = fixture(), current = matchingState(doc);
  const offset = 2 * 1;
  current.keymap = current.keymap.slice(0, offset * 2) + '7f50' + current.keymap.slice((offset + 2) * 2);
  current.macros = '010800' + current.macros.slice(6);
  const result = KS.wire.revert(doc, current);
  assert.ok(result.skipped.some(x => x.path === 'layout[0][0][1]' && x.reason.includes('0x7F50')));
  assert.ok(result.skipped.some(x => x.path === 'macro[0]'));
  assert.ok(!result.ops.some(x => x.type === 'key.set' && x.row === 0 && x.col === 1));
  assert.ok(!result.ops.some(x => x.type === 'macro.set' && x.index === 0));
});
