'use strict';
// Picker: Insert, Delete, Home, End, Page Up/Down, Scroll Lock and the other non-character keys are on
// the Characters tab and found by the names people type (owner: "lacks functionality for me to configure
// ins, del, home, end, scrlk, pgup, pgdown etc keys").
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { KS, memory, all, byFid, fidsWith } = require('./fake-dom.js');
const A = KS.app;
const S = A.state;

const CLUSTER_IDS = ['KC_ESCAPE', 'KC_TAB', 'KC_BSPACE', 'KC_CAPSLOCK', 'KC_ENTER', 'KC_SPACE', 'KC_APPLICATION',
  'KC_PSCREEN', 'KC_SCROLLLOCK', 'KC_PAUSE', 'KC_INSERT', 'KC_HOME', 'KC_PGUP', 'KC_DELETE', 'KC_END', 'KC_PGDOWN',
  'KC_UP', 'KC_LEFT', 'KC_DOWN', 'KC_RIGHT'];

let target = null;
beforeEach(() => {
  memory.clear();
  A.store.ui = S.defaultUi();
  A.store.baselineHash = null;
  S.boot();
  S.onRender(() => {});
  const layout = S.fields().layout[0];
  target = null;
  outer: for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      const v = layout[row][col];
      if (typeof v === 'string' && S.parse(v).k === 'basic') { target = { type: 'key', layer: 0, row, col }; break outer; }
    }
  }
  assert.ok(target, 'the built-in layout has a plain key on layer 0');
  A.store.ui.target = target;
});
const cell = () => S.fields().layout[0][target.row][target.col];
const top = (q) => A.picker.rankKeycodes(q, KS.keycodes.catalog)[0];

describe('picker: editing and navigation keys on the Characters tab', () => {
  it('shows every editing and navigation key, each a real catalog keycode', () => {
    A.store.ui.pickerTab = 'chars';
    const root = A.picker.render();
    assert.deepEqual(fidsWith(root, 'nk:').sort(), CLUSTER_IDS.map((id) => `nk:${id}`).sort());
    const listed = A.picker.NAV_CLUSTER.flatMap((g) => g.rows.flat()).map((k) => k.id);
    assert.deepEqual(listed.slice().sort(), CLUSTER_IDS.slice().sort());
    for (const id of listed) {
      const entry = KS.keycodes.byId(id);
      assert.ok(entry && entry.id === id, `${id} is a catalog id, not an alias`);
      assert.deepEqual(KS.keycodes.check(id), [], `${id} passes the keycode check`);
    }
  });

  it('labels keys with short legends, full names and the keycode', () => {
    A.store.ui.pickerTab = 'chars';
    const root = A.picker.render();
    const want = { KC_INSERT: ['Ins', 'Insert'], KC_DELETE: ['Del', 'Delete'], KC_PGUP: ['PgUp', 'Page Up'], KC_PGDOWN: ['PgDn', 'Page Down'],
      KC_SCROLLLOCK: ['ScrLk', 'Scroll Lock'], KC_PSCREEN: ['PrtSc', 'Print Screen'], KC_HOME: ['Home', 'Home'], KC_END: ['End', 'End'],
      KC_LEFT: ['\u2190', 'Left arrow'], KC_UP: ['\u2191', 'Up arrow'] };
    for (const [id, [legend, name]] of Object.entries(want)) {
      const b = byFid(root, `nk:${id}`);
      assert.equal(b.tagName, 'BUTTON');
      assert.equal(b.textContent, legend, `${id} legend`);
      assert.equal(b.getAttribute('aria-label'), `${name} (${id})`);
      assert.match(b.getAttribute('title'), new RegExp(`\\(${id}\\)`));
    }
  });

  it('assigns the keycode to the selected key', () => {
    for (const id of ['KC_INSERT', 'KC_HOME', 'KC_PGDOWN', 'KC_SCROLLLOCK', 'KC_DELETE', 'KC_LEFT']) {
      A.store.ui.pickerTab = 'chars';
      byFid(A.picker.render(), `nk:${id}`).fire('click');
      assert.equal(cell(), id);
    }
    assert.match(A.store.message.text, /sends Left arrow/);
  });

  it('keeps an existing hold action, like the character keys do', () => {
    S.writeTarget(target, 'LSFT_T(KC_A)', 'setup');
    A.store.ui.pickerTab = 'chars';
    byFid(A.picker.render(), 'nk:KC_END').fire('click');
    assert.equal(cell(), 'LSFT_T(KC_END)');
    assert.match(A.store.message.text, /kept its hold action/);
  });

  it('links to the function keys', () => {
    A.store.ui.pickerTab = 'chars';
    A.store.ui.search = '';
    byFid(A.picker.render(), 'show-function-keys').fire('click');
    assert.equal(A.store.ui.pickerTab, 'keys');
    assert.equal(A.store.ui.keyCategory, 'function');
    const root = A.picker.render();
    assert.ok(byFid(root, 'act:KC_F1') && byFid(root, 'act:KC_F24'));
  });
});

