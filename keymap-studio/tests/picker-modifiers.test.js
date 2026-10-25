'use strict';
// Picker: Ctrl, Shift, Alt, AltGr and Super are easy to find from the character keyboard, and picking
// them or a character still writes the same keycodes as before (owner correction, 2026-10-25).
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const KS = require('./load-core.js');

// A minimal DOM stand-in: enough for the studio's h() helper to build the picker so the test can read
// labels, checked state and data-fid hooks and fire the same click/change handlers a browser would.
class FakeNode {
  constructor(tag, text) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.ownText = text || '';
    this.style = { setProperty() {} };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  append(...nodes) { this.children.push(...nodes); }
  removeChild(node) { this.children = this.children.filter((c) => c !== node); }
  get firstChild() { return this.children[0] || null; }
  set textContent(v) { this.children = []; this.ownText = String(v); }
  get textContent() { return this.ownText + this.children.map((c) => c.textContent).join(''); }
  fire(type) { for (const fn of this.listeners[type] || []) fn({ type, target: this, key: '', preventDefault() {} }); }
}
globalThis.Node = FakeNode;
globalThis.document = { createElement: (t) => new FakeNode(t), createTextNode: (t) => new FakeNode('#text', t) };
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
};
globalThis.window = { addEventListener() {} };
for (const file of ['src/app/dom.js', 'src/app/text.js', 'src/app/store.js', 'src/app/picker.js']) require(path.join(__dirname, '..', file));
const A = KS.app;
const S = A.state;

const MODIFIERS = ['KC_LCTRL', 'KC_RCTRL', 'KC_LSHIFT', 'KC_RSHIFT', 'KC_LALT', 'KC_RALT', 'KC_LGUI', 'KC_RGUI'];

function all(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const c of node.children) all(c, pred, out);
  return out;
}
const byFid = (root, fid) => all(root, (n) => n.getAttribute('data-fid') === fid)[0] || null;
const fidsWith = (root, prefix) => all(root, (n) => (n.getAttribute('data-fid') || '').startsWith(prefix)).map((n) => n.getAttribute('data-fid'));
const selectedTab = (root) => all(root, (n) => n.getAttribute('role') === 'tab' && n.getAttribute('aria-selected') === 'true')[0];
// Category chips are radio inputs inside labels; the label text is the category name.
const chips = (root) => all(root, (n) => n.tagName === 'LABEL' && n.getAttribute('class') === 'chip')
  .map((l) => ({ name: l.textContent, checked: !!l.children[0].checked, fid: l.children[0].getAttribute('data-fid') }));

let renders = [];
let target = null;
beforeEach(() => {
  memory.clear();
  A.store.ui = S.defaultUi();
  A.store.baselineHash = null;
  S.boot();
  renders = [];
  S.onRender((focus) => renders.push(focus));
  // A board key whose code is a plain key, so a picked key replaces it as is.
  const layout = S.fields().layout[0];
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

describe('picker: finding Ctrl, Shift, Alt, AltGr and Super', () => {
  it('the character keyboard links straight to the modifier keys', () => {
    A.store.ui.pickerTab = 'chars';
    const before = A.picker.render();
    const link = byFid(before, 'show-modifiers');
    assert.ok(link, 'the Characters tab has a link to the modifier keys');
    assert.match(link.textContent, /Ctrl, Shift, Alt/);
    A.store.ui.search = 'x';
    link.fire('click');
    assert.equal(A.store.ui.pickerTab, 'keys');
    assert.equal(A.store.ui.search, '', 'search is cleared so the tab content shows');
    assert.equal(renders.at(-1), 'ptab:keys', 'focus moves to the opened tab');
    const after = A.picker.render();
    assert.equal(selectedTab(after).getAttribute('data-fid'), 'ptab:keys');
    assert.match(selectedTab(after).textContent, /Modifiers/, 'the tab name says it holds the modifiers');
    const checked = chips(after).filter((c) => c.checked);
    assert.deepEqual(checked.map((c) => c.fid), ['cat:modifiers']);
    assert.deepEqual(fidsWith(after, 'act:').sort(), MODIFIERS.map((id) => `act:${id}`).sort());
  });

  it('opening the modifier tab directly shows Modifiers first and selected', () => {
    A.store.ui.pickerTab = 'keys';
    const root = A.picker.render();
    const list = chips(root);
    assert.equal(list[0].fid, 'cat:modifiers', 'Modifiers is the first category');
    assert.ok(list[0].checked, 'Modifiers is selected when the tab opens');
    for (const id of MODIFIERS) assert.ok(byFid(root, `act:${id}`), `${id} is shown`);
    // Every other category is still offered.
    for (const c of ['cat:editing', 'cat:function', 'cat:keypad', 'cat:media', 'cat:mouse', 'cat:special']) {
      assert.ok(list.some((x) => x.fid === c), `${c} is still offered`);
    }
  });
});

describe('picker: assignments stay as they were', () => {
  it('a modifier is assigned as itself at any level and leaves the level alone', () => {
    for (const level of [0, 1, 2, 3]) {
      for (const id of ['KC_LCTRL', 'KC_RALT', 'KC_LGUI']) {
        A.store.ui.level = level;
        A.store.ui.pickerTab = 'keys';
        A.store.ui.keyCategory = 'modifiers';
        byFid(A.picker.render(), `act:${id}`).fire('click');
        assert.equal(cell(), id, `level ${level}: ${id}`);
        assert.equal(A.store.ui.level, level, 'the character level is unchanged');
      }
    }
  });

  it('the character keyboard still assigns each Estonian level', () => {
    const want = (ch, level) => KS.keycodes.forCharacter(ch).direct.find((o) => o.level === level && o.hid === 0x1f && !o.keypad).code;
    const cases = [[0, '2', 'plain'], [1, '"', 'shift'], [2, '@', 'altgr'], [3, '\u215b', 'shiftAltgr']];
    for (const [level, ch, name] of cases) {
      A.store.ui.level = level;
      A.store.ui.pickerTab = 'chars';
      byFid(A.picker.render(), 'pk:KC_2').fire('click');
      assert.equal(cell(), want(ch, name), `${name} on the 2 key types ${ch}`);
      assert.match(A.store.message.text, new RegExp(`types ${ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
  });
});
