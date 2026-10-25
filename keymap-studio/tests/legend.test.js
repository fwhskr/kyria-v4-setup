'use strict';
// VERIFY-6 (legends): what an Estonian host types for each code, transparent-key inheritance,
// encoder direction (dir 0 = clockwise), and macro text with dead-key composition (~n gives ñ).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const KS = require('./load-core.js');
const H = require('./helpers.js');

const table = H.estonianFirmwareTable();
const ws = () => KS.workspace.fromDefault();
const describeCode = (code) => KS.legend.describe(code, ws());
const hidOfName = (name) => {
  const entry = [...H.HID_NAME].find(([, n]) => n === name);
  assert.ok(entry, `no HID for ${name}`);
  return entry[0];
};
const levelsOfName = (name) => H.expectedLevels(table.byHid.get(hidOfName(name)));

describe('VERIFY-6 main text for the cited examples', () => {
  it('LSFT(KC_5) types %', () => {
    const l = describeCode('LSFT(KC_5)');
    assert.equal(l.code, 'LSFT(KC_5)');
    assert.equal(l.main, '%');
  });

  it('RALT(KC_4) types $', () => {
    assert.equal(describeCode('RALT(KC_4)').main, '$');
  });

  it('KC_SCOLON types ö, with Ö on shift', () => {
    const l = describeCode('KC_SCOLON');
    assert.equal(l.main, 'ö');
    assert.equal(l.shift, 'Ö');
    assert.equal(l.altgr, '´');
    assert.equal(l.shiftAltgr, '˝');
  });

  it('LCTL(KC_C) is a shortcut shown as Ctrl + c', () => {
    const l = describeCode('LCTL(KC_C)');
    assert.equal(l.main, 'Ctrl + c');
    assert.equal(l.kind, 'shortcut');
  });

  it('KC_NONUS_BSLASH shows < > | ¦ on the four levels', () => {
    const l = describeCode('KC_NONUS_BSLASH');
    assert.deepEqual([l.main, l.shift, l.altgr, l.shiftAltgr], ['<', '>', '|', '¦']);
  });

  it('KC_NO is none', () => {
    assert.equal(describeCode('KC_NO').kind, 'none');
  });

  it('MO(3) is a layer action for layer 3', () => {
    const l = describeCode('MO(3)');
    assert.equal(l.kind, 'layer');
    assert.equal(l.layer, 3);
  });

  it('shows an unknown code verbatim as raw and flags it unknown', () => {
    const l = describeCode('KC_NONUS_BACKSLASH');
    assert.equal(l.kind, 'raw');
    assert.equal(l.unknown, true);
    assert.equal(l.main, 'KC_NONUS_BACKSLASH');
  });

  it('fills the hold text of a mod-tap', () => {
    assert.equal(describeCode('LCTL_T(KC_ESCAPE)').hold.kind, 'mod');
    assert.match(describeCode('LCTL_T(KC_ESCAPE)').hold.text, /ctrl/i);
    assert.match(describeCode('LALT_T(KC_ENTER)').hold.text, /alt/i);
  });

  it('marks ´ on KC_EQUAL and ˇ on KC_GRAVE as dead', () => {
    assert.equal(describeCode('KC_EQUAL').main, '´');
    assert.equal(describeCode('KC_EQUAL').dead, true);
    assert.equal(describeCode('KC_GRAVE').main, 'ˇ');
    assert.equal(describeCode('KC_GRAVE').dead, true);
  });

  it('does not mark a plain letter as dead', () => {
    assert.ok(!describeCode('KC_A').dead);
  });
});

describe('VERIFY-6 every typing key matches the firmware table', () => {
  it('gives the four levels of every typing key from layout_tables.h', () => {
    const mismatches = [];
    for (const [hid, name] of H.HID_NAME) {
      if (!table.byHid.has(hid)) continue;
      const want = H.expectedLevels(table.byHid.get(hid));
      const l = describeCode(name);
      const got = [l.main, l.shift, l.altgr, l.shiftAltgr];
      want.forEach((c, i) => {
        if (c !== null && got[i] !== c) mismatches.push({ name, level: i, got: got[i], want: c });
      });
    }
    assert.deepEqual(mismatches, []);
    assert.deepEqual(levelsOfName('KC_A'), ['a', 'A', 'æ', 'Æ']);
  });

  it('has an accessible name for every owner-file code', () => {
    for (const code of H.ownerCodes()) {
      const l = describeCode(code);
      assert.equal(l.code, code);
      assert.equal(typeof l.a11y, 'string', code);
      assert.ok(l.a11y.length > 0, `${code} has no accessible name`);
    }
  });
});