describe('picker: the Characters tab is a full-size keyboard', () => {
  const MODS = ['KC_LSHIFT', 'KC_RSHIFT', 'KC_LCTRL', 'KC_RCTRL', 'KC_LGUI', 'KC_RGUI', 'KC_LALT', 'KC_RALT'];
  const FKEYS = Array.from({ length: 12 }, (_, i) => `KC_F${i + 1}`);

  it('has F1 to F12 and the eight modifiers as real catalog keys that assign themselves', () => {
    A.store.ui.pickerTab = 'chars';
    const root = A.picker.render();
    assert.deepEqual(fidsWith(root, 'fk:'), FKEYS.map((id) => `fk:${id}`));
    assert.deepEqual(fidsWith(root, 'mk:').sort(), MODS.map((id) => `mk:${id}`).sort());
    for (const id of FKEYS.concat(MODS)) {
      assert.deepEqual(KS.keycodes.check(id), [], `${id} passes the keycode check`);
      const b = byFid(A.picker.render(), id.startsWith('KC_F') ? `fk:${id}` : `mk:${id}`);
      assert.match(b.getAttribute('aria-label'), new RegExp(`\\(${id}\\)$`));
      b.fire('click');
      assert.equal(cell(), id);
    }
    assert.match(byFid(root, 'mk:KC_RALT').textContent, /AltGr/);
  });

  it('keeps a hold action when a modifier or function key is picked', () => {
    S.writeTarget(target, 'LSFT_T(KC_A)', 'setup');
    A.store.ui.pickerTab = 'chars';
    byFid(A.picker.render(), 'fk:KC_F5').fire('click');
    assert.equal(cell(), 'LSFT_T(KC_F5)');
  });

  // Cells a key covers; the ISO Enter leaves out the first column of its lower row.
  const cells = (p, mode) => {
    const x = mode === 'narrow' ? p.xs : mode === 'medium' ? p.xm : p.x;
    const r = mode === 'narrow' ? p.rs : mode === 'medium' ? p.rm : p.r;
    const w = mode === 'narrow' ? p.ws : p.w;
    const out = [];
    for (let dr = 0; dr < p.h; dr++) for (let c = x; c < x + w; c++) if (!(p.h > 1 && dr === 1 && c === x)) out.push(`${r + dr}:${c}`);
    return out;
  };
  const GRID = { wide: { main: 60, nav: 12 }, medium: { main: 60, nav: 40 }, narrow: { main: 34, nav: 26 } };

  for (const mode of Object.keys(GRID)) {
    it(`${mode}: keys stay inside their grid and never overlap`, () => {
      const places = A.picker.keyboardPlaces();
      for (const part of ['main', 'nav']) {
        const seen = new Map();
        for (const p of places[part]) {
          for (const c of cells(p, mode)) {
            const col = Number(c.split(':')[1]);
            assert.ok(col >= 1 && col <= GRID[mode][part], `${p.id} column ${col} is inside the ${part} grid`);
            assert.ok(!seen.has(c), `${p.id} overlaps ${seen.get(c)} at ${c}`);
            seen.set(c, p.id);
          }
        }
      }
    });
  }

  it('wide: the five key rows of the main block are full, with no holes', () => {
    const covered = new Set(A.picker.keyboardPlaces().main.flatMap((p) => cells(p, 'wide')));
    for (const row of [3, 4, 5, 6, 7]) {
      const holes = [];
      for (let c = 1; c <= 60; c++) if (!covered.has(`${row}:${c}`)) holes.push(c);
      assert.deepEqual(holes, [], `grid row ${row} has no holes`);
    }
  });

  it('narrow: splits at 7, y, h and n, every half row flush with its outer edge', () => {
    const places = A.picker.keyboardPlaces().main;
    const at = (id) => places.find((p) => p.id === id);
    for (const id of ['KC_7', 'KC_Y', 'KC_H', 'KC_N', 'KC_F5']) assert.ok(at(id).rs > 8, `${id} is in the right half`);
    for (const id of ['KC_6', 'KC_T', 'KC_G', 'KC_B', 'KC_SPACE']) assert.ok(at(id).rs <= 8, `${id} is in the left half`);
    const rows = new Map();
    for (const p of places) {
      for (let r = p.rs; r < p.rs + p.h; r++) {
        const span = rows.get(r) || [Infinity, 0];
        rows.set(r, [Math.min(span[0], p.xs), Math.max(span[1], p.xs + p.ws - 1)]);
      }
    }
    for (const [r, [first, last]] of rows) {
      if (r <= 8) assert.equal(first, 1, `left half row ${r} starts at the left edge`);
      else assert.equal(last, 34, `right half row ${r} ends at the right edge`);
    }
  });
});

