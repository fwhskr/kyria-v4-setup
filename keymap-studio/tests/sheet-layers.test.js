'use strict';
// Reference image layers: every saved image holds all layers of the file, including layers that
// do nothing, whatever the current layer or the sheet options an older studio version persisted.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const KS = require('./load-core.js');

// The app modules only need storage and window events at boot; nothing here draws.
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
};
globalThis.window = { addEventListener() {} };
for (const file of ['src/app/dom.js', 'src/app/store.js', 'src/app/sheet.js']) require(path.join(__dirname, '..', file));
const A = KS.app;
const ALL = [0, 1, 2, 3, 4, 5, 6, 7];

function boot(savedUi) {
  memory.clear();
  A.store.ui = A.state.defaultUi();
  A.store.baselineHash = null;
  if (savedUi) {
    memory.set(A.state.STORAGE_KEY, JSON.stringify(KS.workspace.fromDefault()));
    memory.set(A.state.UI_KEY, JSON.stringify({ view: 'keymap', layer: 0, level: 0, index: {}, ...savedUi }));
  }
  A.state.boot();
}

const LEGACY = {
  'this layer': { mode: 'layer', layers: [], includeEmpty: false, scale: 2, actual: false },
  'layers I choose': { mode: 'chosen', layers: [2, 4], includeEmpty: false, scale: 2, actual: false },
  'all layers without empty ones': { mode: 'all', layers: [], includeEmpty: false, scale: 2, actual: false },
};

describe('reference image layers', () => {
  it('fresh storage: all eight layers, the empty Spare layer included', () => {
    boot(null);
    assert.equal(A.state.layerName(7), 'Spare');
    assert.deepEqual(A.sheet.imageLayers(), ALL);
    assert.equal(A.sheet.fileName(), 'kyria-all-layers.png');
  });

  it('the current layer does not narrow the image', () => {
    boot(null);
    A.store.ui.layer = 5;
    assert.deepEqual(A.sheet.imageLayers(), ALL);
  });

  for (const [name, sheet] of Object.entries(LEGACY)) {
    it(`saved "${name}" option from an older version still gives every layer`, () => {
      boot({ layer: 3, sheet });
      assert.equal(A.store.ui.layer, 3, 'saved layer restored');
      assert.equal(A.store.ui.sheet.scale, 2, 'saved pixel size restored');
      assert.deepEqual(A.sheet.imageLayers(), ALL);
      A.state.persistUi();
      const saved = JSON.parse(memory.get(A.state.UI_KEY)).sheet;
      assert.deepEqual(Object.keys(saved).sort(), ['actual', 'scale'], 'old layer filters are not saved again');
    });
  }
});
