/*
 * API-LEG: what a key map cell actually types on an Estonian host.
 *
 * `main` is the character (or action name) the host produces, not the Vial code and not the
 * US key label. The Estonian table in data/estonian.js is the only source of typing output:
 * a US layout code such as KC_5 is only the physical key, so Shift on it is `%` here, not `^`.
 *
 * Text macros send US-ASCII through the firmware's US send_string tables (architecture §4a),
 * so the macro text is replayed as those US keys and then read through the Estonian table.
 * A dead accent combines with the next output; if a precomposed character exists (NFC) it is
 * shown, otherwise the accent and the character appear and the legend is marked approximate.
 *
 * Local copies of tables are avoided where possible: KS.keycodes and KS.estonian are read
 * inside functions, never at load time, so script order between data and core files is free.
 */
(function (KS) {
  'use strict';

  // Dead-key display accent -> the combining mark it adds. Matches the dead levels in
  // estonian.js (and the Compose file the host uses, e.g. <dead_tilde> <n> : "ñ").
  var ACCENT_MARK = {
    '´': '\u0301', '`': '\u0300', '¨': '\u0308', '˚': '\u030a', '¯': '\u0304',
    '˘': '\u0306', '˝': '\u030b', '^': '\u0302', 'ˇ': '\u030c', '~': '\u0303',
    '¸': '\u0327', '˙': '\u0307'
  };
  // Dead horn (HID 0x0d AltGr) has no printable accent; dotted circle + combining horn.
  var HORN = '\u25cc\u031b';
  var HORN_MARK = '\u031b';

  // US send_string tables: HID usage -> [plain, shift] for the keys whose ASCII it sends.
  // Space (0x2c) and the control characters are handled explicitly, never through this table.
  var US_ROWS = [
    [0x04, 'a', 'A'], [0x05, 'b', 'B'], [0x06, 'c', 'C'], [0x07, 'd', 'D'],
    [0x08, 'e', 'E'], [0x09, 'f', 'F'], [0x0a, 'g', 'G'], [0x0b, 'h', 'H'],
    [0x0c, 'i', 'I'], [0x0d, 'j', 'J'], [0x0e, 'k', 'K'], [0x0f, 'l', 'L'],
    [0x10, 'm', 'M'], [0x11, 'n', 'N'], [0x12, 'o', 'O'], [0x13, 'p', 'P'],
    [0x14, 'q', 'Q'], [0x15, 'r', 'R'], [0x16, 's', 'S'], [0x17, 't', 'T'],
    [0x18, 'u', 'U'], [0x19, 'v', 'V'], [0x1a, 'w', 'W'], [0x1b, 'x', 'X'],
    [0x1c, 'y', 'Y'], [0x1d, 'z', 'Z'],
    [0x1e, '1', '!'], [0x1f, '2', '@'], [0x20, '3', '#'], [0x21, '4', '$'],
    [0x22, '5', '%'], [0x23, '6', '^'], [0x24, '7', '&'], [0x25, '8', '*'],
    [0x26, '9', '('], [0x27, '0', ')'],
    [0x2d, '-', '_'], [0x2e, '=', '+'], [0x2f, '[', '{'], [0x30, ']', '}'],
    [0x31, '\\', '|'], [0x33, ';', ':'], [0x34, "'", '"'], [0x35, '`', '~'],
    [0x36, ',', '<'], [0x37, '.', '>'], [0x38, '/', '?']
  ];
  var US = (function () {
    var map = {}, i;
    for (i = 0; i < US_ROWS.length; i++) {
      map[US_ROWS[i][1]] = [US_ROWS[i][0], 0];
      map[US_ROWS[i][2]] = [US_ROWS[i][0], 1];
    }
    return map;
  })();

  // TEXT controls: firmware send_string turns these bytes into editing keys.
  var TEXT_CONTROL = {8: '\u232b', 9: '\u21e5', 10: '\u23ce', 27: 'Esc'};
  // HID controls, for macro key actions. Space is composed like a character.
  var HID_CONTROL = {0x28: '\u23ce', 0x29: 'Esc', 0x2a: '\u232b', 0x2b: '\u21e5'};

  // Shifted symbol codes are LSFT(<base key>) in QMK/Vial; the base key is what the host sees.
  var SHIFTED_BASE = {
    KC_TILD: 'KC_GRAVE', KC_EXLM: 'KC_1', KC_AT: 'KC_2', KC_HASH: 'KC_3', KC_DLR: 'KC_4',
    KC_PERC: 'KC_5', KC_CIRC: 'KC_6', KC_AMPR: 'KC_7', KC_ASTR: 'KC_8', KC_LPRN: 'KC_9',
    KC_RPRN: 'KC_0', KC_UNDS: 'KC_MINUS', KC_PLUS: 'KC_EQUAL', KC_LCBR: 'KC_LBRACKET',
    KC_RCBR: 'KC_RBRACKET', KC_COLN: 'KC_SCOLON', KC_PIPE: 'KC_BSLASH', KC_QUES: 'KC_SLASH',
    KC_DQUO: 'KC_QUOTE', KC_LT: 'KC_COMMA', KC_GT: 'KC_DOT'
  };

  var LAYER_FN = {
    MO: 'Hold for ', TG: 'Toggle ', TO: 'Go to ', OSL: 'One-shot layer ',
    DF: 'Default layer ', TT: 'Tap-toggle ', PDF: 'Persistent default layer '
  };

  // --- small helpers -------------------------------------------------------

  function keycodes() {
    return KS.keycodes;
  }

  function estonian() {
    return KS.estonian;
  }

  function storedText(cell) {
    return typeof cell === 'string' ? cell : String(cell);
  }

  function baseLegend(code) {
    return {code: code, inherited: false, fromLayer: 0};
  }

  function outRow(hid) {
    var e = estonian();
    return e && typeof e.output === 'function' ? e.output(hid) : null;
  }

  // Text for a level; a dead level with no printable accent becomes the dotted-circle glyph.
  function levelText(hid, level, row) {
    var ch = row.levels[level];
    if (typeof ch === 'string' && ch) return ch;
    if (row.dead[level]) return HORN;
    return null;
  }

  function isTransparent(cell) {
    var action = keycodes().parse(cell);
    if (action.k === 'trans') return true;
    return (action.k === 'named') && action.id === 'KC_TRANSPARENT';
  }

  function layerName(ws, layer) {
    var names = ws && ws.meta && ws.meta.layerNames;
    var name = names && typeof names[layer] === 'string' ? names[layer].trim() : '';
    return name || 'Layer ' + layer;
  }

  function fieldsOf(ws) {
    var doc = ws && ws.doc;
    if (!doc) return null;
    return doc.fields || doc;
  }

  var MODS = [
    ['ctrl', 'Ctrl'], ['shift', 'Shift'], ['alt', 'Alt'], ['gui', 'Super']
  ];

  function modText(mods) {
    var names = [], i;
    if (!mods) return '';
    for (i = 0; i < MODS.length; i++) {
      if (mods[MODS[i][0]]) names.push(MODS[i][1]);
    }
    if (!names.length) return '';
    if (mods.right && names.length === 1) return 'Right ' + names[0];
    return names.join(' + ');
  }

  function modsOf(action) {
    return keycodes().modsFromBits(keycodes().modsBits(action.mods));
  }

  // Plain character of a single key, lowercased, for shortcut text such as Ctrl + c.
  function plainText(id) {
    var entry = keycodes().byId(id);
    if (entry && typeof entry.hid === 'number') {
      var row = outRow(entry.hid);
      if (row && typeof row.levels[0] === 'string' && row.levels[0]) return row.levels[0];
    }
    if (entry && entry.label) return entry.label.toLowerCase();
    return id;
  }

  function shortcutText(mods, innerId) {
    var head = modText(mods);
    return (head ? head + ' + ' : '') + plainText(innerId);
  }

  // --- describe ------------------------------------------------------------

  function charLegend(hid, level, code) {
    var row = outRow(hid);
    if (!row) return null;
    var main = levelText(hid, level, row);
    if (!main) return null;
    var legend = baseLegend(code);
    legend.kind = 'char';
    legend.main = main;
    legend.dead = row.dead[level] === true;
    if (level === 0) {
      var shift = levelText(hid, 1, row);
      var altgr = levelText(hid, 2, row);
      var shiftAltgr = levelText(hid, 3, row);
      if (shift) legend.shift = shift;
      if (altgr) legend.altgr = altgr;
      if (shiftAltgr) legend.shiftAltgr = shiftAltgr;
      var parts = [main];
      if (shift) parts.push('Shift ' + shift);
      if (altgr) parts.push('AltGr ' + altgr);
      if (shiftAltgr) parts.push('Shift+AltGr ' + shiftAltgr);
      legend.a11y = (legend.dead ? 'Dead accent ' : 'Types ') + parts.join(', ');
    } else {
      legend.a11y = (legend.dead ? 'Dead accent ' : 'Types ') + main;
    }
    return legend;
  }

  function describeMacro(action, ws) {
    var legend = baseLegend('M' + action.index);
    legend.kind = 'macro';
    var macros = fieldsOf(ws) ? fieldsOf(ws).macro : null;
    var actions = macros && Array.isArray(macros) ? macros[action.index] : null;
    if (Array.isArray(actions)) {
      var result = macroText(actions);
      legend.main = result.text || 'M' + action.index;
      legend.detail = 'Macro M' + action.index;
      if (!result.complete) legend.approximate = true;
      legend.a11y = 'Macro ' + action.index + ': ' + result.text;
    } else {
      legend.main = 'M' + action.index;
      legend.detail = 'Macro M' + action.index + ' is not in this file';
      legend.approximate = true;
      legend.a11y = 'Macro ' + action.index + ', not in this file';
    }
    return legend;
  }

  function describeTapDance(action, ws) {
    var legend = baseLegend('TD(' + action.index + ')');
    legend.kind = 'tapdance';
    var list = fieldsOf(ws) ? fieldsOf(ws).tap_dance : null;
    var dance = list && Array.isArray(list) ? list[action.index] : null;
    if (Array.isArray(dance) && dance.length >= 4) {
      var names = ['tap', 'hold', 'double', 'tap-hold'];
      var parts = [], i, tap;
      for (i = 0; i < 4; i++) {
        tap = describeCell(dance[i], ws);
        parts.push(names[i] + ' ' + tap.main);
      }
      legend.main = describeCell(dance[0], ws).main;
      legend.detail = parts.join(', ');
      legend.a11y = 'Tap dance ' + action.index + ': ' + parts.join(', ');
    } else {
      legend.main = 'TD(' + action.index + ')';
      legend.detail = 'Tap dance ' + action.index + ' is not in this file';
      legend.approximate = true;
      legend.a11y = 'Tap dance ' + action.index + ', not in this file';
    }
    return legend;
  }

  function describeAction(action, ws, code) {
    var legend, entry, row, level, mods, bits, inner;

    switch (action.k) {
      case 'none':
        legend = baseLegend(code);
        legend.kind = 'none';
        legend.main = 'No key';
        legend.a11y = 'No key';
        return legend;

      case 'trans':
        legend = baseLegend(code);
        legend.kind = 'none';
        legend.main = 'Transparent';
        legend.a11y = 'Transparent';
        return legend;

      case 'basic':
      case 'named':
        entry = keycodes().byId(action.id);
        if (!entry) {
          legend = baseLegend(code);
          legend.kind = 'raw';
          legend.main = code;
          legend.unknown = true;
          legend.a11y = 'Unknown keycode ' + code;
          return legend;
        }
        if (entry.category === 'modifiers') {
          legend = baseLegend(code);
          legend.kind = 'modifier';
          legend.main = entry.label || entry.id;
          legend.detail = entry.id;
          legend.a11y = legend.main;
          return legend;
        }
        if (typeof entry.hid === 'number') {
          legend = charLegend(entry.hid, 0, code);
          if (legend) return legend;
          // HID specials (Enter, Tab, ...) are actions, not typed characters.
        }
        if (SHIFTED_BASE[action.id]) {
          inner = keycodes().byId(SHIFTED_BASE[action.id]);
          if (inner && typeof inner.hid === 'number') {
            legend = charLegend(inner.hid, 1, code);
            if (legend) return legend;
          }
        }
        legend = baseLegend(code);
        legend.kind = 'action';
        legend.main = entry.label || entry.id;
        legend.a11y = legend.main;
        return legend;

      case 'mods':
        mods = modsOf(action);
        bits = keycodes().modsBits(mods);
        inner = action.inner;
        if (inner && (inner.k === 'basic' || inner.k === 'named')) {
          if (!(bits & 0x01) && !(bits & 0x08)) {
            level = (mods.shift ? 1 : 0) + (mods.alt && mods.right ? 2 : 0);
            entry = keycodes().byId(inner.id);
            if (entry && typeof entry.hid === 'number' && level > 0) {
              legend = charLegend(entry.hid, level, code);
              if (legend) return legend;
            }
          }
          legend = baseLegend(code);
          legend.kind = 'shortcut';
          legend.main = shortcutText(mods, inner.id);
          legend.a11y = legend.main;
          return legend;
        }
        legend = baseLegend(code);
        legend.kind = 'shortcut';
        legend.main = modText(mods) || code;
        legend.a11y = legend.main;
        return legend;

      case 'modtap':
        legend = describeCellAction(action.tap, ws, code);
        delete legend.shift;
        delete legend.altgr;
        delete legend.shiftAltgr;
        legend.code = code;
        legend.kind = 'shortcut';
        legend.hold = {kind: 'mod', text: modText(modsOf(action))};
        legend.a11y = 'Tap ' + legend.main + ', hold ' + legend.hold.text;
        return legend;

      case 'layertap':
        legend = describeCellAction(action.tap, ws, code);
        delete legend.shift;
        delete legend.altgr;
        delete legend.shiftAltgr;
        legend.code = code;
        legend.kind = 'layer';
        legend.layer = action.layer;
        legend.hold = {kind: 'layer', text: layerName(ws, action.layer), layer: action.layer};
        legend.detail = 'Tap ' + legend.main + ', hold ' + legend.hold.text;
        legend.a11y = legend.detail;
        return legend;

      case 'layer':
        legend = baseLegend(code);
        legend.kind = 'layer';
        legend.layer = action.layer;
        legend.main = layerName(ws, action.layer);
        legend.detail = (LAYER_FN[action.fn] || action.fn + ' ') + legend.main;
        legend.a11y = legend.detail;
        return legend;

      case 'layermod':
        legend = baseLegend(code);
        legend.kind = 'layer';
        legend.layer = action.layer;
        legend.main = layerName(ws, action.layer);
        legend.detail = 'Hold ' + legend.main + ' with ' + modText(modsOf(action));
        legend.hold = {kind: 'mod', text: modText(modsOf(action))};
        legend.a11y = legend.detail;
        return legend;

      case 'osm':
        legend = baseLegend(code);
        legend.kind = 'modifier';
        legend.main = modText(modsOf(action));
        legend.detail = 'One-shot ' + legend.main;
        legend.a11y = legend.detail;
        return legend;

      case 'macro':
        return describeMacro(action, ws);

      case 'tapdance':
        return describeTapDance(action, ws);

      default:
        legend = baseLegend(code);
        legend.kind = 'raw';
        legend.main = code;
        legend.unknown = !keycodes().isKnown(code);
        legend.a11y = legend.unknown ? 'Unknown keycode ' + code : 'Keycode ' + code;
        return legend;
    }
  }

  function describeCellAction(action, ws, code) {
    return describeAction(action, ws, code);
  }

  function describeCell(cell, ws) {
    var action = keycodes().parse(cell);
    var code = storedText(cell);
    var legend;
    if (action.k === 'raw') {
      legend = baseLegend(code);
      legend.kind = 'raw';
      legend.main = action.text;
      legend.unknown = !keycodes().isKnown(cell);
      if (!legend.unknown && typeof cell === 'number') legend.detail = 'Numeric keycode';
      legend.a11y = legend.unknown ? 'Unknown keycode ' + code : 'Keycode ' + code;
      return legend;
    }
    legend = describeAction(action, ws, code);
    return legend;
  }

  // --- macro text ----------------------------------------------------------

  function emitControl(state, text) {
    if (state.pending) {
      state.out += state.pending.display;
      state.pending = null;
      state.complete = false;
    }
    state.out += text;
  }

  function feed(state, text, dead, mark) {
    var composed;
    if (typeof text !== 'string' || !text) return;
    if (state.pending) {
      if (text === ' ') {
        state.out += state.pending.display;
        state.pending = null;
        return;
      }
      composed = state.pending.mark ? (text + state.pending.mark).normalize('NFC') : text;
      if (state.pending.mark && composed.length === 1) {
        state.out += composed;
        state.pending = null;
        return;
      }
      state.out += state.pending.display + text;
      state.pending = null;
      state.complete = false;
      return;
    }
    if (dead) {
      if (mark) {
        state.pending = {display: text, mark: mark};
      } else {
        state.out += text;
        state.complete = false;
      }
      return;
    }
    state.out += text;
  }

  function textChar(state, ch) {
    var code = ch.charCodeAt(0), us, row, text;
    if (TEXT_CONTROL[code] !== undefined) {
      emitControl(state, TEXT_CONTROL[code]);
      return;
    }
    if (code < 0x20 || code > 0x7e) {
      emitControl(state, '?');
      state.complete = false;
      return;
    }
    if (ch === ' ') {
      feed(state, ' ', false, null);
      return;
    }
    us = US[ch];
    if (!us) {
      emitControl(state, '?');
      state.complete = false;
      return;
    }
    row = outRow(us[0]);
    text = row ? levelText(us[0], us[1], row) : null;
    if (!text) {
      emitControl(state, '?');
      state.complete = false;
      return;
    }
    feed(state, text, row.dead[us[1]] === true, row.dead[us[1]] ? ACCENT_MARK[text] : null);
  }

  function macroTextString(state, s) {
    var i, code;
    for (i = 0; i < s.length; i++) {
      code = s.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdfff) {
        // One astral character is one '?', not one per UTF-16 unit.
        emitControl(state, '?');
        state.complete = false;
        if (code <= 0xdbff && i + 1 < s.length) i++;
        continue;
      }
      textChar(state, s.charAt(i));
    }
  }

  function setModifier(state, id, down) {
    if (id === 'KC_LSHIFT' || id === 'KC_RSHIFT') state.shift = down;
    else if (id === 'KC_RALT') state.altgr = down;
  }

  function keyAction(state, cell, kind) {
    var action = keycodes().parse(cell), entry, row, level, text, mods, bits;

    if (action.k === 'none' || action.k === 'trans') return;

    if (action.k === 'basic' || action.k === 'named') {
      entry = keycodes().byId(action.id);
      if (entry && entry.category === 'modifiers') {
        if (kind !== 'tap') setModifier(state, action.id, kind === 'down');
        return;
      }
      if (kind === 'up') return;
      if (!entry) {
        state.complete = false;
        return;
      }
      if (typeof entry.hid !== 'number') {
        state.complete = false;
        return;
      }
      if (entry.hid === 0x2c) {
        feed(state, ' ', false, null);
        return;
      }
      row = outRow(entry.hid);
      if (row) {
        level = (state.shift ? 1 : 0) + (state.altgr ? 2 : 0);
        text = levelText(entry.hid, level, row);
        if (text) {
          feed(state, text, row.dead[level] === true,
            row.dead[level] ? (ACCENT_MARK[text] || HORN_MARK) : null);
          return;
        }
      }
      if (HID_CONTROL[entry.hid] !== undefined) {
        emitControl(state, HID_CONTROL[entry.hid]);
        return;
      }
      if (entry.label) emitControl(state, entry.label);
      state.complete = false;
      return;
    }

    if (action.k === 'mods' && (action.inner.k === 'basic' || action.inner.k === 'named')) {
      if (kind === 'up') return;
      mods = modsOf(action);
      bits = keycodes().modsBits(mods);
      entry = keycodes().byId(action.inner.id);
      if (!(bits & 0x01) && !(bits & 0x08) && entry && typeof entry.hid === 'number') {
        level = ((state.shift || mods.shift) ? 1 : 0) + ((state.altgr || mods.right) ? 2 : 0);
        row = outRow(entry.hid);
        if (row) {
          text = levelText(entry.hid, level, row);
          if (text) {
            feed(state, text, row.dead[level] === true,
              row.dead[level] ? (ACCENT_MARK[text] || HORN_MARK) : null);
            return;
          }
        }
      }
      emitControl(state, shortcutText(mods, action.inner.id));
      state.complete = false;
      return;
    }

    state.complete = false;
  }

  function macroText(actions) {
    var state = {out: '', complete: true, shift: false, altgr: false, pending: null};
    var i, j, a;
    if (!Array.isArray(actions)) return {text: '', complete: true};
    for (i = 0; i < actions.length; i++) {
      a = actions[i];
      if (!Array.isArray(a) || typeof a[0] !== 'string') {
        state.complete = false;
        continue;
      }
      if (a[0] === 'delay') continue;
      if (a[0] === 'text') {
        if (typeof a[1] === 'string') macroTextString(state, a[1]);
        else state.complete = false;
        continue;
      }
      if (a[0] === 'tap' || a[0] === 'down' || a[0] === 'up') {
        for (j = 1; j < a.length; j++) keyAction(state, a[j], a[0]);
        continue;
      }
      state.complete = false;
    }
    if (state.pending) {
      state.out += state.pending.display;
      state.pending = null;
      state.complete = false;
    }
    return {text: state.out, complete: state.complete};
  }

  // --- public surface ------------------------------------------------------

  function describe(cell, ws) {
    return describeCell(cell, ws);
  }

  function at(ws, layer, row, col) {
    var layout = fieldsOf(ws) ? fieldsOf(ws).layout : null;
    var value = layout && Array.isArray(layout[layer]) ? layout[layer][row] : null;
    var cell = value && typeof value[col] !== 'undefined' ? value[col] : -1;
    var legend, base;
    if (layer > 0 && isTransparent(cell)) {
      base = layout && Array.isArray(layout[0]) ? layout[0][row] : null;
      if (base && typeof base[col] !== 'undefined' && !isTransparent(base[col])) {
        legend = describeCell(base[col], ws);
        legend.inherited = true;
        legend.fromLayer = 0;
        legend.a11y += ', inherited from ' + layerName(ws, 0);
        return legend;
      }
    }
    legend = describeCell(cell, ws);
    legend.fromLayer = layer;
    return legend;
  }

  function encoder(ws, layer, index, dir) {
    var list = fieldsOf(ws) ? fieldsOf(ws).encoder_layout : null;
    var pair = list && Array.isArray(list[layer]) ? list[layer][index] : null;
    var cell = pair && typeof pair[dir] !== 'undefined' ? pair[dir] : -1;
    var clockwise = dir === 0;
    var label = clockwise ? 'Clockwise' : 'Counter-clockwise';
    var legend = describeCell(cell, ws);
    legend.fromLayer = layer;
    legend.detail = label + (legend.detail ? ', ' + legend.detail : '');
    legend.a11y += ', encoder ' + (index + 1) + ', ' + label.toLowerCase();
    return legend;
  }

  KS.legend = {
    describe: describe,
    at: at,
    encoder: encoder,
    macroText: macroText
  };
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
