'use strict';
// A minimal DOM stand-in: enough for the studio's h() helper to build the picker so a test can read
// labels, checked state and data-fid hooks and fire the same click/change handlers a browser would.
// Requiring it installs the globals and loads the picker on top of the core modules.
const path = require('node:path');
const KS = require('./load-core.js');

class FakeNode {
  constructor(tag, text) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.ownText = text || '';
    this.props = {};
    this.style = { setProperty: (k, v) => { this.props[k] = String(v); } };
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

function all(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const c of node.children) all(c, pred, out);
  return out;
}
const byFid = (root, fid) => all(root, (n) => n.getAttribute('data-fid') === fid)[0] || null;
const fidsWith = (root, prefix) => all(root, (n) => (n.getAttribute('data-fid') || '').startsWith(prefix)).map((n) => n.getAttribute('data-fid'));

module.exports = { KS, FakeNode, memory, all, byFid, fidsWith };
