'use strict';
// VERIFY-1 (QA-1, QA-2): owner .vil files survive import and export byte-for-byte; uid stays exact.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const KS = require('./load-core.js');
const H = require('./helpers.js');

const board = KS.board;
const fixtureBytes = H.readBytes(H.FIXTURE_VIL);

describe('VERIFY-1 owner files round-trip byte-identically', () => {
  it('uses the built-in default layout byte-identical to the owner fixture', () => {
    H.assertSameBytes(KS.DEFAULT_VIL_TEXT, fixtureBytes, 'DEFAULT_VIL_TEXT');
  });

  it('decodes the fixture with no error issues and the exact uid', () => {
    const r = KS.vil.decode(H.readText(H.FIXTURE_VIL), board);
    assert.equal(r.ok, true);
    assert.deepEqual(r.issues.filter((i) => i.severity === 'error'), []);
    assert.equal(r.doc.fields.uid, H.KNOWN_UID);
  });

  it('re-encodes the fixture exactly (unedited import then export)', () => {
    const r = KS.vil.decode(H.readText(H.FIXTURE_VIL), board);
    H.assertSameBytes(KS.vil.encode(r.doc), fixtureBytes, 'fixture export');
  });

  it('re-encodes backups/kyriav4current.vil exactly', () => {
    const bytes = H.readBytes(H.BACKUP_VIL);
    const r = KS.vil.decode(bytes.toString('utf8'), board);
    assert.equal(r.ok, true);
    H.assertSameBytes(KS.vil.encode(r.doc), bytes, 'backup export');
  });

  // The other two Vial-saved owner files live outside the repository, so they are opt-in and never committed as paths.
  const extra = (process.env.STUDIO_OWNER_VIL || '').split(path.delimiter).filter(Boolean);
  if (extra.length === 0) {
    it('re-encodes the other owner exports byte-identically', {
      skip: 'set STUDIO_OWNER_VIL to the other Vial-saved owner .vil paths, separated by the path delimiter',
    }, () => {});
  }
  for (const file of extra) {
    it(`re-encodes ${path.basename(file)} exactly`, () => {
      const bytes = H.readBytes(file);
      const r = KS.vil.decode(bytes.toString('utf8'), board);
      assert.equal(r.ok, true);
      H.assertSameBytes(KS.vil.encode(r.doc), bytes, file);
    });
  }
});

describe('VERIFY-1 one edit changes only that value', () => {
  it('rewrites exactly the edited cell in the exported bytes', () => {
    const before = H.readText(H.FIXTURE_VIL);
    const search = '[-1, "KC_B", "KC_P"';
    assert.equal(before.split(search).length, 2, 'fixture must contain the target cell exactly once');
    const ws = KS.workspace.fromDefault();
    const out = KS.workspace.apply(ws, H.op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_Y' }));
    assert.equal(KS.vil.encode(out.doc), before.replace(search, '[-1, "KC_Y", "KC_P"'));
  });

  it('leaves the default workspace unchanged after the edit', () => {
    const ws = KS.workspace.fromDefault();
    KS.workspace.apply(ws, H.op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_Y' }));
    H.assertSameBytes(KS.vil.encode(ws.doc), fixtureBytes, 'input after apply');
  });
});

describe('VERIFY-1 uid survives storage and history (QA-2)', () => {
  it('keeps the uid string through storage JSON', () => {
    const stored = JSON.stringify(KS.workspace.fromDefault());
    const r = KS.workspace.restore(stored);
    assert.equal(r.ok, true);
    assert.equal(r.ws.doc.fields.uid, H.KNOWN_UID);
    H.assertSameBytes(KS.vil.encode(r.ws.doc), fixtureBytes, 'restored export');
  });

  it('keeps the uid string through commit, undo and redo', () => {
    let h = KS.history.create(KS.workspace.fromDefault());
    h = KS.history.commit(h, H.op('key.set', { layer: 0, row: 0, col: 1, code: 'KC_Y' }));
    h = KS.history.undo(h);
    h = KS.history.redo(h);
    h = KS.history.undo(h);
    assert.equal(h.present.doc.fields.uid, H.KNOWN_UID);
    H.assertSameBytes(KS.vil.encode(h.present.doc), fixtureBytes, 'after undo');
  });
});
