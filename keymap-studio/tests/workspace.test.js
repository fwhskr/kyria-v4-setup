'use strict';
// VERIFY-4: every Op is pure, count-preserving and refuses bad targets; batches are atomic;
// history undoes and redoes; restore validates stored data and never throws.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const KS = require('./load-core.js');
const H = require('./helpers.js');

const { op, deepFreeze, vilText, RAW } = H;
const { OpError } = KS.workspace;
const board = KS.board;
const fixtureText = H.readText(H.FIXTURE_VIL);
const base = () => KS.workspace.fromDefault();
const stored = () => JSON.parse(JSON.stringify(base()));
const snapshot = (x) => JSON.stringify(x);
const isOpError = (e) => e instanceof OpError;

function counts(ws) {
  const c = KS.vil.capabilities(ws.doc);
  return {
    layers: c.layers, encoders: c.encoders, macros: c.macros, tapDance: c.tapDance,
    combos: c.combos, keyOverrides: c.keyOverrides, altRepeat: c.altRepeat,
    qsids: [...c.settingQsids].sort((a, b) => a - b),
  };
}

// Applies one op to a deep-frozen input (strict mode turns any write into a throw).
// The input must be unchanged and no count may change.
function applyOk(input, o) {
  deepFreeze(input);
  const before = snapshot(input);
  const out = KS.workspace.apply(input, o);
  assert.equal(snapshot(input), before, 'input workspace must not change');
  assert.deepEqual(counts(out), counts(input), 'an op must not change any count');
  return out;
}
const refuses = (input, o) => assert.throws(() => KS.workspace.apply(deepFreeze(input), o), isOpError);

// settingsDescriptor: a QMK settings field has a qsid and a width; search the port without assuming nesting.
function findSettingField(node, qsid) {
  if (Array.isArray(node)) {
    for (const x of node) { const f = findSettingField(x, qsid); if (f) return f; }
    return null;
  }
  if (node && typeof node === 'object') {
    if (node.qsid === qsid) return node;
    for (const v of Object.values(node)) { const f = findSettingField(v, qsid); if (f) return f; }
  }
  return null;
}
const presentQsids = (ws) => ws.doc.fields.settings.map(([q]) => q);

