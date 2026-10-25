'use strict';
// VERIFY-3: decode issues (size, matrix, required fields, uid, raw passthrough, extras, keycodes),
// plus capabilities and layout-option packing from the firmware's own labels.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const KS = require('./load-core.js');
const H = require('./helpers.js');

const board = KS.board;
const { RAW } = H;
const decode = (text) => KS.vil.decode(text, board);
const vilOf = (mutate) => H.vilText(mutate);
const isError = (i) => i.severity === 'error';

// Every error reported at decode time or by validate, because the spec allows either place.
function allErrors(r) {
  const fromValidate = r.doc ? KS.vil.validate(r.doc, board) : [];
  return [...r.issues, ...fromValidate].filter(isError);
}
const hasCode = (list, code) => list.some((i) => i.code === code);

describe('VERIFY-3 size, layers and matrix', () => {
  it('reports E_TOO_LARGE above 2 000 000 characters', () => {
    const r = decode(vilOf((o) => { o.zz = 'x'.repeat(2000000); }));
    assert.ok(hasCode(r.issues, 'E_TOO_LARGE'));
    assert.ok(r.issues.find((i) => i.code === 'E_TOO_LARGE').severity === 'error');
  });

  it('accepts exactly 32 layers', () => {
    const r = decode(vilOf((o) => {
      o.layout = Array.from({ length: 32 }, () => structuredClone(o.layout[0]));
      o.encoder_layout = Array.from({ length: 32 }, () => structuredClone(o.encoder_layout[0]));
    }));
    assert.equal(r.ok, true);
    assert.deepEqual(allErrors(r), []);
  });

  it('refuses 33 layers', () => {
    const r = decode(vilOf((o) => {
      o.layout = Array.from({ length: 33 }, () => structuredClone(o.layout[0]));
      o.encoder_layout = Array.from({ length: 33 }, () => structuredClone(o.encoder_layout[0]));
    }));
    assert.ok(allErrors(r).length > 0);
  });

  it('refuses a layer with the wrong number of rows (E_MATRIX)', () => {
    const r = decode(vilOf((o) => { o.layout[0] = o.layout[0].slice(0, 5); }));
    assert.ok(hasCode(allErrors(r), 'E_MATRIX'));
  });

  it('refuses a row with the wrong number of columns (E_MATRIX)', () => {
    const r = decode(vilOf((o) => { o.layout[0][0] = o.layout[0][0].slice(0, 6); }));
    assert.ok(hasCode(allErrors(r), 'E_MATRIX'));
  });
});

describe('VERIFY-3 required Vial fields', () => {
  it('fails decode with E_LAYOUT when layout is missing', () => {
    const r = decode(vilOf((o) => { delete o.layout; }));
    assert.equal(r.ok, false);
    assert.ok(hasCode(r.issues, 'E_LAYOUT'));
  });

  it('decodes a file without encoder_layout, does not synthesize it, and blocks export', () => {
    const text = vilOf((o) => { delete o.encoder_layout; });
    const r = decode(text);
    assert.equal(r.ok, true);
    assert.equal(r.doc.fields.encoder_layout, undefined);
    assert.ok(hasCode(KS.vil.validate(r.doc, board), 'E_VIAL_REQUIRED'));
    assert.ok(!KS.vil.encode(r.doc).includes('encoder_layout'));
  });

  it('decodes a file without layout_options, does not synthesize it, and blocks export', () => {
    const text = vilOf((o) => { delete o.layout_options; });
    const r = decode(text);
    assert.equal(r.ok, true);
    assert.equal(r.doc.fields.layout_options, undefined);
    assert.ok(hasCode(KS.vil.validate(r.doc, board), 'E_VIAL_REQUIRED'));
    assert.ok(!KS.vil.encode(r.doc).includes('layout_options'));
  });
});

describe('VERIFY-3 uid', () => {
  it('keeps the known uid silently', () => {
    const r = decode(H.readText(H.FIXTURE_VIL));
    assert.equal(r.issues.filter((i) => i.code.startsWith('W_UID')).length, 0);
  });

  it('warns W_UID_ROUNDED for the rounded uid and keeps it as a string', () => {
    const r = decode(vilOf((o) => { o.uid = RAW(H.ROUNDED_UID); }));
    assert.ok(hasCode(r.issues, 'W_UID_ROUNDED'));
    assert.equal(r.issues.find((i) => i.code === 'W_UID_ROUNDED').severity, 'warning');
    assert.equal(r.doc.fields.uid, H.ROUNDED_UID);
    assert.deepEqual(allErrors(r), []);
  });

  it('warns W_UID_OTHER for another uid', () => {
    const r = decode(vilOf((o) => { o.uid = RAW('123'); }));
    assert.ok(hasCode(r.issues, 'W_UID_OTHER'));
    assert.deepEqual(allErrors(r), []);
  });

  it('accepts the largest uid 2^64-1 without an error', () => {
    const r = decode(vilOf((o) => { o.uid = RAW('18446744073709551615'); }));
    assert.deepEqual(allErrors(r), []);
  });

  it('refuses a uid of 2^64 as an error', () => {
    const r = decode(vilOf((o) => { o.uid = RAW('18446744073709551616'); }));
    assert.ok(allErrors(r).length > 0);
  });

  it('refuses a negative uid as an error', () => {
    const r = decode(vilOf((o) => { o.uid = RAW('-1'); }));
    assert.ok(allErrors(r).length > 0);
  });
});

