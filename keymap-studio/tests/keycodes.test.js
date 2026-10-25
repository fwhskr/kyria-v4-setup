'use strict';
// VERIFY-6 (keycodes): every owner-file name is known and round-trips; canonical names are emitted;
// KC_NONUS_BACKSLASH is invalid; check() enforces grammar and ranges; forCharacter matches the firmware table.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const KS = require('./load-core.js');
const H = require('./helpers.js');

const { parse, format, check, isKnown, byId, catalog, categories, forCharacter, macroActions, KeycodeError } = KS.keycodes;
const isError = (i) => i.severity === 'error';
const errorsOf = (text, limits) => check(text, limits).filter(isError);

const OWNER = H.ownerCodes();
const fixtureOracle = JSON.parse(H.readText(H.FIXTURE_VIL));
const OWNER_LIMITS = { layers: fixtureOracle.layout.length, macros: fixtureOracle.macro.length, tapDances: fixtureOracle.tap_dance.length };

describe('VERIFY-6 owner-file names', () => {
  it('reads a real code set from both owner files', () => {
    assert.ok(OWNER.length > 100, `only ${OWNER.length} codes read`);
    assert.ok(OWNER.includes('KC__VOLUP'));
    assert.ok(OWNER.includes('KC_TRNS'));
  });

  it('knows every owner-file code', () => {
    assert.deepEqual(OWNER.filter((c) => !isKnown(c)), []);
  });

  it('parses and formats every owner-file code back to the same text', () => {
    const mismatches = OWNER.filter((c) => format(parse(c)) !== c).map((c) => ({ c, got: format(parse(c)) }));
    assert.deepEqual(mismatches, []);
  });

  it('passes check() within the owner file ranges', () => {
    const failing = OWNER.filter((c) => errorsOf(c, OWNER_LIMITS).length > 0);
    assert.deepEqual(failing, []);
  });
});

describe('VERIFY-6 canonical names and aliases', () => {
  it('KC_NONUS_BSLASH is the canonical entry for the Estonian ISO key (alias KC_NUBS)', () => {
    const entry = byId('KC_NONUS_BSLASH');
    assert.equal(entry.id, 'KC_NONUS_BSLASH');
    assert.equal(entry.hid, 0x64);
    assert.equal(byId('KC_NUBS').id, 'KC_NONUS_BSLASH');
  });

  it('emits the canonical name for an alias', () => {
    assert.equal(format(parse('KC_NUBS')), 'KC_NONUS_BSLASH');
    assert.equal(format(parse('KC_BSPC')), 'KC_BSPACE');
  });

  it('treats KC_NONUS_BACKSLASH as invalid: unknown, no entry, check error, raw on parse', () => {
    assert.equal(isKnown('KC_NONUS_BACKSLASH'), false);
    assert.equal(byId('KC_NONUS_BACKSLASH'), null);
    assert.ok(errorsOf('KC_NONUS_BACKSLASH', OWNER_LIMITS).length > 0);
    assert.equal(parse('KC_NONUS_BACKSLASH').k, 'raw');
  });

  it('keeps categories and catalog consistent', () => {
    assert.equal(new Set(catalog.map((e) => e.id)).size, catalog.length, 'catalog ids are unique');
    for (const cat of categories) {
      for (const id of cat.ids) assert.ok(byId(id), `category ${cat.id} lists unknown ${id}`);
    }
  });

  it('knows compound forms whose inner code is known', () => {
    assert.equal(isKnown('LSFT(KC_5)'), true);
    assert.equal(isKnown('LCTL_T(KC_ESCAPE)'), true);
    assert.equal(isKnown('LSFT(KC_NONUS_BACKSLASH)'), false);
  });
});