describe('VERIFY-4 key.set', () => {
  it('sets one cell and leaves the input untouched', () => {
    const input = base();
    const out = applyOk(input, op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_Y' }));
    assert.equal(out.doc.fields.layout[0][0][1], 'KC_Y');
    assert.equal(input.doc.fields.layout[0][0][1], 'KC_B');
  });

  it('refuses a -1 cell with E_NO_KEY', () => {
    const ws = base();
    assert.equal(ws.doc.fields.layout[0][0][0], -1, 'fixture cell 0,0,0 must be empty');
    assert.throws(() => KS.workspace.apply(deepFreeze(ws), op('key.set', { layer: 0, row: 0, col: 0, code: 'KC_A' })),
      (e) => isOpError(e) && e.code === 'E_NO_KEY');
  });

  it('refuses a code that is not catalog-known (KC_NONUS_BACKSLASH)', () => {
    refuses(base(), op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_NONUS_BACKSLASH' }));
  });

  it('refuses an absent layer or position', () => {
    refuses(base(), op('key.set', { layer: 8, row: 0, col: 1, code: 'KC_A' }));
    refuses(base(), op('key.set', { layer: 0, row: 10, col: 1, code: 'KC_A' }));
  });

  it('re-sets an imported unknown code exactly, so undo can restore it', () => {
    const doc = KS.vil.decode(vilText((o) => { o.layout[0][0][1] = 'KC_NONUS_BACKSLASH'; }), board).doc;
    const ws = KS.workspace.create(doc, { filename: 'imported.vil' });
    const same = applyOk(ws, op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_NONUS_BACKSLASH' }));
    assert.equal(same.doc.fields.layout[0][0][1], 'KC_NONUS_BACKSLASH');
    const valid = applyOk(ws, op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_A' }));
    assert.equal(valid.doc.fields.layout[0][0][1], 'KC_A');
  });
});

describe('VERIFY-4 encoder.set (dir 0 = clockwise, R6)', () => {
  it('sets one direction and leaves the other', () => {
    const out = applyOk(base(), op('encoder.set', { layer: 0, index: 0, dir: 0, code: 'KC_MNXT' }));
    assert.deepEqual(out.doc.fields.encoder_layout[0][0], ['KC_MNXT', 'KC_VOLU']);
  });

  it('sets the counter-clockwise direction', () => {
    const out = applyOk(base(), op('encoder.set', { layer: 0, index: 0, dir: 1, code: 'KC_MNXT' }));
    assert.deepEqual(out.doc.fields.encoder_layout[0][0], ['KC_VOLD', 'KC_MNXT']);
  });

  it('refuses a direction other than 0 or 1, an absent encoder and an absent layer', () => {
    refuses(base(), op('encoder.set', { layer: 0, index: 0, dir: 2, code: 'KC_MNXT' }));
    refuses(base(), op('encoder.set', { layer: 0, index: 4, dir: 0, code: 'KC_MNXT' }));
    refuses(base(), op('encoder.set', { layer: 8, index: 0, dir: 0, code: 'KC_MNXT' }));
  });
});

describe('VERIFY-4 macro.set', () => {
  it('replaces the actions of an existing macro and keeps the macro count', () => {
    const out = applyOk(base(), op('macro.set', { index: 1, actions: [['text', 'hi']] }));
    assert.deepEqual(out.doc.fields.macro[1], [['text', 'hi']]);
    assert.equal(out.doc.fields.macro.length, 16);
  });

  it('refuses an index past the last macro', () => {
    refuses(base(), op('macro.set', { index: 16, actions: [['text', 'x']] }));
  });

  it('refuses a macro in a raw section', () => {
    const ws = KS.workspace.create(KS.vil.decode(vilText((o) => { o.macro = 'nope'; }), board).doc, { filename: 'raw.vil' });
    refuses(ws, op('macro.set', { index: 0, actions: [['text', 'x']] }));
  });
});

describe('VERIFY-4 tapDance, combo, keyOverride and altRepeat', () => {
  it('sets a tap dance value keeping the count', () => {
    const out = applyOk(base(), op('tapDance.set', { index: 0, value: ['KC_A', 'KC_NO', 'KC_NO', 'KC_NO', 150] }));
    assert.deepEqual(out.doc.fields.tap_dance[0], ['KC_A', 'KC_NO', 'KC_NO', 'KC_NO', 150]);
  });

  it('refuses a tap dance index past the end and a non-catalog key', () => {
    refuses(base(), op('tapDance.set', { index: 32, value: ['KC_A', 'KC_NO', 'KC_NO', 'KC_NO', 150] }));
    refuses(base(), op('tapDance.set', { index: 0, value: ['KC_NONUS_BACKSLASH', 'KC_NO', 'KC_NO', 'KC_NO', 150] }));
  });

  it('sets a combo and refuses an absent index', () => {
    const out = applyOk(base(), op('combo.set', { index: 0, value: ['KC_A', 'KC_S', 'KC_NO', 'KC_NO', 'KC_ESCAPE'] }));
    assert.deepEqual(out.doc.fields.combo[0], ['KC_A', 'KC_S', 'KC_NO', 'KC_NO', 'KC_ESCAPE']);
    refuses(base(), op('combo.set', { index: 99, value: ['KC_A', 'KC_S', 'KC_NO', 'KC_NO', 'KC_ESCAPE'] }));
  });

  const override = (patch) => ({
    trigger: 'KC_A', replacement: 'KC_B', layers: 65535, trigger_mods: 0,
    negative_mod_mask: 0, suppressed_mods: 0, options: 7, ...patch,
  });
  it('sets a key override within its bit widths', () => {
    const out = applyOk(base(), op('keyOverride.set', { index: 0, value: override({ options: 255 }) }));
    assert.equal(out.doc.fields.key_override[0].options, 255);
  });

  it('refuses a key override layers mask wider than 16 bits', () => {
    refuses(base(), op('keyOverride.set', { index: 0, value: override({ layers: 65536 }) }));
  });

  it('refuses a key override modifier byte wider than 8 bits', () => {
    refuses(base(), op('keyOverride.set', { index: 0, value: override({ trigger_mods: 256 }) }));
  });

  it('sets an alt-repeat entry whose options use bits 0-3', () => {
    const v = { keycode: 'KC_A', alt_keycode: 'KC_B', allowed_mods: 255, options: 15 };
    const out = applyOk(base(), op('altRepeat.set', { index: 0, value: v }));
    assert.deepEqual(out.doc.fields.alt_repeat_key[0], v);
  });

  it('refuses alt-repeat options that use bit 4 or above, and mods wider than a byte', () => {
    refuses(base(), op('altRepeat.set', { index: 0, value: { keycode: 'KC_A', alt_keycode: 'KC_B', allowed_mods: 0, options: 16 } }));
    refuses(base(), op('altRepeat.set', { index: 0, value: { keycode: 'KC_A', alt_keycode: 'KC_B', allowed_mods: 256, options: 0 } }));
  });
});

describe('VERIFY-4 setting.set (qsid, width rules)', () => {
  it('sets a present, described qsid to its minimum', () => {
    const ws = base();
    const q = presentQsids(ws).find((x) => findSettingField(KS.QMK_SETTINGS, x));
    assert.ok(q !== undefined, 'the owner file must contain a described qsid');
    const d = findSettingField(KS.QMK_SETTINGS, q);
    const v = typeof d.min === 'number' ? d.min : 0;
    const out = applyOk(ws, op('setting.set', { qsid: q, value: v }));
    assert.deepEqual(out.doc.fields.settings.find(([k]) => k === q), [q, v]);
  });

  it('refuses a value wider than the field width', () => {
    const ws = base();
    const q = presentQsids(ws).find((x) => findSettingField(KS.QMK_SETTINGS, x));
    const d = findSettingField(KS.QMK_SETTINGS, q);
    assert.equal(typeof d.width, 'number', 'descriptor must carry the width');
    refuses(ws, op('setting.set', { qsid: q, value: 2 ** (8 * d.width) }));
  });

  it('refuses a negative value', () => {
    const ws = base();
    const q = presentQsids(ws).find((x) => findSettingField(KS.QMK_SETTINGS, x));
    refuses(ws, op('setting.set', { qsid: q, value: -1 }));
  });

  it('never adds an absent qsid', () => {
    const ws = base();
    const absent = [...Array(64).keys()].find((q) => !presentQsids(ws).includes(q));
    refuses(ws, op('setting.set', { qsid: absent, value: 0 }));
  });

  it('treats a present but undescribed qsid as read-only', (t) => {
    const ws = base();
    const q = presentQsids(ws).find((x) => !findSettingField(KS.QMK_SETTINGS, x));
    if (q === undefined) return t.skip('every owner qsid has a descriptor');
    refuses(ws, op('setting.set', { qsid: q, value: 0 }));
  });
});

describe('VERIFY-4 layoutOptions.set', () => {
  it('sets the packed value and changes only that line of the file', () => {
    const out = applyOk(base(), op('layoutOptions.set', { value: 10 }));
    assert.equal(out.doc.fields.layout_options, 10);
    const line = '"layout_options": 0';
    assert.equal(fixtureText.split(line).length, 2, 'fixture must hold the layout_options line once');
    assert.equal(KS.vil.encode(out.doc), fixtureText.replace(line, '"layout_options": 10'));
  });

  it('refuses a value outside the packed 4-bit range', () => {
    refuses(base(), op('layoutOptions.set', { value: 16 }));
  });
});

describe('VERIFY-4 uid.restoreKnown (OQ-3)', () => {
  it('restores the known uid from the rounded one and exports the owner file exactly', () => {
    const doc = KS.vil.decode(vilText((o) => { o.uid = RAW(H.ROUNDED_UID); }), board).doc;
    const ws = KS.workspace.create(doc, { filename: 'rounded.vil' });
    const out = applyOk(ws, op('uid.restoreKnown', {}));
    assert.equal(out.doc.fields.uid, H.KNOWN_UID);
    H.assertSameBytes(KS.vil.encode(out.doc), H.readBytes(H.FIXTURE_VIL), 'restored export');
  });

  it('refuses when the uid is not the rounded one', () => {
    refuses(base(), op('uid.restoreKnown', {}));
  });
});

describe('VERIFY-4 meta operations (ADR-S8: never in the .vil)', () => {
  it('trims a layer name and leaves the exported file unchanged', () => {
    const before = KS.vil.encode(base().doc);
    const out = applyOk(base(), op('meta.layerName', { layer: 0, value: '  Base  ' }));
    assert.equal(out.meta.layerNames[0], 'Base');
    assert.equal(KS.vil.encode(out.doc), before);
  });

  it('never keeps a layer name longer than 35 characters', () => {
    const ws = base();
    let out;
    try { out = KS.workspace.apply(deepFreeze(ws), op('meta.layerName', { layer: 0, value: 'a'.repeat(36) })); } catch (e) {
      assert.ok(isOpError(e));
      return;
    }
    assert.ok(out.meta.layerNames[0].length <= 35);
  });

  it('refuses a layer name for an absent layer', () => {
    refuses(base(), op('meta.layerName', { layer: 8, value: 'x' }));
  });

  it('stores a #rrggbb layer colour and refuses any other colour text', () => {
    const out = applyOk(base(), op('meta.layerColor', { layer: 0, value: '#00ff7a' }));
    assert.equal(out.meta.layerColors[0].toLowerCase(), '#00ff7a');
    refuses(base(), op('meta.layerColor', { layer: 0, value: '#abc' }));
    refuses(base(), op('meta.layerColor', { layer: 0, value: 'blue' }));
  });

  it('sets and then removes a key label under the l:r:c key', () => {
    const set = applyOk(base(), op('meta.keyLabel', { layer: 0, row: 0, col: 1, value: 'Ctrl' }));
    assert.equal(set.meta.keyLabels['0:0:1'], 'Ctrl');
    const removed = applyOk(set, op('meta.keyLabel', { layer: 0, row: 0, col: 1, value: null }));
    assert.equal(Object.prototype.hasOwnProperty.call(removed.meta.keyLabels, '0:0:1'), false);
  });

  it('never keeps a key label longer than 24 characters', () => {
    let out;
    try { out = KS.workspace.apply(deepFreeze(base()), op('meta.keyLabel', { layer: 0, row: 0, col: 1, value: 'k'.repeat(25) })); } catch (e) {
      assert.ok(isOpError(e));
      return;
    }
    assert.ok(out.meta.keyLabels['0:0:1'].length <= 24);
  });

  it('refuses a key label on an absent position', () => {
    refuses(base(), op('meta.keyLabel', { layer: 0, row: 10, col: 1, value: 'x' }));
  });
});

describe('VERIFY-4 batch and unknown ops', () => {
  it('applies every op of a valid batch', () => {
    const out = applyOk(base(), op('batch', {
      ops: [op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_Y' }), op('meta.layerName', { layer: 0, value: 'Two' })],
    }));
    assert.equal(out.doc.fields.layout[0][0][1], 'KC_Y');
    assert.equal(out.meta.layerNames[0], 'Two');
  });

  it('refuses the whole batch when one op fails, so no partial state is returned', () => {
    refuses(base(), op('batch', {
      ops: [op('meta.layerName', { layer: 0, value: 'Changed' }), op('key.set', { layer: 0, row: 0, col: 0, code: 'KC_A' })],
    }));
  });

  it('refuses an unknown op', () => {
    refuses(base(), op('nothing.here', {}));
  });
});

describe('VERIFY-4 history (undo, redo, limit)', () => {
  it('starts with nothing to undo or redo', () => {
    const h = KS.history.create(base());
    assert.equal(KS.history.canUndo(h), false);
    assert.equal(KS.history.canRedo(h), false);
  });

  it('undoes and redoes one commit', () => {
    const start = base();
    let h = KS.history.create(start);
    h = KS.history.commit(h, op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_Y' }));
    const edited = h.present;
    assert.equal(KS.history.canUndo(h), true);
    h = KS.history.undo(h);
    assert.deepEqual(h.present, start);
    assert.equal(KS.history.canRedo(h), true);
    h = KS.history.redo(h);
    assert.deepEqual(h.present, edited);
  });

  it('clears the redo future after a new commit', () => {
    let h = KS.history.create(base());
    h = KS.history.commit(h, op('meta.layerName', { layer: 0, value: 'A' }));
    h = KS.history.undo(h);
    h = KS.history.commit(h, op('meta.layerName', { layer: 0, value: 'B' }));
    assert.equal(KS.history.canRedo(h), false);
  });

  it('does nothing when undo or redo has no step', () => {
    const h = KS.history.create(base());
    assert.deepEqual(KS.history.undo(h).present, h.present);
    assert.deepEqual(KS.history.redo(h).present, h.present);
  });

  it('keeps only the newest states up to the limit', () => {
    let h = KS.history.create(base(), { limit: 3 });
    const states = [h.present];
    for (let i = 1; i <= 5; i++) {
      h = KS.history.commit(h, op('meta.layerName', { layer: 0, value: `L${i}` }));
      states.push(h.present);
    }
    assert.equal(h.past.length, 3);
    h = KS.history.undo(KS.history.undo(KS.history.undo(h)));
    assert.deepEqual(h.present, states[2]);
    assert.equal(KS.history.canUndo(h), false);
  });

  it('defaults to 200 undo steps', () => {
    let h = KS.history.create(base());
    for (let i = 0; i < 201; i++) h = KS.history.commit(h, op('meta.layerName', { layer: 0, value: i % 2 ? 'A' : 'B' }));
    assert.equal(h.past.length, 200);
  });

  it('undoes a batch in one step', () => {
    const start = base();
    let h = KS.history.create(start);
    h = KS.history.commit(h, op('batch', { ops: [op('meta.layerName', { layer: 0, value: 'A' }), op('meta.layerName', { layer: 1, value: 'B' })] }));
    h = KS.history.undo(h);
    assert.deepEqual(h.present, start);
  });

  it('leaves history unchanged when a commit is refused', () => {
    const h = KS.history.create(base());
    assert.throws(() => KS.history.commit(h, op('key.set', { layer: 0, row: 0, col: 0, code: 'KC_A' })), isOpError);
    assert.equal(h.past.length, 0);
    assert.equal(KS.history.canUndo(h), false);
  });
});

describe('VERIFY-4 restore (validates stored SCHEMA-WS, never throws)', () => {
  it('restores a stored workspace exactly', () => {
    const ws = base();
    const r = KS.workspace.restore(JSON.parse(JSON.stringify(ws)));
    assert.equal(r.ok, true);
    assert.deepEqual(r.ws, ws);
  });

  it('keeps a raw section through storage', () => {
    const text = vilText((o) => { o.combo = 'nope'; });
    const ws = KS.workspace.create(KS.vil.decode(text, board).doc, { filename: 'raw.vil' });
    const r = KS.workspace.restore(JSON.parse(JSON.stringify(ws)));
    assert.equal(r.ok, true);
    H.assertSameBytes(KS.vil.encode(r.ws.doc), Buffer.from(text, 'utf8'), 'raw section export');
  });

  it('refuses malformed stored values without throwing', () => {
    const cases = [null, 42, 'text', [], {}, { ...stored(), schema: 1 }, { ...stored(), schema: 3 },
      { ...stored(), doc: { order: [], fields: {}, extra: [] } }];
    for (const value of cases) {
      let r;
      assert.doesNotThrow(() => { r = KS.workspace.restore(value); });
      assert.equal(r.ok, false, `restore(${JSON.stringify(value)}) must fail`);
      assert.ok(Array.isArray(r.issues));
    }
  });

  it('refuses a key label whose key is not l:r:c, and does not pollute prototypes', () => {
    const s = stored();
    s.meta.keyLabels = JSON.parse('{"__proto__": "x"}');
    const r = KS.workspace.restore(s);
    assert.equal(r.ok, false);
    assert.equal({}.x, undefined);
  });
});

describe('VERIFY-4 workspace creation', () => {
  it('creates metadata defaults matching the layer count', () => {
    const doc = KS.vil.decode(fixtureText, board).doc;
    const ws = KS.workspace.create(doc, { filename: 'kriskyria.vil' });
    assert.equal(ws.schema, 2);
    assert.equal(ws.filename, 'kriskyria.vil');
    assert.equal(ws.meta.layerNames.length, 8);
    assert.equal(ws.meta.layerColors.length, 8);
    for (const c of ws.meta.layerColors) assert.match(c, /^#[0-9a-f]{6}$/i);
    assert.deepEqual(ws.meta.keyLabels, {});
  });

  it('builds the default workspace with no error issues', () => {
    assert.deepEqual(KS.vil.validate(base().doc, board).filter((i) => i.severity === 'error'), []);
  });
});
