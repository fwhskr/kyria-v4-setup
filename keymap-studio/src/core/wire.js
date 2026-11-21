// SPDX-License-Identifier: GPL-2.0-or-later
// Numeric names from vial-gui keycodes_v6.py, revision aef8222a.
(function (KS) {
  'use strict';
  const named = {
  "KC_A": 4,
  "KC_B": 5,
  "KC_C": 6,
  "KC_D": 7,
  "KC_E": 8,
  "KC_F": 9,
  "KC_G": 10,
  "KC_H": 11,
  "KC_I": 12,
  "KC_J": 13,
  "KC_K": 14,
  "KC_L": 15,
  "KC_M": 16,
  "KC_N": 17,
  "KC_O": 18,
  "KC_P": 19,
  "KC_Q": 20,
  "KC_R": 21,
  "KC_S": 22,
  "KC_T": 23,
  "KC_U": 24,
  "KC_V": 25,
  "KC_W": 26,
  "KC_X": 27,
  "KC_Y": 28,
  "KC_Z": 29,
  "KC_1": 30,
  "KC_2": 31,
  "KC_3": 32,
  "KC_4": 33,
  "KC_5": 34,
  "KC_6": 35,
  "KC_7": 36,
  "KC_8": 37,
  "KC_9": 38,
  "KC_0": 39,
  "KC_MINUS": 45,
  "KC_EQUAL": 46,
  "KC_LBRACKET": 47,
  "KC_RBRACKET": 48,
  "KC_BSLASH": 49,
  "KC_NONUS_HASH": 50,
  "KC_SCOLON": 51,
  "KC_QUOTE": 52,
  "KC_GRAVE": 53,
  "KC_COMMA": 54,
  "KC_DOT": 55,
  "KC_SLASH": 56,
  "KC_NONUS_BSLASH": 100,
  "KC_TILD": 565,
  "KC_EXLM": 542,
  "KC_AT": 543,
  "KC_HASH": 544,
  "KC_DLR": 545,
  "KC_PERC": 546,
  "KC_CIRC": 547,
  "KC_AMPR": 548,
  "KC_ASTR": 549,
  "KC_LPRN": 550,
  "KC_RPRN": 551,
  "KC_UNDS": 557,
  "KC_PLUS": 558,
  "KC_LCBR": 559,
  "KC_RCBR": 560,
  "KC_LT": 566,
  "KC_GT": 567,
  "KC_COLN": 563,
  "KC_PIPE": 561,
  "KC_QUES": 568,
  "KC_DQUO": 564,
  "KC_NUMLOCK": 83,
  "KC_KP_SLASH": 84,
  "KC_KP_ASTERISK": 85,
  "KC_KP_MINUS": 86,
  "KC_KP_PLUS": 87,
  "KC_KP_ENTER": 88,
  "KC_KP_1": 89,
  "KC_KP_2": 90,
  "KC_KP_3": 91,
  "KC_KP_4": 92,
  "KC_KP_5": 93,
  "KC_KP_6": 94,
  "KC_KP_7": 95,
  "KC_KP_8": 96,
  "KC_KP_9": 97,
  "KC_KP_0": 98,
  "KC_KP_DOT": 99,
  "KC_KP_EQUAL": 103,
  "KC_KP_COMMA": 133,
  "KC_ENTER": 40,
  "KC_ESCAPE": 41,
  "KC_BSPACE": 42,
  "KC_TAB": 43,
  "KC_SPACE": 44,
  "KC_CAPSLOCK": 57,
  "KC_APPLICATION": 101,
  "KC_PSCREEN": 70,
  "KC_SCROLLLOCK": 71,
  "KC_PAUSE": 72,
  "KC_INSERT": 73,
  "KC_HOME": 74,
  "KC_PGUP": 75,
  "KC_DELETE": 76,
  "KC_END": 77,
  "KC_PGDOWN": 78,
  "KC_RIGHT": 79,
  "KC_LEFT": 80,
  "KC_DOWN": 81,
  "KC_UP": 82,
  "KC_F1": 58,
  "KC_F2": 59,
  "KC_F3": 60,
  "KC_F4": 61,
  "KC_F5": 62,
  "KC_F6": 63,
  "KC_F7": 64,
  "KC_F8": 65,
  "KC_F9": 66,
  "KC_F10": 67,
  "KC_F11": 68,
  "KC_F12": 69,
  "KC_F13": 104,
  "KC_F14": 105,
  "KC_F15": 106,
  "KC_F16": 107,
  "KC_F17": 108,
  "KC_F18": 109,
  "KC_F19": 110,
  "KC_F20": 111,
  "KC_F21": 112,
  "KC_F22": 113,
  "KC_F23": 114,
  "KC_F24": 115,
  "KC_LCTRL": 224,
  "KC_LSHIFT": 225,
  "KC_LALT": 226,
  "KC_LGUI": 227,
  "KC_RCTRL": 228,
  "KC_RSHIFT": 229,
  "KC_RALT": 230,
  "KC_RGUI": 231,
  "KC_PWR": 165,
  "KC_SLEP": 166,
  "KC_WAKE": 167,
  "KC_EXEC": 116,
  "KC_HELP": 117,
  "KC_SLCT": 119,
  "KC_STOP": 120,
  "KC_AGIN": 121,
  "KC_UNDO": 122,
  "KC_CUT": 123,
  "KC_COPY": 124,
  "KC_PSTE": 125,
  "KC_FIND": 126,
  "KC_CALC": 178,
  "KC_MAIL": 177,
  "KC_MSEL": 175,
  "KC_MYCM": 179,
  "KC_WSCH": 180,
  "KC_WHOM": 181,
  "KC_WBAK": 182,
  "KC_WFWD": 183,
  "KC_WSTP": 184,
  "KC_WREF": 185,
  "KC_WFAV": 186,
  "KC_BRIU": 189,
  "KC_BRID": 190,
  "KC_MPRV": 172,
  "KC_MNXT": 171,
  "KC_MUTE": 168,
  "KC_VOLD": 170,
  "KC_VOLU": 169,
  "KC__VOLDOWN": 129,
  "KC__VOLUP": 128,
  "KC_MSTP": 173,
  "KC_MPLY": 174,
  "KC_MRWD": 188,
  "KC_MFFD": 187,
  "KC_EJCT": 176,
  "KC_LCAP": 130,
  "KC_LNUM": 131,
  "KC_LSCR": 132,
  "KC_MS_U": 205,
  "KC_MS_D": 206,
  "KC_MS_L": 207,
  "KC_MS_R": 208,
  "KC_BTN1": 209,
  "KC_BTN2": 210,
  "KC_BTN3": 211,
  "KC_BTN4": 212,
  "KC_BTN5": 213,
  "KC_WH_U": 217,
  "KC_WH_D": 218,
  "KC_WH_L": 219,
  "KC_WH_R": 220,
  "KC_ACL0": 221,
  "KC_ACL1": 222,
  "KC_ACL2": 223,
  "BL_ON": 30720,
  "BL_OFF": 30721,
  "BL_TOGG": 30722,
  "BL_DEC": 30723,
  "BL_INC": 30724,
  "BL_STEP": 30725,
  "BL_BRTG": 30726,
  "RM_ON": 30784,
  "RM_OFF": 30785,
  "RM_TOGG": 30786,
  "RM_NEXT": 30787,
  "RM_PREV": 30788,
  "RM_HUEU": 30789,
  "RM_HUED": 30790,
  "RM_SATU": 30791,
  "RM_SATD": 30792,
  "RM_VALU": 30793,
  "RM_VALD": 30794,
  "RM_SPDU": 30795,
  "RM_SPDD": 30796,
  "RGB_TOG": 30752,
  "RGB_MOD": 30753,
  "RGB_RMOD": 30754,
  "RGB_HUI": 30755,
  "RGB_HUD": 30756,
  "RGB_SAI": 30757,
  "RGB_SAD": 30758,
  "RGB_VAI": 30759,
  "RGB_VAD": 30760,
  "RGB_SPI": 30761,
  "RGB_SPD": 30762,
  "RGB_M_P": 30763,
  "RGB_M_B": 30764,
  "RGB_M_R": 30765,
  "RGB_M_SW": 30766,
  "RGB_M_SN": 30767,
  "RGB_M_K": 30768,
  "RGB_M_X": 30769,
  "RGB_M_G": 30770,
  "RGB_M_T": 30771,
  "KC_NO": 0,
  "KC_TRNS": 1,
  "KC_GESC": 31766,
  "KC_LSPO": 31770,
  "KC_RSPC": 31771,
  "KC_LCPO": 31768,
  "KC_RCPC": 31769,
  "KC_LAPO": 31772,
  "KC_RAPC": 31773,
  "KC_SFTENT": 31774,
  "QK_BOOT": 31744,
  "QK_REBOOT": 31745,
  "QK_CLEAR_EEPROM": 31747,
  "QK_CAPS_WORD_TOGGLE": 31859,
  "FN_MO13": 31863,
  "FN_MO23": 31864,
  "QK_REPEAT_KEY": 31865,
  "QK_ALT_REPEAT_KEY": 31866,
  "QK_LAYER_LOCK": 31867
};
  const layers = {TO: 0x5200, MO: 0x5220, DF: 0x5240, TG: 0x5260, OSL: 0x5280, TT: 0x52c0, PDF: 0x52e0};
  const reverse = new Map([[0, 'KC_NO'], [1, 'KC_TRNS']]);
  for (const [name, value] of Object.entries(named)) {
    if (value < 0x100 || value >= 0x2000) reverse.set(value, name);
  }
  for (let i = 0; i < 64; i++) reverse.set(0x7e00 + i, 'USER' + String(i).padStart(2, '0'));
  function unsupported(code) {
    const error = new Error('Unsupported wire keycode: ' + code);
    error.code = 'E_WIRE_UNSUPPORTED';
    throw error;
  }
  function encode(code) {
    const action = KS.keycodes.parse(code);
    const bits = a => KS.keycodes.modsBits(a.mods);
    const byte = a => {
      const n = encode(KS.keycodes.format(a));
      if (n > 255) unsupported(code);
      return n;
    };
    switch (action.k) {
      case 'none': return 0;
      case 'trans': return 1;
      case 'basic':
      case 'named':
        if (Object.hasOwn(named, action.id)) return named[action.id];
        if (/^USER[0-9]{2}$/.test(action.id) && +action.id.slice(4) < 64) return 0x7e00 + +action.id.slice(4);
        return unsupported(code);
      case 'mods': return (bits(action) << 8) | byte(action.inner);
      case 'modtap': return 0x2000 | (bits(action) << 8) | byte(action.tap);
      case 'layertap':
        if (action.layer >= 0 && action.layer < 16) return 0x4000 | (action.layer << 8) | byte(action.tap);
        break;
      case 'layermod':
        if (action.layer >= 0 && action.layer < 16 && (bits(action) & 15)) return 0x5000 | (action.layer << 5) | bits(action);
        break;
      case 'layer':
        if (action.layer >= 0 && action.layer < 32) return layers[action.fn] | action.layer;
        break;
      case 'osm': if (bits(action) & 15) return 0x52a0 | bits(action); break;
      case 'macro': if (action.index < 256) return 0x7700 | action.index; break;
      case 'tapdance': if (action.index < 256) return 0x5700 | action.index; break;
    }
    return unsupported(code);
  }
  function decode(n) {
    const unknown = () => '0x' + n.toString(16).toUpperCase().padStart(4, '0');
    if (!Number.isInteger(n) || n < 0 || n > 65535) return unknown();
    if (reverse.has(n)) return reverse.get(n);
    const format = a => {
      try {
        const name = KS.keycodes.format(a);
        if (encode(name) === n) return name;
        const bits = KS.keycodes.modsBits(a.mods);
        if (a.k === 'modtap') return `MT(${bits}, ${KS.keycodes.format(a.tap)})`;
        if (a.k === 'layermod') return `LM(${a.layer}, ${bits})`;
        if (a.k === 'osm') return `OSM(${bits})`;
        return unknown();
      } catch (_) { return unknown(); }
    };
    const mods = b => KS.keycodes.modsFromBits(b);
    const low = () => KS.keycodes.parse(decode(n & 255));
    if (n >= 0x100 && n < 0x2000) return format({k:'mods', mods:mods(n >> 8), inner:low()});
    if (n >= 0x2000 && n < 0x4000) return format({k:'modtap', mods:mods((n >> 8) & 31), tap:low()});
    if (n >= 0x4000 && n < 0x5000) return format({k:'layertap', layer:(n >> 8) & 15, tap:low()});
    if (n >= 0x5000 && n < 0x5200) return format({k:'layermod', layer:(n >> 5) & 15, mods:mods(n & 31)});
    for (const [fn, base] of Object.entries(layers)) if ((n & 0xffe0) === base) return fn + '(' + (n & 31) + ')';
    if ((n & 0xffe0) === 0x52a0) return format({k:'osm', mods:mods(n & 31)});
    if ((n & 0xff00) === 0x5700) return 'TD(' + (n & 255) + ')';
    if ((n & 0xff00) === 0x7700) return 'M' + (n & 255);
    return unknown();
  }
  const hex = bytes => Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
  const unhex = s => {
    if (typeof s !== 'string' || !/^(?:[0-9a-f]{2})*$/i.test(s)) throw Error('Invalid hexadecimal buffer');
    return s.match(/../g)?.map(x => parseInt(x, 16)) || [];
  };
  function uint(n, width) {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 2 ** (width * 8)) throw Error('Value out of range');
    return Array.from({length: width}, (_, i) => Math.floor(n / 2 ** (8 * i)) & 255);
  }
  const le = n => uint(n, 2);
  const be = n => le(n).reverse();
  const cell = v => Number.isInteger(v) && v >= 0 && v <= 65535 ? v : encode(v);
  const sectionNames = ['tap_dance', 'combo', 'key_override', 'alt_repeat_key'];
  function dynamicEntry(kind, entry) {
    if (kind < 2) {
      if (!Array.isArray(entry) || entry.length !== 5) throw Error('Invalid dynamic entry');
      return hex(entry.flatMap((v, i) => le(kind === 0 && i === 4 ? v : cell(v))));
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('Invalid dynamic entry');
    const fields = kind === 2 ? ['trigger', 'replacement', 'layers', 'trigger_mods', 'negative_mod_mask', 'suppressed_mods', 'options'] : ['keycode', 'alt_keycode', 'allowed_mods', 'options'];
    return hex(fields.flatMap((field, i) => uint(i < 2 ? cell(entry[field]) : entry[field], i < (kind === 2 ? 3 : 2) ? 2 : 1)));
  }
  function emptyExtra(kind, entry) {
    if (kind < 2) return Array.isArray(entry) && entry.length === 5 && entry.slice(0, kind === 0 ? 4 : 5).every(x => cell(x) === 0);
    if (!entry || typeof entry !== 'object') return false;
    return kind === 2 ? cell(entry.trigger) === 0 && cell(entry.replacement) === 0 : cell(entry.keycode) === 0 && cell(entry.alt_keycode) === 0;
  }
  function macroBytes(macros) {
    const out = [];
    if (!Array.isArray(macros)) throw Error('Invalid macro list');
    for (const actions of macros) {
      if (!Array.isArray(actions)) throw Error('Invalid macro');
      for (const action of actions) {
        if (!Array.isArray(action)) throw Error('Invalid macro action');
        const [kind, value] = action;
        if (kind === 'text' && action.length === 2 && typeof value === 'string') {
          const bytes = Array.from(new TextEncoder().encode(value));
          if (bytes.some(x => x === 0 || x === 1)) throw Error('Macro text contains a reserved byte');
          out.push(...bytes);
        } else if (kind === 'delay' && action.length === 2 && Number.isInteger(value) && value >= 0 && value <= 65024) {
          out.push(1, 4, value % 255 + 1, Math.floor(value / 255) + 1);
        } else if (['tap', 'down', 'up'].includes(kind) && action.length > 1) {
          const op = {tap:1, down:2, up:3}[kind];
          for (const v of action.slice(1)) {
            let n = cell(v);
            if (n < 256) {
              if (n === 0) throw Error('Macro keycode contains a terminator');
              out.push(1, op, n);
            } else {
              if ((n & 255) === 0) n = 0xff00 | (n >> 8);
              out.push(1, op + 4, n & 255, n >> 8);
            }
          }
        } else throw Error('Invalid macro action');
      }
      out.push(0);
    }
    return out;
  }
  function build(doc, current) {
    const f = doc && doc.fields || {}, unsupportedItems = [], names = {};
    const result = {keymap: current.keymap, macros:null, dynamic:null, encoders:null, layoutOptions:null, settings:null, unsupported:unsupportedItems};
    const attempt = (path, fn) => {
      try { return fn(); } catch (error) { unsupportedItems.push({path, code:error.code || 'E_WIRE_UNSUPPORTED', message:error.message}); return null; }
    };
    const matrix = attempt('layout', () => {
      const bytes = unhex(current.keymap);
      if (bytes.length !== current.layers * current.rows * current.cols * 2 || !Array.isArray(f.layout) || f.layout.length !== current.layers) throw Error('Keymap dimensions differ');
      f.layout.forEach((layer, l) => {
        if (!Array.isArray(layer) || layer.length !== current.rows) throw Error('Keymap row count differs');
        layer.forEach((row, r) => {
          if (!Array.isArray(row) || row.length !== current.cols) throw Error('Keymap column count differs');
          row.forEach((v, c) => {
            if (v === -1 || v === '-1') return;
            const path = `layout[${l}][${r}][${c}]`;
            attempt(path, () => { const n = cell(v), offset = ((l * current.rows + r) * current.cols + c) * 2; bytes.splice(offset, 2, ...be(n)); names[offset / 2] = typeof v === 'string' ? v : decode(n); });
          });
        });
      });
      return hex(bytes);
    });
    if (matrix !== null) result.keymap = matrix;
    if (Object.hasOwn(f, 'macro')) result.macros = attempt('macro', () => {
      const bytes = macroBytes(f.macro);
      if (!Number.isSafeInteger(current.macroSize) || current.macroSize < 0 || bytes.length > current.macroSize) throw Error('Macros exceed keyboard buffer');
      // Bytes after the file's last macro terminator belong to no macro. Keep the keyboard's own tail so
      // leftovers there never force a write (and a B + J unlock); QMK ignores the whole buffer when its last
      // byte is non-zero, so only a tail ending in 0 is kept.
      const tail = typeof current.macros === 'string' && current.macros.length === current.macroSize * 2 ? current.macros.slice(bytes.length * 2).toLowerCase() : '';
      if (tail.length && /^[0-9a-f]*$/.test(tail) && tail.endsWith('00')) return hex(bytes) + tail;
      return hex(bytes) + '00'.repeat(current.macroSize - bytes.length);
    });
    if (sectionNames.some(k => Object.hasOwn(f, k))) result.dynamic = attempt('dynamic', () => {
      if (!Array.isArray(current.dynamic) || !Array.isArray(current.dynamicCounts) || current.dynamic.length !== 4 || current.dynamicCounts.length !== 4) throw Error('Invalid dynamic state');
      return current.dynamic.map((entries, kind) => {
        if (!Array.isArray(entries) || entries.length !== current.dynamicCounts[kind]) throw Error('Dynamic counts differ');
        const key = sectionNames[kind];
        if (!Object.hasOwn(f, key)) return entries.slice();
        if (!Array.isArray(f[key])) throw Error('Invalid ' + key);
        const out = entries.slice();
        f[key].forEach((entry, i) => attempt(`${key}[${i}]`, () => {
          if (i >= out.length) { if (!emptyExtra(kind, entry)) throw Error('Entry exceeds keyboard capacity'); return; }
          out[i] = dynamicEntry(kind, entry);
        }));
        return out;
      });
    });
    if (Object.hasOwn(f, 'encoder_layout')) result.encoders = attempt('encoder_layout', () => {
      if (!Array.isArray(f.encoder_layout) || !Array.isArray(current.encoders) || f.encoder_layout.length !== current.layers || current.encoders.length !== current.layers) throw Error('Encoder layer counts differ');
      return current.encoders.map((layer, l) => {
        if (!Array.isArray(f.encoder_layout[l]) || layer.length !== f.encoder_layout[l].length) throw Error('Encoder counts differ');
        return layer.map((old, i) => attempt(`encoder_layout[${l}][${i}]`, () => {
          const pair = f.encoder_layout[l][i];
          if (!Array.isArray(pair) || pair.length !== 2) throw Error('Invalid encoder pair');
          const previous = unhex(old);
          if (previous.length !== 4) throw Error('Invalid current encoder');
          return hex(pair.flatMap((v, direction) => v === -1 ? previous.slice(direction * 2, direction * 2 + 2) : be(cell(v))));
        }) ?? old);
      });
    });
    if (Object.hasOwn(f, 'layout_options')) result.layoutOptions = attempt('layout_options', () => hex(uint(f.layout_options, 4).reverse()));
    if (Object.hasOwn(f, 'settings')) result.settings = attempt('settings', () => {
      if (!Array.isArray(f.settings)) throw Error('Invalid settings');
      const widths = {};
      for (const tab of KS.QMK_SETTINGS.tabs) for (const field of tab.fields) widths[field.qsid] = field.width || 1;
      const out = {};
      for (const [id, value] of f.settings) attempt(`settings[${id}]`, () => {
        if (!widths[id]) throw Error('Unknown setting width');
        if (!Object.hasOwn(current.settings || {}, id)) throw Error('Setting is unavailable on keyboard');
        out[id] = hex(uint(value, widths[id]));
      });
      return out;
    });
    Object.defineProperty(result, '_names', {value:names});
    return result;
  }
  function diff(current, target) {
    const changes = [], before = unhex(current.keymap), after = unhex(target.keymap);
    if (before.length !== after.length) throw Error('Keymap lengths differ');
    for (let i = 0; i < before.length; i += 2) {
      const a = before[i] * 256 + before[i + 1], b = after[i] * 256 + after[i + 1], index = i / 2;
      if (a !== b) changes.push({kind:'key', layer:Math.floor(index / (current.rows * current.cols)), row:Math.floor(index / current.cols) % current.rows, col:index % current.cols, from:decode(a), to:target._names?.[index] || decode(b)});
    }
    if (target.macros != null && target.macros.toLowerCase() !== current.macros.toLowerCase()) {
      const a = macroDisplay(current.macros), b = macroDisplay(target.macros);
      for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || '') !== (b[i] || '')) changes.push({kind:'macro', index:i, from:a[i] || '', to:b[i] || ''});
    }
    if (target.dynamic != null) target.dynamic.forEach((entries, k) => entries.forEach((entry, index) => {
      const old = current.dynamic[k][index];
      if (entry.toLowerCase() !== old.toLowerCase()) changes.push({kind:sectionNames[k], index, from:dynamicDisplay(k, old), to:dynamicDisplay(k, entry)});
    }));
    if (target.encoders != null) target.encoders.forEach((layer, l) => layer.forEach((entry, index) => {
      const old = current.encoders[l][index];
      if (entry.toLowerCase() !== old.toLowerCase()) changes.push({kind:'encoder', layer:l, index, from:encoderDisplay(old), to:encoderDisplay(entry)});
    }));
    if (target.layoutOptions != null && target.layoutOptions.toLowerCase() !== current.layoutOptions.toLowerCase()) changes.push({kind:'layout_options', from:current.layoutOptions, to:target.layoutOptions});
    if (target.settings != null) for (const [qsid, value] of Object.entries(target.settings)) {
      const old = current.settings[qsid];
      if (old.slice(0, value.length).toLowerCase() !== value.toLowerCase()) changes.push({kind:'setting', qsid, from:old.slice(0, value.length), to:value});
    }
    return changes;
  }
  function encoderDisplay(s) { const b = unhex(s); return [decode(b[0] * 256 + b[1]), decode(b[2] * 256 + b[3])].join(', '); }
  function macroDisplay(s) {
    const bytes = unhex(s), result = [], parts = []; let text = [], i = 0;
    const flush = () => { if (text.length) { parts.push(JSON.stringify(new TextDecoder().decode(new Uint8Array(text)))); text = []; } };
    while (i < bytes.length) {
      const b = bytes[i++];
      if (b === 0) { flush(); result.push(parts.join(' ')); parts.length = 0; continue; }
      if (b !== 1 || i >= bytes.length) { text.push(b); continue; }
      flush();
      const op = bytes[i++];
      if (op === 4 && i + 1 < bytes.length) { const ms = (bytes[i] - 1) + 255 * (bytes[i + 1] - 1); i += 2; parts.push(`delay ${ms}ms`); }
      else if (op >= 1 && op <= 7 && op !== 4 && i < bytes.length) {
        let n = bytes[i++];
        if (op >= 5 && i < bytes.length) { const hi = bytes[i++]; n = hi === 255 ? n << 8 : n | hi << 8; }
        parts.push(['', 'tap', 'down', 'up', '', 'tap', 'down', 'up'][op] + ' ' + decode(n));
      } else parts.push('invalid macro');
    }
    if (parts.length || text.length) { flush(); result.push(parts.join(' ')); }
    return result;
  }
  function dynamicDisplay(kind, s) {
    const b = unhex(s), count = kind === 0 ? 4 : kind === 1 ? 5 : 2;
    const keys = Array.from({length:count}, (_, i) => decode(b[2 * i] + b[2 * i + 1] * 256));
    return keys.join(', ') + (count * 2 < b.length ? ' (' + hex(b.slice(count * 2)) + ')' : '');
  }
  KS.wire = {encode, decode, build, diff};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
