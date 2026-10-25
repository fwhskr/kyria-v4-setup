'use strict';
// Text macros (LLA §4a): firmware sends US-ASCII only and never guards bytes >= 0x80 or most controls.
// vil.checkMacroText enforces the allowlist. Imported unsafe text is kept verbatim with a warning.
// macro.set refuses new unsafe text; the only exception is the identical imported string at the same position.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const KS = require('./load-core.js');
const H = require('./helpers.js');

const board = KS.board;
const { op, vilText, deepFreeze } = H;
const { OpError } = KS.workspace;
const isMacroError = (i) => i.severity === 'error' && i.code === 'E_MACRO_TEXT';
const isOpError = (e) => e instanceof OpError;
const ch = (code) => String.fromCharCode(code);
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// TEXT allowlist from the LLA: 0x08, 0x09, 0x0A, 0x1B and 0x20-0x7E.
const ALLOWED = [0x08, 0x09, 0x0a, 0x1b, ...range(0x20, 0x7e)];
// Boundaries on both sides: NUL, SOH, BEL, VT, FF, CR, US, DEL, first high byte, last byte.
const REFUSED = [0x00, 0x01, 0x07, 0x0b, 0x0c, 0x0d, 0x1f, 0x7f, 0x80, 0xff];

describe('VERIFY-4 checkMacroText allowlist', () => {
  it('accepts the allowed controls and every printable ASCII character', () => {
    const bad = ALLOWED.filter((c) => KS.vil.checkMacroText(ch(c)).length !== 0);
    assert.deepEqual(bad, []);
  });

  it('refuses every other byte in the boundary set, one error per character', () => {
    for (const c of REFUSED) {
      const issues = KS.vil.checkMacroText(ch(c));
      assert.equal(issues.length, 1, `0x${c.toString(16)} must give one issue`);
      assert.ok(isMacroError(issues[0]), `0x${c.toString(16)} must give E_MACRO_TEXT`);
    }
  });

  it('reports each offending character separately', () => {
    const issues = KS.vil.checkMacroText('a\x01b\x7f');
    assert.equal(issues.filter(isMacroError).length, 2);
  });

  it('refuses Estonian letters and other non-ASCII text', () => {
    for (const s of ['õ', 'ñ', 'ö', 'é', '€']) {
      assert.ok(KS.vil.checkMacroText(s).some(isMacroError), s);
    }
  });

  it('accepts empty text', () => {
    assert.deepEqual(KS.vil.checkMacroText(''), []);
  });
});

describe('VERIFY-3 imported unsafe macro text is kept, warned, and exported verbatim', () => {
  const unsafeDoc = (text) => KS.vil.decode(vilText((o) => { o.macro[0] = [['text', text]]; }), board);

  it('warns W_MACRO_TEXT_UNSAFE for an imported õ without blocking export', () => {
    const text = vilText((o) => { o.macro[0] = [['text', 'õ']]; });
    assert.ok(text.includes('"\\u00f5"'), 'fixture must be Python ensure_ascii, not raw UTF-8');
    const r = unsafeDoc('õ');
    assert.equal(r.ok, true);
    assert.equal(JSON.parse(KS.vil.encode(r.doc)).macro[0][0][1], 'õ');
    const warn = r.issues.find((i) => i.code === 'W_MACRO_TEXT_UNSAFE');
    assert.ok(warn, 'W_MACRO_TEXT_UNSAFE expected');
    assert.equal(warn.severity, 'warning');
    assert.deepEqual(KS.vil.validate(r.doc, board).filter((i) => i.severity === 'error'), []);
    H.assertSameBytes(KS.vil.encode(r.doc), Buffer.from(text, 'utf8'), 'unsafe import export');
  });

  it('warns for an imported control byte too', () => {
    const r = unsafeDoc('\x01');
    assert.ok(r.issues.some((i) => i.code === 'W_MACRO_TEXT_UNSAFE'));
  });

  it('keeps unsafe text in the export after an unrelated key edit', () => {
    const ws = KS.workspace.create(unsafeDoc('õ').doc, { filename: 'unsafe.vil' });
    const out = KS.workspace.apply(deepFreeze(ws), op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_Y' }));
    const exported = KS.vil.encode(out.doc);
    assert.ok(exported.includes('"macro": [[["text", "\\u00f5"]]'));
    assert.equal(JSON.parse(exported).macro[0][0][1], 'õ');
  });
});

describe('VERIFY-4 macro.set refuses new unsafe text (E_MACRO_TEXT)', () => {
  const ws = () => KS.workspace.create(
    KS.vil.decode(vilText((o) => { o.macro[0] = [['text', 'õ']]; }), board).doc,
    { filename: 'unsafe.vil' },
  );
  const refusesMacro = (o) => assert.throws(() => KS.workspace.apply(deepFreeze(ws()), o),
    (e) => isOpError(e) && e.code === 'E_MACRO_TEXT');

  it('refuses a new text macro with ñ', () => {
    refusesMacro(op('macro.set', { index: 1, actions: [['text', 'ñ']] }));
  });

  it('refuses a new text macro with a control byte or DEL', () => {
    refusesMacro(op('macro.set', { index: 1, actions: [['text', '\x01']] }));
    refusesMacro(op('macro.set', { index: 1, actions: [['text', 'a\x7f']] }));
  });

  it('accepts ASCII text', () => {
    const out = KS.workspace.apply(deepFreeze(ws()), op('macro.set', { index: 1, actions: [['text', 'ok\t']] }));
    assert.deepEqual(out.doc.fields.macro[1], [['text', 'ok\t']]);
  });

  it('allows the identical imported string at the same position', () => {
    const before = KS.vil.encode(ws().doc);
    const out = KS.workspace.apply(deepFreeze(ws()), op('macro.set', { index: 0, actions: [['text', 'õ']] }));
    assert.equal(KS.vil.encode(out.doc), before);
  });

  it('refuses the same imported string moved to another macro position', () => {
    refusesMacro(op('macro.set', { index: 1, actions: [['text', 'õ']] }));
  });

  it('refuses a different unsafe string at the imported position', () => {
    refusesMacro(op('macro.set', { index: 0, actions: [['text', 'ö']] }));
  });
});