describe('picker search: names people type for non-character keys', () => {
  const cases = {
    scrlk: 'KC_SCROLLLOCK', scroll: 'KC_SCROLLLOCK', 'scroll lock': 'KC_SCROLLLOCK', slck: 'KC_SCROLLLOCK',
    prtsc: 'KC_PSCREEN', prtscr: 'KC_PSCREEN', print: 'KC_PSCREEN', pscr: 'KC_PSCREEN',
    pgup: 'KC_PGUP', 'page up': 'KC_PGUP', pgdn: 'KC_PGDOWN', pgdown: 'KC_PGDOWN', 'page down': 'KC_PGDOWN',
    ins: 'KC_INSERT', insert: 'KC_INSERT', del: 'KC_DELETE', delete: 'KC_DELETE', home: 'KC_HOME', end: 'KC_END',
    bksp: 'KC_BSPACE', backspace: 'KC_BSPACE', bspc: 'KC_BSPACE', esc: 'KC_ESCAPE', escape: 'KC_ESCAPE',
    caps: 'KC_CAPSLOCK', 'caps lock': 'KC_CAPSLOCK', menu: 'KC_APPLICATION', app: 'KC_APPLICATION',
    pause: 'KC_PAUSE', break: 'KC_PAUSE', left: 'KC_LEFT', right: 'KC_RIGHT', up: 'KC_UP', down: 'KC_DOWN',
    enter: 'KC_ENTER', return: 'KC_ENTER',
  };
  for (const [q, id] of Object.entries(cases)) {
    it(`'${q}' ranks ${id} first`, () => assert.equal(top(q).id, id));
  }

  it('prefixes rank these keys first', () => {
    assert.equal(top('scr').id, 'KC_SCROLLLOCK');
    assert.equal(top('prt').id, 'KC_PSCREEN');
    assert.equal(top('bks').id, 'KC_BSPACE');
    assert.deepEqual(A.picker.rankKeycodes('pg', KS.keycodes.catalog).slice(0, 2).map((e) => e.id), ['KC_PGUP', 'KC_PGDOWN']);
  });

  it("'arrow' finds all four arrow keys first", () => {
    const ids = A.picker.rankKeycodes('arrow', KS.keycodes.catalog).slice(0, 4).map((e) => e.id).sort();
    assert.deepEqual(ids, ['KC_DOWN', 'KC_LEFT', 'KC_RIGHT', 'KC_UP']);
  });

  it('search words are not accepted as Vial keycodes', () => {
    for (const word of ['KC_SCRLK', 'KC_PRTSC', 'KC_BKSP', 'KC_PGDOWN_X']) assert.equal(KS.keycodes.byId(word), null, word);
  });

  it('the rendered search assigns the top result', () => {
    A.store.ui.search = 'scrlk';
    const root = A.picker.render();
    const results = fidsWith(root, 'res:');
    assert.equal(results[0], 'res:KC_SCROLLLOCK');
    byFid(root, 'res:KC_SCROLLLOCK').fire('click');
    assert.equal(cell(), 'KC_SCROLLLOCK');
  });

  it('empty and unmatched queries give no keycodes', () => {
    assert.deepEqual(A.picker.rankKeycodes('  ', KS.keycodes.catalog), []);
    assert.deepEqual(A.picker.rankKeycodes('zzqx', KS.keycodes.catalog), []);
  });
});