describe('VERIFY-6 check() grammar and ranges', () => {
  const valid = ['KC_A', 'LSFT(KC_5)', 'RALT(KC_4)', 'LCTL(KC_C)', 'LCTL_T(KC_ESCAPE)', 'MO(3)', 'M0', 'TD(0)', 'KC_NO', 'KC_TRNS', 'RM_TOGG', 'KC_NONUS_BSLASH'];
  for (const text of valid) {
    it(`accepts ${text}`, () => {
      assert.deepEqual(errorsOf(text, { layers: 8, macros: 16, tapDances: 32 }), []);
    });
  }

  const invalid = ['KC_NONUS_BACKSLASH', 'KC_FOO', 'kc_a', '', 'MO(8)', 'MO(-1)', 'M16', 'TD(32)', 'LSFT(KC_5'];
  for (const text of invalid) {
    it(`rejects ${JSON.stringify(text)}`, () => {
      assert.ok(errorsOf(text, { layers: 8, macros: 16, tapDances: 32 }).length > 0);
    });
  }
});

describe('VERIFY-6 parse and format', () => {
  it('parses the basic kinds', () => {
    assert.equal(parse('KC_NO').k, 'none');
    assert.equal(parse('KC_TRNS').k, 'trans');
    assert.equal(parse('KC_A').k, 'basic');
    assert.equal(parse('KC_A').id, 'KC_A');
  });

  it('parses a shifted key with its inner key and the left shift flag', () => {
    const a = parse('LSFT(KC_5)');
    assert.equal(a.k, 'mods');
    assert.equal(a.mods.shift, true);
    assert.ok(!a.mods.right, 'LSFT is not the right-hand flag');
    assert.equal(a.inner.id, 'KC_5');
  });

  it('parses the right-hand shift flag from RSFT', () => {
    assert.equal(parse('RSFT(KC_5)').mods.right, true);
  });

  it('parses layer, mod-tap, tap dance and macro actions', () => {
    const layer = parse('MO(3)');
    assert.equal(layer.k, 'layer');
    assert.equal(layer.fn, 'MO');
    assert.equal(layer.layer, 3);
    const mt = parse('LCTL_T(KC_ESCAPE)');
    assert.equal(mt.k, 'modtap');
    assert.equal(mt.mods.ctrl, true);
    assert.equal(mt.tap.id, 'KC_ESCAPE');
    assert.equal(parse('TD(2)').index, 2);
    assert.equal(parse('M0').index, 0);
  });

  it('keeps an unknown code verbatim as raw', () => {
    const r = parse('KC_FOO');
    assert.equal(r.k, 'raw');
    assert.equal(r.text, 'KC_FOO');
  });

  it('never throws on junk input', () => {
    for (const cell of ['', '(', ')', 'MO(', 'LSFT()', 'KC_A)', 123, -1, 0]) {
      assert.doesNotThrow(() => parse(cell));
    }
  });

  it('formats composed actions with Vial names', () => {
    assert.equal(format({ k: 'mods', mods: { shift: true }, inner: { k: 'basic', id: 'KC_5' } }), 'LSFT(KC_5)');
    assert.equal(format({ k: 'mods', mods: { shift: true, right: true }, inner: { k: 'basic', id: 'KC_5' } }), 'RSFT(KC_5)');
    assert.equal(format({ k: 'layer', fn: 'MO', layer: 3 }), 'MO(3)');
    assert.equal(format({ k: 'none' }), 'KC_NO');
    assert.equal(format({ k: 'trans' }), 'KC_TRNS');
  });

  it('refuses to format a name that is not in the catalog', () => {
    assert.throws(() => format({ k: 'basic', id: 'KC_NONUS_BACKSLASH' }), KeycodeError);
  });
});

// Oracle: which ways the firmware table types a character. Plain text is lowercase; shift and altgr codes wrap KC_x.
const TYPING = ['plain', 'shift', 'altgr', 'shiftAltgr'];
const WRAP = [(n) => n, (n) => `LSFT(${n})`, (n) => `RALT(${n})`];
// LLA §4 forCharacter: shiftAltgr is the catalog's right Shift+Alt wrap, offered only when format() gives a known code.
function shiftAltgrCode(name) {
  let code;
  try {
    code = format({ k: 'mods', mods: { shift: true, alt: true, right: true }, inner: { k: 'basic', id: name } });
  } catch {
    return null;
  }
  return isKnown(code) ? code : null;
}
function oracleOptions(ch) {
  const out = [];
  for (const [hid, row] of H.estonianFirmwareTable().byHid) {
    const name = H.HID_NAME.get(hid);
    H.expectedLevels(row, hid).forEach((c, i) => {
      if (c !== ch) return;
      const code = i === 3 ? shiftAltgrCode(name) : WRAP[i](name);
      if (code === null) return;
      out.push(key({ code, level: TYPING[i], hid, dead: H.isDeadFact(hid, i), keypad: name.startsWith('KC_KP_') }));
    });
  }
  return out;
}
const key = (o) => `${o.code}|${o.level}|${o.hid}|${o.dead}|${o.keypad}`;
const actualKey = (o) => key(o);

