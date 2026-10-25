'use strict';
// Loads every data and core file in the order index.html uses and returns the shared namespace.
const path = require('node:path');

const FILES = [
  'src/data/board-kyria.js',
  'src/data/default-vil.js',
  'src/data/qmk-settings.js',
  'src/data/estonian.js',
  'src/data/keycode-catalog.js',
  'src/core/json.js',
  'src/core/keycodes.js',
  'src/core/vil.js',
  'src/core/legend.js',
  'src/core/workspace.js',
  'src/core/history.js',
];

for (const file of FILES) require(path.join(__dirname, '..', file));

module.exports = globalThis.KyriaStudio;