describe('VERIFY-3 raw passthrough', () => {
  it('turns a tap dance item of the wrong length into W_RAW_ITEM and exports it verbatim', () => {
    const text = vilOf((o) => { o.tap_dance[0] = [...o.tap_dance[0], 1]; });
    const r = decode(text);
    assert.ok(hasCode(r.issues, 'W_RAW_ITEM'));
    assert.ok('$raw' in r.doc.fields.tap_dance[0]);
    assert.equal(KS.vil.encode(r.doc), text);
  });

  it('turns a key_override with reordered keys into a raw item', () => {
    const text = vilOf((o) => {
      const k = o.key_override[0];
      o.key_override[0] = { replacement: k.replacement, trigger: k.trigger, layers: k.layers, trigger_mods: k.trigger_mods, negative_mod_mask: k.negative_mod_mask, suppressed_mods: k.suppressed_mods, options: k.options };
    });
    const r = decode(text);
    assert.ok(hasCode(r.issues, 'W_RAW_ITEM'));
    assert.ok('$raw' in r.doc.fields.key_override[0]);
    assert.equal(KS.vil.encode(r.doc), text);
  });

  it('turns an unknown macro action into a raw item', () => {
    const text = vilOf((o) => { o.macro[1] = [['bogus', 1]]; });
    const r = decode(text);
    assert.ok(hasCode(r.issues, 'W_RAW_ITEM'));
    assert.equal(KS.vil.encode(r.doc), text);
  });

  it('turns a non-conforming combo section into W_RAW_SECTION and exports it verbatim', () => {
    const text = vilOf((o) => { o.combo = 'nope'; });
    const r = decode(text);
    assert.ok(hasCode(r.issues, 'W_RAW_SECTION'));
    assert.ok('$raw' in r.doc.fields.combo);
    assert.equal(KS.vil.encode(r.doc), text);
  });

  it('turns a non-integer settings value into W_RAW_SECTION', () => {
    const text = vilOf((o) => { o.settings = { 1: RAW('1.5') }; });
    const r = decode(text);
    assert.ok(hasCode(r.issues, 'W_RAW_SECTION'));
    assert.equal(KS.vil.encode(r.doc), text);
  });
});

describe('VERIFY-3 unknown members', () => {
  it('keeps an unknown top-level member verbatim at its position with I_UNKNOWN_FIELD', () => {
    const text = vilOf((o) => { o.zz = { a: [1, RAW('2.50')] }; });
    const r = decode(text);
    assert.ok(hasCode(r.issues, 'I_UNKNOWN_FIELD'));
    assert.ok(r.doc.extra.some(([k]) => k === 'zz'));
    assert.ok(r.doc.order.includes('zz'));
    assert.equal(KS.vil.encode(r.doc), text);
  });
});

describe('VERIFY-3 reformatting and keycodes', () => {
  it('accepts a BOM and trailing whitespace with W_REFORMATTED and drops them on export', () => {
    const fixture = H.readText(H.FIXTURE_VIL);
    const r = decode('\ufeff' + fixture + '\n');
    assert.equal(r.ok, true);
    assert.ok(hasCode(r.issues, 'W_REFORMATTED'));
    H.assertSameBytes(KS.vil.encode(r.doc), H.readBytes(H.FIXTURE_VIL), 'reformatted export');
  });

  it('warns W_UNKNOWN_KEYCODE for KC_NONUS_BACKSLASH without blocking export', () => {
    const text = vilOf((o) => { o.layout[0][0][1] = 'KC_NONUS_BACKSLASH'; });
    const r = decode(text);
    assert.equal(r.ok, true);
    assert.ok(hasCode(r.issues, 'W_UNKNOWN_KEYCODE'));
    assert.equal(r.issues.find((i) => i.code === 'W_UNKNOWN_KEYCODE').severity, 'warning');
    assert.deepEqual(allErrors(r), []);
    assert.equal(KS.vil.encode(r.doc), text);
  });
});

