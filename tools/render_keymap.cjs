'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const root = path.resolve(__dirname, '..');
const backupPath = 'backups/live-keymap.json';
const settingsPath = 'backups/live-settings.json';
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

function bytes(hex, length) {
  assert(typeof hex === 'string' && /^[0-9a-f]*$/i.test(hex) && hex.length % 2 === 0, 'Invalid hex buffer');
  const buffer = Buffer.from(hex, 'hex');
  if (length !== undefined) assert.equal(buffer.length, length, 'Unexpected buffer size');
  return buffer;
}

// Vial QMK dd43959a: quantum/{keycodes.h,quantum_keycodes.h,vial.c,nvm/eeprom/nvm_dynamic_keymap.c}.
function decode(live, settings, KS) {
  const {board, keycodeCatalog, keycodes} = KS;
  const {rows, cols, layers} = live;
  assert.deepEqual({rows, cols}, board.matrix);
  const identity = bytes(live.vial_identity, 32);
  assert.equal(identity.readUInt32LE(0), 6, 'Expected Vial protocol 6');
  assert.equal(identity.readBigUInt64LE(4).toString(), board.knownUid);
  assert.equal(settings.vial_identity, live.vial_identity);
  assert(bytes(live.macros).every(byte => byte === 0), 'Nonempty macro memory is not supported by this reference');
  const [, combos, overrides, altRepeat] = settings.dynamic;
  assert(combos.every(x => /^0{20}$/.test(x)), 'Active combos are not supported by this reference');
  assert(overrides.every(x => /^00000000ffff00000007$/i.test(x)), 'Active key overrides are not supported by this reference');
  assert(altRepeat.every(x => /^0{12}$/.test(x)), 'Active alt repeat is not supported by this reference');

  const basic = new Map(keycodeCatalog.entries.filter(x => Number.isInteger(x.hid)).map(x => [x.hid, x.id]));
  basic.set(0, 'KC_NO').set(1, 'KC_TRNS');
  const rgb = ['RM_TOGG', 'RM_NEXT', 'RM_PREV', 'RM_HUEU', 'RM_HUED', 'RM_SATU', 'RM_SATD', 'RM_VALU', 'RM_VALD'];
  const format = action => keycodes.format(action);
  const mods = n => keycodes.modsFromBits((n >> 8) & 31);
  const low = n => keycodes.parse(code(n & 255));
  function code(n) {
    if (basic.has(n)) return basic.get(n);
    if (n >= 0x0100 && n <= 0x1fff) return format({k: 'mods', mods: mods(n), inner: low(n)});
    if (n >= 0x2000 && n <= 0x3fff) return format({k: 'modtap', mods: mods(n), tap: low(n)});
    if (n >= 0x5000 && n <= 0x51ff) return format({k: 'layermod', layer: (n >> 5) & 15, mods: keycodes.modsFromBits(n & 31)});
    if ((n & 0xffe0) === 0x5220) return `MO(${n & 31})`;
    if ((n & 0xffe0) === 0x5240) return `DF(${n & 31})`;
    if (rgb[n - 0x7842]) return rgb[n - 0x7842];
    throw new Error(`Unsupported QMK keycode 0x${n.toString(16).padStart(4, '0')}`);
  }

  const matrix = bytes(live.keymap, layers * rows * cols * 2);
  const positions = new Set([...board.keys, ...board.moduleCells].map(({row, col}) => row * cols + col));
  const layout = Array.from({length: layers}, (_, l) => Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => {
    const position = r * cols + c;
    const n = matrix.readUInt16BE(2 * (l * rows * cols + position));
    if (positions.has(position)) return code(n);
    assert(n === 0 || n === 1, `Mapped matrix position ${r},${c} lacks Studio geometry`);
    return -1;
  })));
  assert.equal(settings.encoders.length, layers);
  const encoder_layout = settings.encoders.map(layer => {
    assert.equal(layer.length, board.encoders.length);
    return layer.map(pair => {
      const wire = bytes(pair, 4);
      // Vial's HID reply is CCW then CW. Studio's pairs are CW then CCW.
      return [code(wire.readUInt16BE(2)), code(wire.readUInt16BE(0))];
    });
  });
  const fields = {version: 1, uid: board.knownUid, layout, encoder_layout,
    layout_options: bytes(settings.layout_options, 4).readUInt32BE(), vial_protocol: 6};
  const doc = {fields, order: Object.keys(fields), extra: []};
  assert.deepEqual(KS.vil.validate(doc, board), []);
  return doc;
}

