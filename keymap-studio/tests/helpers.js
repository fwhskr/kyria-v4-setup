'use strict';
// Shared oracles for the Keymap Studio suite. No dependencies; repo paths are relative to this file.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const TESTS_DIR = __dirname;
const REPO_DIR = path.join(TESTS_DIR, '..', '..');
const FIXTURE_VIL = path.join(TESTS_DIR, 'fixtures', 'kriskyria.vil');
const BACKUP_VIL = path.join(REPO_DIR, 'backups', 'kyriav4current.vil');
const KEYMAP_DIR = path.join(REPO_DIR, 'firmware', 'keyboards', 'splitkb', 'halcyon', 'kyria', 'keymaps', 'keypress_hlc');
const LAYOUT_TABLES_H = path.join(KEYMAP_DIR, 'layout_tables.h');
const VIAL_JSON = path.join(KEYMAP_DIR, 'vial.json');

// Exact uid text from the owner files (above 2^53, so JSON.parse must never be used for it).
const KNOWN_UID = '10669769700359951850';
const ROUNDED_UID = '10669769700359952000';

const readBytes = (file) => fs.readFileSync(file);
const readText = (file) => readBytes(file).toString('utf8');

function assertSameBytes(actualText, expectedBytes, label) {
  const actual = Buffer.from(actualText, 'utf8');
  if (actual.equals(expectedBytes)) return;
  let i = 0;
  while (i < actual.length && actual[i] === expectedBytes[i]) i++;
  assert.fail(`${label}: bytes differ at ${i} (got ${actual.length} bytes, want ${expectedBytes.length})`);
}