describe('VERIFY-6 forCharacter (GOAL-0)', () => {
  it('lists every typed way for every firmware character, matching the table', () => {
    const chars = new Set();
    for (const [hid, row] of H.estonianFirmwareTable().byHid) {
      H.expectedLevels(row, hid).forEach((c) => { if (c !== null) chars.add(c); });
    }
    const mismatches = [];
    for (const ch of chars) {
      const got = forCharacter(ch).direct.map(actualKey).sort();
      const want = oracleOptions(ch).sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) mismatches.push({ ch, got, want });
    }
    assert.deepEqual(mismatches, []);
  });

  it('orders plain before shift before altgr, and typing keys before keypad', () => {
    // '/' is on the keypad (plain) and on a typing key (shift of KC_7): both must appear, in that order.
    const LEVEL_RANK = { plain: 0, shift: 1, altgr: 2, shiftAltgr: 3 };
    const direct = forCharacter('/').direct;
    assert.ok(direct.some((o) => o.keypad), 'keypad option expected');
    assert.ok(direct.some((o) => !o.keypad), 'typing option expected');
    const ranks = direct.map((o) => LEVEL_RANK[o.level]);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
    for (const level of TYPING) {
      const flags = direct.filter((o) => o.level === level).map((o) => o.keypad);
      assert.deepEqual(flags, [...flags].sort((a, b) => Number(a) - Number(b)), `${level}: keypad must follow typing keys`);
    }
  });

  it('gives KC_SCOLON for ö on the plain level', () => {
    const o = forCharacter('ö').direct.find((x) => x.code === 'KC_SCOLON');
    assert.deepEqual({ level: o.level, hid: o.hid, dead: o.dead, keypad: o.keypad }, { level: 'plain', hid: 0x33, dead: false, keypad: false });
  });

  it('gives LSFT(KC_SCOLON) for Ö on the shift level', () => {
    assert.ok(forCharacter('Ö').direct.some((x) => x.code === 'LSFT(KC_SCOLON)' && x.level === 'shift'));
  });

  it('gives a right-alt code for € on altgr: RALT(KC_E) and RALT(KC_5)', () => {
    const codes = forCharacter('€').direct.filter((x) => x.level === 'altgr').map((x) => x.code).sort();
    assert.deepEqual(codes, ['RALT(KC_5)', 'RALT(KC_E)']);
  });

  it('marks ´ as a dead key on KC_EQUAL', () => {
    const o = forCharacter('´').direct.find((x) => x.code === 'KC_EQUAL');
    assert.equal(o.dead, true);
    assert.equal(o.level, 'plain');
  });

  it('lists õ on KC_RBRACKET and Õ on LSFT(KC_RBRACKET)', () => {
    assert.ok(forCharacter('õ').direct.some((x) => x.code === 'KC_RBRACKET' && x.level === 'plain'));
    assert.ok(forCharacter('Õ').direct.some((x) => x.code === 'LSFT(KC_RBRACKET)' && x.level === 'shift'));
  });

  it('gives a dead-key sequence for é: dead acute (KC_EQUAL) then KC_E, and no direct key', () => {
    const r = forCharacter('é');
    assert.deepEqual(r.direct, []);
    assert.deepEqual(r.sequence, ['KC_EQUAL', 'KC_E']);
  });

  it('gives no sequence for a character that is on the layout', () => {
    assert.equal(forCharacter('ö').sequence, null);
  });

  it('gives nothing for a character the Estonian layout cannot type', () => {
    const r = forCharacter('中');
    assert.deepEqual(r.direct, []);
    assert.equal(r.sequence, null);
  });
});

