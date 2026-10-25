'use strict';
// VERIFY-5: the Estonian output table equals the firmware's layout_tables.h (dead-key variant) under the
// uppercase display mapping. Dead flags are checked against the LLA §4 FACT list, written here as data.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const KS = require('./load-core.js');
const H = require('./helpers.js');

const { DEAD_FACT } = H;

const table = H.estonianFirmwareTable();
const hids = [...table.byHid.keys()].sort((a, b) => a - b);
const deadFor = (hid) => [0, 1, 2, 3].map((i) => H.isDeadFact(hid, i));

describe('VERIFY-5 coverage', () => {
  it('reads all 66 typing rows from the firmware table', () => {
    assert.equal(table.rowCount, 66);
    assert.equal(hids.length, 66);
  });

  it('returns an entry for every typing HID', () => {
    const missing = hids.filter((h) => KS.estonian.output(h) === null);
    assert.deepEqual(missing, []);
  });

  it('returns null for HIDs that are not typing keys', () => {
    for (const hid of [0x00, 0x28, 0xe0]) assert.equal(KS.estonian.output(hid), null, `HID 0x${hid.toString(16)}`);
  });

  it('has every dead-flag HID of the FACT list in the firmware table', () => {
    for (const hid of Object.keys(DEAD_FACT).map(Number)) assert.ok(table.byHid.has(hid), `0x${hid.toString(16)}`);
  });
});

describe('VERIFY-5 four levels equal the firmware table', () => {
  it('matches the firmware row for every typing HID (uppercase display mapping)', () => {
    const mismatches = [];
    for (const hid of hids) {
      const got = KS.estonian.output(hid);
      const want = H.expectedLevels(table.byHid.get(hid), hid);
      if (JSON.stringify(got && got.levels) !== JSON.stringify(want)) {
        mismatches.push({ hid: `0x${hid.toString(16)}`, got: got && got.levels, want });
      }
    }
    assert.deepEqual(mismatches, []);
  });

  it('gives lowercase plain letters and uppercase shift letters', () => {
    const a = KS.estonian.output(0x04);
    assert.equal(a.levels[0], 'a');
    assert.equal(a.levels[1], 'A');
  });

  it('gives lowercase AltGr letters and uppercase Shift+AltGr letters (xkb host case)', () => {
    const a = KS.estonian.output(0x04);
    assert.equal(a.levels[2], 'æ');
    assert.equal(a.levels[3], 'Æ');
  });

  it('gives null where the firmware table has 0', () => {
    const j = KS.estonian.output(0x0d);
    assert.equal(j.levels[2], null);
    assert.equal(j.levels[3], null);
  });

  it('matches cited examples: KC_SCOLON, LSFT(KC_5), RALT(KC_4), KC_NONUS_BSLASH', () => {
    assert.equal(KS.estonian.output(0x33).levels[0], 'ö');
    assert.equal(KS.estonian.output(0x22).levels[1], '%');
    assert.equal(KS.estonian.output(0x21).levels[2], '$');
    assert.deepEqual(KS.estonian.output(0x64).levels, ['<', '>', '|', '¦']);
  });
});

describe('VERIFY-5 dead flags', () => {
  it('equal the LLA §4 FACT list exactly for every typing HID', () => {
    const mismatches = [];
    for (const hid of hids) {
      const got = KS.estonian.output(hid).dead;
      if (JSON.stringify(got) !== JSON.stringify(deadFor(hid))) {
        mismatches.push({ hid: `0x${hid.toString(16)}`, got, want: deadFor(hid) });
      }
    }
    assert.deepEqual(mismatches, []);
  });

  it('are independently backed by the firmware glyphs: a dead level shows an accent or nothing', () => {
    // A dead level holds an accent (not a letter or digit). Only 0x0d has no glyph in the table.
    const problems = [];
    for (const [hidText, levelsDead] of Object.entries(DEAD_FACT)) {
      const hid = Number(hidText);
      const row = table.byHid.get(hid);
      levelsDead.forEach((i) => {
        const c = row[i];
        if (c === null && hid !== 0x0d) problems.push(`0x${hid.toString(16)} level ${i} is blank`);
        if (c !== null && /[A-Za-z0-9]/.test(c)) problems.push(`0x${hid.toString(16)} level ${i} is ${c}, not an accent`);
      });
    }
    assert.deepEqual(problems, []);
  });
});