async function main() {
  const {chromium} = require('playwright');
  const studio = path.join(root, 'keymap-studio');
  const html = fs.readFileSync(path.join(studio, 'index.html'), 'utf8');
  for (const [, file] of html.matchAll(/<script src="(src\/(?:data|core)\/[^"\n]+)"><\/script>/g)) require(path.join(studio, file));
  const KS = globalThis.KyriaStudio;
  const live = read(backupPath);
  const doc = decode(live, read(settingsPath), KS);
  const ws = KS.workspace.create(doc, {filename: backupPath});
  const names = ['Base', 'Alt alpha', 'Alpha 123', 'Nav', 'Num/Sym', 'F-keys', 'RGB', 'Unused'];
  const labels = {
    RM_TOGG: 'RGB on/off', RM_NEXT: 'Mode +', RM_PREV: 'Mode −', RM_HUEU: 'Hue +', RM_HUED: 'Hue −',
    RM_SATU: 'Sat +', RM_SATD: 'Sat −', RM_VALU: 'Bright +', RM_VALD: 'Bright −'
  };
  // Captions describe this snapshot, not the names shown by the host helper.
  if (doc.fields.layout.length === names.length) ws.meta.layerNames = names;
  doc.fields.layout.forEach((layer, l) => layer.forEach((row, r) => row.forEach((code, c) => {
    if (labels[code]) ws.meta.keyLabels[`${l}:${r}:${c}`] = labels[code];
  })));

  const browser = await chromium.launch({timeout: 15000, executablePath: process.env.CHROMIUM_PATH});
  try {
    const page = await browser.newPage({locale: 'en-GB', timezoneId: 'UTC'});
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(studio, 'index.html')).href, {timeout: 15000});
    await page.locator('#app:not([aria-busy])').waitFor();
    const result = await page.evaluate(ws => {
      const A = globalThis.KyriaStudio.app;
      A.store.hist = globalThis.KyriaStudio.history.create(ws);
      const legendAt = A.state.legendAt;
      A.state.legendAt = (...args) => {
        const legend = legendAt(...args);
        if (legend.code === 'LCAG_T(KC_NO)') {
          legend.main = 'No tap';
          legend.hold.text = 'C+A+G';
        } else if (legend.code === 'LM(2, MOD_LGUI)') {
          legend.main = 'No tap';
          legend.hold = {kind: 'layer', text: '2+Super', layer: 2};
        }
        return legend;
      };
      const model = A.keycap.model;
      A.keycap.model = (legend, options) => model(legend, legend.fromLayer === 0 ? {...options, inheritedName: null} : options);
      const log = [];
      const {canvas} = A.sheet.render({log});
      const ctx = canvas.getContext('2d');
      const t = A.keycap.tokens();
      ctx.fillStyle = t.text;
      ctx.font = `400 16px ${t.fontUi}`;
      ctx.textAlign = 'left';
      ctx.fillText('C+A+G: hold Ctrl + Alt + Super.  2+Super: hold layer 2 + Super.  Layer 7 keys and encoders all pass through.', 40, canvas.height - 25);
      return {png: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, log};
    }, ws);
    assert.deepEqual(errors, []);
    assert.equal(result.log.filter(x => x.role === 'title').length, live.layers + 1, 'Not all layers were drawn');
    const clipped = [...new Set(result.log.filter(x => x.k && x.text.includes('…')).map(x => x.text))];
    assert.deepEqual(clipped, [], 'Truncated key legends');
    const outside = result.log.filter(x => x.box && x.box.some(v => Math.abs(v) > x.k / 2));
    assert.deepEqual(outside, [], 'Key legends outside their keycaps');
    const target = process.argv[2] || path.join(root, 'images/keymap.png');
    fs.writeFileSync(target, Buffer.from(result.png.split(',')[1], 'base64'));
    console.log(`${target}: ${result.width} × ${result.height}, ${live.layers} layers`);
  } finally {
    await browser.close();
  }
}

module.exports = {decode};
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