describe('VERIFY-3 validate and capabilities on the owner file', () => {
  it('validate reports no errors for the fixture', () => {
    const r = decode(H.readText(H.FIXTURE_VIL));
    assert.deepEqual(KS.vil.validate(r.doc, board).filter(isError), []);
  });

  it('counts capabilities from the owner file itself', () => {
    const oracle = JSON.parse(H.readText(H.FIXTURE_VIL));
    const cap = KS.vil.capabilities(decode(H.readText(H.FIXTURE_VIL)).doc);
    assert.equal(cap.source, 'file');
    assert.equal(cap.layers, oracle.layout.length);
    assert.equal(cap.matrix.rows, 10);
    assert.equal(cap.matrix.cols, 7);
    assert.equal(cap.encoders, oracle.encoder_layout[0].length);
    assert.equal(cap.macros, oracle.macro.length);
    assert.equal(cap.macroBytes, null);
    assert.equal(cap.tapDance, oracle.tap_dance.length);
    assert.equal(cap.combos, oracle.combo.length);
    assert.equal(cap.keyOverrides, oracle.key_override.length);
    assert.equal(cap.altRepeat, oracle.alt_repeat_key.length);
    assert.deepEqual([...cap.settingQsids].sort((a, b) => a - b), Object.keys(oracle.settings).map(Number).sort((a, b) => a - b));
    assert.equal(cap.layoutOptions, true);
    assert.deepEqual(cap.vialRequiredMissing, []);
  });

  it('reports a missing required section and marks raw sections read-only', () => {
    const r = decode(vilOf((o) => { delete o.encoder_layout; o.combo = 'nope'; }));
    const cap = KS.vil.capabilities(r.doc);
    assert.ok(cap.vialRequiredMissing.includes('encoder_layout'));
    assert.equal(cap.editable.combo, false);
    assert.equal(cap.editable.macro, true);
  });
});

describe('VERIFY-3 raw required sections block export', () => {
  // A raw (non-conforming) required section is invalid, so it must block export even though decode kept it verbatim.
  it('blocks export when encoder_layout is a raw section', () => {
    const r = decode(vilOf((o) => { o.encoder_layout = 'nope'; }));
    assert.ok(allErrors(r).length > 0);
  });

  it('blocks export when a raw encoder pair sits inside encoder_layout', () => {
    const r = decode(vilOf((o) => { o.encoder_layout[0][0] = ['KC_A']; }));
    assert.ok(allErrors(r).length > 0);
  });

  it('blocks export when layout_options is a raw section', () => {
    const r = decode(vilOf((o) => { o.layout_options = 'nope'; }));
    assert.ok(allErrors(r).length > 0);
  });

  it('does not block the owner fixture, whose required sections are valid', () => {
    assert.deepEqual(allErrors(decode(H.readText(H.FIXTURE_VIL))), []);
  });
});

describe('VERIFY-3 layout options packing (vial.json labels, R5)', () => {
  const labels = JSON.parse(H.readText(H.VIAL_JSON)).layouts.labels;
  const packed = KS.vil.layoutOptions;

  it('decodes the owner default 0 as every option off', () => {
    const opts = packed.decode(0, labels);
    assert.deepEqual(opts.map((o) => o.value), [0, 0, 0, 0]);
    assert.deepEqual(opts.map((o) => o.kind), ['bool', 'select', 'bool', 'select']);
  });

  it('decodes 10 as label[0] most significant: 1010', () => {
    const opts = packed.decode(10, labels);
    assert.deepEqual(opts.map((o) => o.value), [1, 0, 1, 0]);
    assert.equal(opts[0].label, 'Soldered encoder left');
    assert.equal(opts[1].label, 'Halcyon module left');
    assert.deepEqual(opts[1].choices, ['None', 'Encoder']);
  });

  it('decodes 15 as all set', () => {
    assert.deepEqual(packed.decode(15, labels).map((o) => o.value), [1, 1, 1, 1]);
  });

  it('encodes option values back to the same number for every 4-bit value', () => {
    for (let v = 0; v <= 15; v++) {
      const values = packed.decode(v, labels).map((o) => o.value);
      assert.equal(packed.encode(values, labels), v, `round trip of ${v}`);
    }
  });

  it('encodes the owner values 0, 10 and 15 from their decoded options', () => {
    assert.equal(packed.encode([0, 0, 0, 0], labels), 0);
    assert.equal(packed.encode([1, 0, 1, 0], labels), 10);
    assert.equal(packed.encode([1, 1, 1, 1], labels), 15);
  });

  it('never silently encodes an out-of-range select choice', () => {
    let got;
    try { got = packed.encode([0, 2, 0, 0], labels); } catch (e) { got = e; }
    assert.notEqual(typeof got, 'number', 'choice 2 of a 2-choice select must not encode');
  });
});