// Compares data, not prototypes: implementations may build plain or null-prototype objects.
function sameData(actual, expected, message) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// Python json.dumps style writer (', ' and ': '). RAW(text) emits digits verbatim, needed for the uid.
const RAW = (text) => ({ __raw: text });
function py(value) {
  if (value !== null && typeof value === 'object' && '__raw' in value) return value.__raw;
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(py).join(', ')}]`;
  return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${py(v)}`).join(', ')}}`;
}

// The owner fixture as a mutable object, with the uid kept as exact digits.
function fixtureObject() {
  const o = JSON.parse(readText(FIXTURE_VIL));
  o.uid = RAW(KNOWN_UID);
  return o;
}

// Builds a .vil text from the owner fixture after an edit. Output keeps the owner's Python-style layout.
function vilText(mutate) {
  const o = fixtureObject();
  if (mutate) mutate(o);
  return py(o);
}

// Cell rule from the firmware: 0 means nothing printable; "\xNN" bytes are UTF-8.
function decodeCell(s) {
  if (s === '0') return null;
  const m = /^"(.*)"$/.exec(s);
  assert.ok(m, `unexpected C table cell ${s}`);
  const bytes = [...m[1].matchAll(/\\x([0-9a-f]{2})/g)].map((x) => parseInt(x[1], 16));
  return Buffer.from(bytes).toString('utf8');
}

// Estonian dead-key variant from layout_tables.h, keyed by HID. Levels: [plain, shift, altgr, shiftAltgr].
function estonianFirmwareTable() {
  const src = readText(LAYOUT_TABLES_H);
  const hidToRow = new Map();
  for (const m of src.matchAll(/\[0x([0-9a-f]{2})\] = (\d+),/g)) hidToRow.set(parseInt(m[1], 16), Number(m[2]));
  const lines = src.split('\n');
  const start = lines.indexOf('    { // Estonian');
  assert.ok(start > 0, 'Estonian dead-key block not found in layout_tables.h');
  const rows = [];
  for (let i = start + 1; lines[i] !== '    },'; i++) {
    const m = /^\s+\{(.*)\}, \/\/ 0x([0-9a-f]{2}) /.exec(lines[i]);
    assert.ok(m, `unparsed Estonian row: ${lines[i]}`);
    rows.push({ hid: parseInt(m[2], 16), levels: m[1].split(', ').map(decodeCell) });
  }
  const byHid = new Map();
  for (const [hid, row] of hidToRow) {
    assert.equal(rows[row - 1].hid, hid, `row ${row} comment HID disagrees with key_table_row`);
    byHid.set(hid, rows[row - 1].levels);
  }
  return { byHid, rowCount: rows.length };
}

// Expected Estonian output from the firmware. The table stores every letter uppercase (display form), so the
// host case rule is applied (xkb): plain and AltGr letters are lowercase, Shift and Shift+AltGr stay uppercase.
// Non-letters are unchanged. Unicode letters (Õ, Æ, Ŋ) are included.
function expectedLevels(levels) {
  return levels.map((c, i) => {
    if (c === null) return null;
    const lowercaseLevel = i === 0 || i === 2;
    return lowercaseLevel && /^\p{Lu}$/u.test(c) ? c.toLowerCase() : c;
  });
}

// Standard USB HID usage names for the typing and keypad keys the owner files use.
const HID_NAME = new Map();
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch, i) => HID_NAME.set(0x04 + i, `KC_${ch}`));
['KC_1', 'KC_2', 'KC_3', 'KC_4', 'KC_5', 'KC_6', 'KC_7', 'KC_8', 'KC_9', 'KC_0'].forEach((n, i) => HID_NAME.set(0x1e + i, n));
Object.entries({
  0x2d: 'KC_MINUS', 0x2e: 'KC_EQUAL', 0x2f: 'KC_LBRACKET', 0x30: 'KC_RBRACKET', 0x31: 'KC_BSLASH',
  0x32: 'KC_NONUS_HASH', 0x33: 'KC_SCOLON', 0x34: 'KC_QUOTE', 0x35: 'KC_GRAVE', 0x36: 'KC_COMMA',
  0x37: 'KC_DOT', 0x38: 'KC_SLASH', 0x54: 'KC_KP_SLASH', 0x55: 'KC_KP_ASTERISK', 0x56: 'KC_KP_MINUS',
  0x57: 'KC_KP_PLUS', 0x59: 'KC_KP_1', 0x5a: 'KC_KP_2', 0x5b: 'KC_KP_3', 0x5c: 'KC_KP_4', 0x5d: 'KC_KP_5',
  0x5e: 'KC_KP_6', 0x5f: 'KC_KP_7', 0x60: 'KC_KP_8', 0x61: 'KC_KP_9', 0x62: 'KC_KP_0', 0x63: 'KC_KP_DOT',
  0x64: 'KC_NONUS_BSLASH', 0x67: 'KC_KP_EQUAL', 0x85: 'KC_KP_COMMA',
}).forEach(([hid, name]) => HID_NAME.set(Number(hid), name));

// LLA §4 FACT list (libxkbcommon "ee"), the only source of dead flags: the table cannot show them
// (0x0d has no glyph at all). Index: 0 plain, 1 shift, 2 altgr, 3 shift+altgr.
const DEAD_FACT = {
  0x0d: [2, 3], 0x2e: [0, 1, 3], 0x2f: [2, 3], 0x30: [3], 0x31: [3], 0x32: [3],
  0x33: [2, 3], 0x34: [3], 0x35: [0, 1], 0x38: [3],
};
const isDeadFact = (hid, level) => (DEAD_FACT[hid] || []).includes(level);

// Every keycode string the owner files hold, read with JSON.parse (plain values only; the uid is never read here).
function ownerCodes() {
  const codes = new Set();
  const strings = (v, out) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  };
  for (const file of [FIXTURE_VIL, BACKUP_VIL]) {
    const o = JSON.parse(readText(file));
    const out = [];
    strings(o.layout, out);
    strings(o.encoder_layout, out);
    for (const macro of o.macro) {
      for (const action of macro) {
        if (['tap', 'down', 'up'].includes(action[0])) action.slice(1).forEach((c) => out.push(c));
      }
    }
    for (const t of o.tap_dance) strings(t.slice(0, 4), out);
    for (const c of o.combo) strings(c, out);
    for (const k of o.key_override) out.push(k.trigger, k.replacement);
    for (const a of o.alt_repeat_key) out.push(a.keycode, a.alt_keycode);
    out.forEach((c) => codes.add(c));
  }
  return [...codes].sort();
}

// Op discriminant: the LLA is silent; the stable codec (e8659c) uses `type`. Every op goes through this helper.
const OP_KEY = 'type';
const op = (name, fields = {}) => ({ [OP_KEY]: name, ...fields });

module.exports = {
  REPO_DIR, FIXTURE_VIL, BACKUP_VIL, KEYMAP_DIR, LAYOUT_TABLES_H, VIAL_JSON,
  KNOWN_UID, ROUNDED_UID,
  readBytes, readText, assertSameBytes, sameData, deepFreeze,
  RAW, py, fixtureObject, vilText,
  estonianFirmwareTable, expectedLevels, HID_NAME, DEAD_FACT, isDeadFact,
  ownerCodes, op,
};
