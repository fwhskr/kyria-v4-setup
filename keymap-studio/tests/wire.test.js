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