describe('VERIFY-6 isKnown (qmk_id, alias, compound)', () => {
  it('knows the canonical name and its alias', () => {
    assert.equal(isKnown('KC_NONUS_BSLASH'), true);
    assert.equal(isKnown('KC_NUBS'), true);
  });

  it('does not know the invalid name KC_NONUS_BACKSLASH or a typo', () => {
    assert.equal(isKnown('KC_NONUS_BACKSLASH'), false);
    assert.equal(isKnown('KC_AA'), false);
  });

  it('knows a compound form whose inner code is known, and not one whose inner code is not', () => {
    assert.equal(isKnown('RALT(KC_4)'), true);
    assert.equal(isKnown('RALT(KC_NONUS_BACKSLASH)'), false);
  });
});

describe('VERIFY-6 macroActions (basic keycodes only, LLA §4)', () => {
  const basic = /^KC_[A-Z0-9_]+$/;
  const MODS = /^KC_(L|R)(SHIFT|ALT|CTRL|GUI)$|^KC_RALT$/;

  it('taps a plain key', () => {
    assert.deepEqual(macroActions('KC_A'), [['tap', 'KC_A']]);
  });

  it('holds Shift around a shifted key', () => {
    assert.deepEqual(macroActions('LSFT(KC_GRAVE)'), [['down', 'KC_LSHIFT'], ['tap', 'KC_GRAVE'], ['up', 'KC_LSHIFT']]);
  });

  it('holds AltGr around an AltGr key', () => {
    assert.deepEqual(macroActions('RALT(KC_E)'), [['down', 'KC_RALT'], ['tap', 'KC_E'], ['up', 'KC_RALT']]);
  });

  it('builds ñ as the dead tilde then KC_N, from the forCharacter sequence', () => {
    const seq = forCharacter('ñ').sequence;
    assert.deepEqual(seq, ['LSFT(KC_GRAVE)', 'KC_N']);
    assert.deepEqual([...macroActions(seq[0]), ...macroActions(seq[1])],
      [['down', 'KC_LSHIFT'], ['tap', 'KC_GRAVE'], ['up', 'KC_LSHIFT'], ['tap', 'KC_N']]);
  });

  it('builds é as the dead acute then KC_E', () => {
    const seq = forCharacter('é').sequence;
    assert.deepEqual([...macroActions(seq[0]), ...macroActions(seq[1])], [['tap', 'KC_EQUAL'], ['tap', 'KC_E']]);
  });

  it('emits only down, tap and up with basic keycodes for every direct code of sample characters', () => {
    const bad = [];
    for (const c of ['ö', '%', '€', '´', 'õ', '@', 'A']) {
      for (const o of forCharacter(c).direct) {
        if (o.level === 'shiftAltgr') continue;
        for (const [kind, k] of macroActions(o.code)) {
          if (!['down', 'tap', 'up'].includes(kind) || !(basic.test(k) || MODS.test(k))) bad.push([c, o.code, kind, k]);
        }
      }
    }
    assert.deepEqual(bad, []);
  });

  it('nests Shift and AltGr around a Shift+AltGr key when the catalog offers that code', (t) => {
    const codes = [];
    for (const hid of H.estonianFirmwareTable().byHid.keys()) {
      const code = shiftAltgrCode(H.HID_NAME.get(hid));
      if (code !== null) codes.push(code);
    }
    if (codes.length === 0) return t.skip('catalog has no right Shift+Alt wrap, so forCharacter offers no Shift+AltGr code');
    for (const code of codes) {
      const acts = macroActions(code);
      assert.deepEqual(acts.map((a) => a[0]), ['down', 'down', 'tap', 'up', 'up'], code);
      assert.ok(acts.some(([k, m]) => k === 'down' && m === 'KC_RALT'), code);
      assert.match(acts[0][1], /^KC_(L|R)SHIFT$/, code);
    }
  });
});