describe('VERIFY-6 transparent keys (ADR-S7)', () => {
  const layout = JSON.parse(H.readText(H.FIXTURE_VIL)).layout;

  it('shows the layer 0 value for a KC_TRNS key with inherited:true', () => {
    let found = null;
    for (let l = 1; l < layout.length && !found; l++) {
      for (let r = 0; r < layout[l].length && !found; r++) {
        for (let c = 0; c < layout[l][r].length && !found; c++) {
          if (layout[l][r][c] === 'KC_TRNS' && layout[0][r][c] !== -1 && layout[0][r][c] !== 'KC_TRNS') {
            found = { layer: l, row: r, col: c, base: layout[0][r][c] };
          }
        }
      }
    }
    assert.ok(found, 'fixture must contain a transparent key over a layer 0 key');
    const l = KS.legend.at(ws(), found.layer, found.row, found.col);
    assert.equal(l.inherited, true);
    assert.equal(l.fromLayer, 0);
    assert.equal(l.code, found.base);
    assert.equal(l.main, describeCode(found.base).main);
  });

  it('does not mark a key that is not transparent as inherited', () => {
    assert.equal(KS.legend.at(ws(), 0, 0, 1).inherited, false);
  });
});

describe('VERIFY-6 encoder direction (R6: dir 0 = clockwise)', () => {
  const enc = JSON.parse(H.readText(H.FIXTURE_VIL)).encoder_layout;

  it('returns the code stored at encoder_layout[layer][index][dir] for every position', () => {
    const mismatches = [];
    enc.forEach((layer, l) => layer.forEach((pair, i) => [0, 1].forEach((d) => {
      const got = KS.legend.encoder(ws(), l, i, d).code;
      if (got !== pair[d]) mismatches.push({ l, i, d, got, want: pair[d] });
    })));
    assert.deepEqual(mismatches, []);
  });

  it('labels dir 0 clockwise and dir 1 counter-clockwise', () => {
    const cw = KS.legend.encoder(ws(), 0, 0, 0).a11y;
    const ccw = KS.legend.encoder(ws(), 0, 0, 1).a11y;
    assert.match(cw, /clockwise/i);
    assert.doesNotMatch(cw, /counter/i);
    assert.match(ccw, /counter/i);
  });
});

describe('VERIFY-6 macro text (dead-key composition, ~n gives ñ)', () => {
  // Map each spacing dead accent of the firmware to its combining mark, for NFC composition.
  const COMBINING = { '~': '\u0303', '´': '\u0301', '`': '\u0300', '^': '\u0302', '¨': '\u0308', '˚': '\u030a', '¯': '\u0304', '˘': '\u0306', '˝': '\u030b', 'ˇ': '\u030c', '˙': '\u0307', '¸': '\u0327' };

  it('composes ~n into ñ: the Estonian shift of KC_GRAVE is a dead tilde, then n', () => {
    const deadTilde = levelsOfName('KC_GRAVE')[1];
    assert.equal(deadTilde, '~');
    assert.ok(H.isDeadFact(0x35, 1), 'shift of KC_GRAVE is a dead key (FACT)');
    const computed = (`n${COMBINING[deadTilde]}`).normalize('NFC');
    assert.equal(computed, '\u00f1');
    const r = KS.legend.macroText([['text', '~n']]);
    assert.equal(r.text, computed);
    assert.equal(r.complete, true);
  });

  it('types plain and shifted letters as the Estonian host does', () => {
    assert.equal(KS.legend.macroText([['text', 'Ab']]).text, 'Ab');
  });

  it('is incomplete when a macro holds a key that is not a character', () => {
    assert.equal(KS.legend.macroText([['tap', 'KC_F5']]).complete, false);
  });

  it('is complete and empty for an empty macro', () => {
    const r = KS.legend.macroText([]);
    assert.equal(r.text, '');
    assert.equal(r.complete, true);
  });
});

describe('VERIFY-6 macroText examples (LLA §4a and API-LEG)', () => {
  // Each US input gives the Estonian output on the ee layout, with dead accents composed by NFC.
  const EXAMPLES = [
    ['~n', 'ñ'],
    ['=e', 'é'],
    ['`s', 'š'],
    ['@', '"'],
    ['[', 'ü'],
    [';', 'ö'],
    ['~ ', '~'],
  ];
  for (const [input, want] of EXAMPLES) {
    it(`types ${JSON.stringify(input)} as ${JSON.stringify(want)}, complete`, () => {
      const r = KS.legend.macroText([['text', input]]);
      assert.equal(r.text, want);
      assert.equal(r.complete, true);
    });
  }

  it('shows õ, which is outside the allowlist, as ? and marks the macro incomplete', () => {
    const r = KS.legend.macroText([['text', 'õ']]);
    assert.equal(r.text, '?');
    assert.equal(r.complete, false);
  });

  it('marks a trailing dead accent incomplete', () => {
    assert.equal(KS.legend.macroText([['text', '~']]).complete, false);
  });

  it('tracks Shift from down and up actions', () => {
    const r = KS.legend.macroText([['down', 'KC_LSHIFT'], ['tap', 'KC_5'], ['up', 'KC_LSHIFT']]);
    assert.equal(r.text, '%');
    assert.equal(r.complete, true);
  });

  it('shows control characters as their key symbols', () => {
    assert.equal(KS.legend.macroText([['text', '\b']]).text, '⌫');
    assert.equal(KS.legend.macroText([['text', '\t']]).text, '⇥');
    assert.equal(KS.legend.macroText([['text', '\n']]).text, '⏎');
    assert.equal(KS.legend.macroText([['text', '\x1b']]).text, 'Esc');
  });
});
