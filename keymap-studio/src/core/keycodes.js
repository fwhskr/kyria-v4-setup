/*
 * API-KC: parse, format, validate and look up Vial keycodes.
 *
 * The document keeps keycode strings verbatim (ADR-S3), so `format` is only used for codes
 * the user composes in the picker and a code that is not edited is never rewritten.
 * Grammar and names follow Vial GUI aef8222a (`keycodes/keycodes_v6.py`, `any_keycode.py`):
 * simple names and aliases, nested modifier wrappers, *_T mod-taps, LT<n>/LT(layer, kc),
 * MO/TG/TO/DF/OSL/TT/PDF, LM, OSM, MT, TD(n) and M<n>. Unrecognised text stays raw.
 *
 * Actions:
 *   {k:'none'} {k:'trans'} {k:'basic', id} {k:'named', id}
 *   {k:'mods', mods, inner} {k:'modtap', mods, tap}
 *   {k:'layer', fn:'MO'|'TG'|'TO'|'OSL'|'DF'|'TT'|'PDF', layer}
 *   {k:'layertap', layer, tap} {k:'layermod', layer, mods} {k:'osm', mods}
 *   {k:'macro', index} {k:'tapdance', index} {k:'raw', text}
 * Mods: {ctrl, shift, alt, gui, right} — QMK's 5-bit form, one side flag for every modifier.
 */
(function (KS) {
  'use strict';

  var CTRL = 0x01, SHIFT = 0x02, ALT = 0x04, GUI = 0x08, RIGHT = 0x10;

  // Vial protocol-6 modifier wrappers: name -> QMK mod bits (any_keycode.py functions).
  var WRAP = {
    LCTL: CTRL, C: CTRL, LOPT: ALT, LALT: ALT, A: ALT, LGUI: GUI, G: GUI,
    LCMD: GUI, LWIN: GUI, LSFT: SHIFT, S: SHIFT,
    RCTL: CTRL | RIGHT, ROPT: ALT | RIGHT, RALT: ALT | RIGHT, ALGR: ALT | RIGHT,
    RGUI: GUI | RIGHT, RCMD: GUI | RIGHT, RWIN: GUI | RIGHT,
    RSFT: SHIFT | RIGHT,
    C_S: CTRL | SHIFT, LCA: CTRL | ALT, LSA: SHIFT | ALT, MEH: CTRL | SHIFT | ALT,
    LCG: CTRL | GUI, SGUI: SHIFT | GUI, SCMD: SHIFT | GUI, SWIN: SHIFT | GUI, LSG: SHIFT | GUI,
    LAG: ALT | GUI, LCAG: CTRL | ALT | GUI, HYPR: CTRL | SHIFT | ALT | GUI,
    RCS: CTRL | SHIFT | RIGHT, RSA: SHIFT | ALT | RIGHT, SAGR: SHIFT | ALT | RIGHT,
    RCG: CTRL | GUI | RIGHT
  };

  var WRAP_TAP = {
    LCTL_T: CTRL, CTL_T: CTRL, LOPT_T: ALT, LALT_T: ALT, ALT_T: ALT, OPT_T: ALT,
    LGUI_T: GUI, GUI_T: GUI, CMD_T: GUI, LCMD_T: GUI, LWIN_T: GUI, WIN_T: GUI,
    LSFT_T: SHIFT, SFT_T: SHIFT,
    RCTL_T: CTRL | RIGHT, ROPT_T: ALT | RIGHT, RALT_T: ALT | RIGHT, ALGR_T: ALT | RIGHT,
    RGUI_T: GUI | RIGHT, RCMD_T: GUI | RIGHT, RWIN_T: GUI | RIGHT, RSFT_T: SHIFT | RIGHT,
    C_S_T: CTRL | SHIFT, MEH_T: CTRL | SHIFT | ALT, HYPR_T: CTRL | SHIFT | ALT | GUI,
    ALL_T: CTRL | SHIFT | ALT | GUI,
    LCAG_T: CTRL | ALT | GUI, RCAG_T: CTRL | ALT | GUI | RIGHT,
    LCA_T: CTRL | ALT, LSA_T: SHIFT | ALT, LAG_T: ALT | GUI, LCG_T: CTRL | GUI,
    SGUI_T: SHIFT | GUI, SCMD_T: SHIFT | GUI, SWIN_T: SHIFT | GUI, LSG_T: SHIFT | GUI,
    RSA_T: SHIFT | ALT | RIGHT, SAGR_T: SHIFT | ALT | RIGHT,
    RCS_T: CTRL | SHIFT | RIGHT, RCG_T: CTRL | GUI | RIGHT
  };

  // Canonical combined names Vial writes for a whole mod mask (format order).
  var COMBINED = {
    0x01: 'LCTL', 0x02: 'LSFT', 0x04: 'LALT', 0x08: 'LGUI',
    0x03: 'C_S', 0x05: 'LCA', 0x06: 'LSA', 0x07: 'MEH', 0x09: 'LCG',
    0x0a: 'SGUI', 0x0c: 'LAG', 0x0d: 'LCAG', 0x0f: 'HYPR',
    0x11: 'RCTL', 0x12: 'RSFT', 0x14: 'RALT', 0x18: 'RGUI',
    0x13: 'RCS', 0x16: 'RSA', 0x19: 'RCG'
  };
  var COMBINED_TAP = {
    0x01: 'LCTL_T', 0x02: 'LSFT_T', 0x04: 'LALT_T', 0x08: 'LGUI_T',
    0x03: 'C_S_T', 0x05: 'LCA_T', 0x06: 'LSA_T', 0x07: 'MEH_T', 0x09: 'LCG_T',
    0x0a: 'SGUI_T', 0x0c: 'LAG_T', 0x0d: 'LCAG_T', 0x0f: 'ALL_T',
    0x11: 'RCTL_T', 0x12: 'RSFT_T', 0x14: 'RALT_T', 0x18: 'RGUI_T',
    0x19: 'RCG_T', 0x1d: 'RCAG_T'
  };
  var LAYER_FNS = {MO: 1, TG: 1, TO: 1, DF: 1, OSL: 1, TT: 1, PDF: 1};
  var MOD_NAMES = {
    MOD_LCTL: CTRL, MOD_LSFT: SHIFT, MOD_LALT: ALT, MOD_LGUI: GUI,
    MOD_RCTL: CTRL | RIGHT, MOD_RSFT: SHIFT | RIGHT, MOD_RALT: ALT | RIGHT, MOD_RGUI: GUI | RIGHT,
    MOD_MEH: CTRL | SHIFT | ALT, MOD_HYPR: CTRL | SHIFT | ALT | GUI
  };
  // Categories whose entries are plain HID keycodes (Vial's Keycode.is_basic, < 0xFF).
  var BASIC_CATEGORIES = {
    letters: 1, digits: 1, punctuation: 1, keypad: 1, editing: 1, function: 1, modifiers: 1
  };

  var INDEX = null;

  function KeycodeError(code, message) {
    this.name = 'KeycodeError';
    this.code = code;
    this.message = message;
  }
  KeycodeError.prototype = Object.create(Error.prototype);
  KeycodeError.prototype.constructor = KeycodeError;

  function fail(code, message) {
    throw new KeycodeError(code, message);
  }

  function catalogData() {
    return KS.keycodeCatalog || {entries: [], categories: []};
  }

  function index() {
    if (INDEX) return INDEX;
    var entries = catalogData().entries || [];
    var byId = {}, byAlias = {}, i, e, j;
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      byId[e.id] = e;
      for (j = 0; j < (e.aliases || []).length; j++) byAlias[e.aliases[j]] = e;
    }
    INDEX = {byId: byId, byAlias: byAlias, entries: entries};
    return INDEX;
  }

  function isBasicCategory(entry) {
    return entry && BASIC_CATEGORIES[entry.category] === 1;
  }

  function actionName(entry) {
    return isBasicCategory(entry) ? {k: 'basic', id: entry.id} : {k: 'named', id: entry.id};
  }

  function lookup(idOrAlias) {
    var ix = index();
    if (typeof idOrAlias !== 'string') return null;
    return ix.byId[idOrAlias] || ix.byAlias[idOrAlias] || null;
  }

  // --- numbers, mods -------------------------------------------------------

  function integer(text) {
    if (typeof text !== 'string') return null;
    var s = text.trim();
    if (/^-?[0-9]+$/.test(s)) return parseInt(s, 10);
    if (/^0[xX][0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
    return null;
  }

  function decodeMods(bits) {
    return {
      ctrl: (bits & CTRL) === CTRL,
      shift: (bits & SHIFT) === SHIFT,
      alt: (bits & ALT) === ALT,
      gui: (bits & GUI) === GUI,
      right: (bits & RIGHT) === RIGHT
    };
  }

  function encodeMods(mods) {
    if (!mods || typeof mods !== 'object') return 0;
    return (mods.ctrl ? CTRL : 0) | (mods.shift ? SHIFT : 0) | (mods.alt ? ALT : 0) |
      (mods.gui ? GUI : 0) | (mods.right ? RIGHT : 0);
  }

  function modsEmpty(mods) {
    return (encodeMods(mods) & (CTRL | SHIFT | ALT | GUI)) === 0;
  }

  // "MOD_LCTL|MOD_LSFT" or a raw number. Returns {bits, mixed} or null.
  function modsExpr(text) {
    if (typeof text !== 'string') return null;
    var parts = text.split('|'), bits = 0, left = false, right = false, i, p, v;
    if (!parts.length) return null;
    for (i = 0; i < parts.length; i++) {
      p = parts[i].trim();
      if (!p) return null;
      if (p.charAt(0) === 'M' && p.slice(0, 4) === 'MOD_') {
        if (MOD_NAMES[p] === undefined) return null;
        v = MOD_NAMES[p];
        if ((v & RIGHT) === RIGHT) right = true; else left = true;
      } else {
        v = integer(p);
        if (v === null || v < 0 || v > 0x1f) return null;
        if ((v & RIGHT) === RIGHT) right = true;
        if ((v & ~RIGHT) !== 0) left = true;
      }
      bits |= v;
    }
    return {bits: bits, mixed: left && right};
  }

  function modsText(mods) {
    var bits = encodeMods(mods) & (CTRL | SHIFT | ALT | GUI), out = [], z = mods && mods.right ? 'R' : 'L';
    if (bits === 0) return null;
    if (bits === (CTRL | SHIFT | ALT)) return 'MOD_MEH';
    if (bits === (CTRL | SHIFT | ALT | GUI)) return 'MOD_HYPR';
    if (bits & CTRL) out.push('MOD_' + z + 'CTL');
    if (bits & SHIFT) out.push('MOD_' + z + 'SFT');
    if (bits & ALT) out.push('MOD_' + z + 'ALT');
    if (bits & GUI) out.push('MOD_' + z + 'GUI');
    return out.join('|');
  }

  // Groups of MOD_* tokens separated by |, e.g. MOD_LCTL|MOD_RSFT, for mixed-side detection.
  function mixedSides(text) {
    var re = /(?:MOD_[A-Z]+)(?:\|MOD_[A-Z]+)+/g, m, left, right;
    while ((m = re.exec(text)) !== null) {
      left = /MOD_L/.test(m[0]);
      right = /MOD_R/.test(m[0]);
      if (left && right) return true;
    }
    return false;
  }

  // Nested wrappers for a mask Vial has no single name for, e.g. LCTL(LSFT(KC_A)).
  function wrapNested(bits, inner) {
    var out = inner, order = [GUI, ALT, SHIFT, CTRL], z = (bits & RIGHT) === RIGHT ? 'R' : 'L', i;
    for (i = 0; i < order.length; i++) {
      if ((bits & order[i]) === order[i]) {
        out = z + (order[i] === CTRL ? 'CTL' : order[i] === SHIFT ? 'SFT' : order[i] === ALT ? 'ALT' : 'GUI') + '(' + out + ')';
      }
    }
    return out;
  }

  // --- parsing -------------------------------------------------------------

  function splitCall(text) {
    var open = text.indexOf('(');
    if (open <= 0 || text.charAt(text.length - 1) !== ')') return null;
    var name = text.slice(0, open), inner = text.slice(open + 1, -1);
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return null;
    var depth = 0, args = [], cur = '', i, ch;
    for (i = 0; i < inner.length; i++) {
      ch = inner.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth < 0) return null;
      } else if (ch === ',' && depth === 0) {
        args.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (depth !== 0) return null;
    args.push(cur);
    return {name: name, args: args.map(function (s) { return s.trim(); })};
  }

  function parseCode(text) {
    var entry, call, bits, inner, mods, layer, i;

    // Vial's no-op forms are actions of their own, not plain catalog names.
    if (text === 'KC_NO') return {k: 'none'};
    if (text === 'KC_TRNS' || text === 'KC_TRANSPARENT') return {k: 'trans'};

    entry = lookup(text);

    if (entry) return actionName(entry);

    if (/^M[0-9]{1,3}$/.test(text)) {
      var m = parseInt(text.slice(1), 10);
      if (m <= 255) return {k: 'macro', index: m};
      return null;
    }
    if (/^USER[0-9]{2}$/.test(text)) return {k: 'named', id: text};

    call = splitCall(text);
    if (!call) return null;

    if (WRAP[call.name] !== undefined) {
      if (call.args.length !== 1) return null;
      bits = WRAP[call.name];
      inner = parseCode(call.args[0]);
      if (!inner) return null;
      if (inner.k === 'mods') {
        // Vial ORs the masks, so LCTL(RCTL(KC_A)) is RCTL(KC_A).
        return {k: 'mods', mods: decodeMods(bits | encodeMods(inner.mods)), inner: inner.inner};
      }
      return {k: 'mods', mods: decodeMods(bits), inner: inner};
    }

    if (WRAP_TAP[call.name] !== undefined) {
      if (call.args.length !== 1) return null;
      inner = parseCode(call.args[0]);
      if (!inner) return null;
      return {k: 'modtap', mods: decodeMods(WRAP_TAP[call.name]), tap: inner};
    }

    if (LAYER_FNS[call.name] === 1 && call.args.length === 1) {
      layer = integer(call.args[0]);
      if (layer === null) return null;
      return {k: 'layer', fn: call.name, layer: layer};
    }

    if (/^LT[0-9]{1,2}$/.test(call.name)) {
      if (call.args.length !== 1) return null;
      layer = parseInt(call.name.slice(2), 10);
      inner = parseCode(call.args[0]);
      if (!inner) return null;
      return {k: 'layertap', layer: layer, tap: inner};
    }

    if (call.name === 'LT') {
      if (call.args.length !== 2) return null;
      layer = integer(call.args[0]);
      inner = parseCode(call.args[1]);
      if (layer === null || !inner) return null;
      return {k: 'layertap', layer: layer, tap: inner};
    }

    if (call.name === 'LM') {
      if (call.args.length !== 2) return null;
      layer = integer(call.args[0]);
      mods = modsExpr(call.args[1]);
      if (layer === null || !mods) return null;
      return {k: 'layermod', layer: layer, mods: decodeMods(mods.bits)};
    }

    if (call.name === 'OSM') {
      if (call.args.length !== 1) return null;
      mods = modsExpr(call.args[0]);
      if (!mods) return null;
      return {k: 'osm', mods: decodeMods(mods.bits)};
    }

    if (call.name === 'MT') {
      if (call.args.length !== 2) return null;
      mods = modsExpr(call.args[0]);
      inner = parseCode(call.args[1]);
      if (!mods || !inner) return null;
      return {k: 'modtap', mods: decodeMods(mods.bits), tap: inner};
    }

    if (call.name === 'TD') {
      if (call.args.length !== 1) return null;
      i = integer(call.args[0]);
      if (i === null || i < 0) return null;
      return {k: 'tapdance', index: i};
    }

    return null;
  }

  function parse(cell) {
    try {
      if (typeof cell === 'number') {
        if (cell === -1) return {k: 'none'};
        return {k: 'raw', text: String(cell)};
      }
      if (typeof cell !== 'string') return {k: 'raw', text: String(cell)};
      var text = cell.trim();
      if (!text) return {k: 'raw', text: cell};
      if (text === '-1') return {k: 'none'};
      var action = parseCode(text);
      if (action) return action;
      return {k: 'raw', text: cell};
    } catch (err) {
      return {k: 'raw', text: typeof cell === 'number' ? String(cell) : String(cell)};
    }
  }

  // --- formatting ----------------------------------------------------------

  function formatModsWrap(bits, inner) {
    if (bits === 0) return inner;
    if (COMBINED[bits] !== undefined) return COMBINED[bits] + '(' + inner + ')';
    return wrapNested(bits, inner);
  }

  function formatModsTap(bits, inner) {
    if ((bits & (CTRL | SHIFT | ALT | GUI)) === 0) fail('E_KEYCODE_MODS', 'A mod-tap needs at least one modifier');
    if (COMBINED_TAP[bits] !== undefined) return COMBINED_TAP[bits] + '(' + inner + ')';
    return 'MT(' + modsText(decodeMods(bits)) + ', ' + inner + ')';
  }

  // Vial masks the inner code to one byte, so mods, mod-tap and layer-tap hold one plain name.
  function plainName(text, what) {
    if (!/^[A-Za-z0-9_]+$/.test(text)) {
      fail('E_KEYCODE_ARG', what + ' can only hold a single key code, not ' + text);
    }
    return text;
  }

  function format(action) {
    if (!action || typeof action !== 'object' || typeof action.k !== 'string') {
      fail('E_KEYCODE_ACTION', 'Not a keycode action');
    }
    var bits, inner;
    switch (action.k) {
      case 'none':
        return 'KC_NO';
      case 'trans':
        return 'KC_TRNS';
      case 'basic':
      case 'named':
        if (typeof action.id !== 'string' || !action.id) {
          fail('E_KEYCODE_NAME', 'Keycode action without a name');
        }
        if (!lookup(action.id)) fail('E_KEYCODE_UNKNOWN', 'Unknown keycode "' + action.id + '"');
        return action.id;
      case 'mods':
        bits = encodeMods(action.mods);
        inner = plainName(format(action.inner), 'A modifier');
        if (bits === 0) return inner;
        return formatModsWrap(bits, inner);
      case 'modtap':
        bits = encodeMods(action.mods);
        inner = plainName(format(action.tap), 'A mod-tap');
        return formatModsTap(bits, inner);
      case 'layer':
        if (!LAYER_FNS[action.fn]) fail('E_KEYCODE_FN', 'Unknown layer function ' + String(action.fn));
        if (typeof action.layer !== 'number' || action.layer % 1 !== 0 || action.layer < 0 || action.layer > 255) {
          fail('E_KEYCODE_LAYER', 'Layer out of range');
        }
        return action.fn + '(' + action.layer + ')';
      case 'layertap':
        inner = plainName(format(action.tap), 'A layer-tap');
        if (typeof action.layer !== 'number' || action.layer % 1 !== 0 || action.layer < 0) {
          fail('E_KEYCODE_LAYER', 'Layer out of range');
        }
        if (action.layer > 15) fail('E_KEYCODE_LAYER', 'Layer-tap supports layers 0-15 only');
        return 'LT' + action.layer + '(' + inner + ')';
      case 'layermod':
        if (typeof action.layer !== 'number' || action.layer % 1 !== 0 || action.layer < 0 || action.layer > 15) {
          fail('E_KEYCODE_LAYER', 'Layer-modifier supports layers 0-15 only');
        }
        bits = encodeMods(action.mods);
        if (modsEmpty(action.mods)) fail('E_KEYCODE_MODS', 'A layer modifier needs at least one modifier');
        return 'LM(' + action.layer + ', ' + modsText(decodeMods(bits)) + ')';
      case 'osm':
        bits = encodeMods(action.mods);
        if (modsEmpty(action.mods)) fail('E_KEYCODE_MODS', 'A one-shot modifier needs at least one modifier');
        return 'OSM(' + modsText(decodeMods(bits)) + ')';
      case 'macro':
        if (typeof action.index !== 'number' || action.index % 1 !== 0 || action.index < 0 || action.index > 255) {
          fail('E_KEYCODE_MACRO', 'Macro index must be 0-255');
        }
        return 'M' + action.index;
      case 'tapdance':
        if (typeof action.index !== 'number' || action.index % 1 !== 0 || action.index < 0 || action.index > 255) {
          fail('E_KEYCODE_TAPDANCE', 'Tap dance index must be 0-255');
        }
        return 'TD(' + action.index + ')';
      case 'raw':
        if (typeof action.text !== 'string' || !action.text.trim()) {
          fail('E_KEYCODE_EMPTY', 'Empty keycode');
        }
        return action.text;
      default:
        fail('E_KEYCODE_ACTION', 'Unknown keycode action kind ' + action.k);
    }
  }

  // --- validation ----------------------------------------------------------

  function issue(code, message, severity) {
    return {severity: severity || 'error', code: code, path: '', message: message};
  }

  function distance(a, b) {
    var i, j, prev = [], cur, tmp;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function suggestion(text) {
    var ix = index(), best = null, bestD = 4, i, list = [];
    for (i = 0; i < ix.entries.length; i++) {
      list.push(ix.entries[i].id);
      Array.prototype.push.apply(list, ix.entries[i].aliases || []);
    }
    for (i = 0; i < list.length; i++) {
      var d = distance(text, list[i]);
      if (d < bestD) {
        bestD = d;
        best = list[i];
      }
    }
    return best;
  }

  function unknownIssue(text) {
    var up = text.toUpperCase(), action = null, guess;
    if (up !== text) {
      try {
        action = parseCode(up);
      } catch (err) {
        action = null;
      }
      if (action) return issue('E_KEYCODE_UNKNOWN', 'Keycode names are case-sensitive: use ' + up);
    }
    guess = suggestion(text);
    if (guess) return issue('E_KEYCODE_UNKNOWN', 'Unknown keycode "' + text + '". Did you mean ' + guess + '?');
    return issue('E_KEYCODE_UNKNOWN', 'Unknown keycode "' + text + '"');
  }

  function maxLayer(opts) {
    if (opts && typeof opts.layers === 'number' && opts.layers > 0) return opts.layers - 1;
    return 31;
  }

  function limitOf(opts, key, fallback) {
    if (opts && typeof opts[key] === 'number' && opts[key] > 0) return opts[key] - 1;
    return fallback;
  }

  function checkAction(action, opts, issues, depth) {
    var bits, max, i;
    if (depth > 8) {
      issues.push(issue('E_KEYCODE_SYNTAX', 'Keycode nested too deeply'));
      return;
    }
    switch (action.k) {
      case 'none':
      case 'trans':
        return;
      case 'basic':
      case 'named':
        if (!lookup(action.id)) issues.push(unknownIssue(action.id));
        return;
      case 'raw':
        issues.push(issue('E_KEYCODE_SYNTAX', 'Not a Vial keycode: "' + action.text + '"'));
        return;
      case 'mods':
      case 'modtap':
        bits = encodeMods(action.mods);
        if ((bits & (CTRL | SHIFT | ALT | GUI)) === 0) {
          issues.push(issue('E_KEYCODE_MODS', 'Choose at least one modifier'));
          return;
        }
        var inner = action.k === 'mods' ? action.inner : action.tap;
        if (!inner || (inner.k !== 'basic' && inner.k !== 'named')) {
          issues.push(issue('E_KEYCODE_ARG', 'A modifier can only wrap a single key, not a layer, macro or another modifier'));
          return;
        }
        checkAction(inner, opts, issues, depth + 1);
        return;
      case 'layer':
        if (!LAYER_FNS[action.fn]) {
          issues.push(issue('E_KEYCODE_FN', 'Unknown layer function ' + String(action.fn)));
          return;
        }
        max = maxLayer(opts);
        if (action.layer < 0 || action.layer > max) {
          issues.push(issue('E_KEYCODE_LAYER', 'Layer ' + action.layer + ' does not exist in this file (0-' + max + ')'));
        }
        return;
      case 'layertap':
        max = Math.min(15, maxLayer(opts));
        if (action.layer < 0 || action.layer > max) {
          issues.push(issue('E_KEYCODE_LAYER', 'Layer-tap supports layers 0-' + max + ' in this file'));
        }
        if (!action.tap || (action.tap.k !== 'basic' && action.tap.k !== 'named')) {
          issues.push(issue('E_KEYCODE_ARG', 'A layer-tap can only hold a single key, not a layer, macro or another modifier'));
          return;
        }
        checkAction(action.tap, opts, issues, depth + 1);
        return;
      case 'layermod':
        if (action.layer < 0 || action.layer > 15) {
          issues.push(issue('E_KEYCODE_LAYER', 'Layer-modifier supports layers 0-15 only'));
        }
        if (modsEmpty(action.mods)) issues.push(issue('E_KEYCODE_MODS', 'Choose at least one modifier'));
        return;
      case 'osm':
        if (modsEmpty(action.mods)) issues.push(issue('E_KEYCODE_MODS', 'Choose at least one modifier'));
        return;
      case 'macro':
        max = limitOf(opts, 'macros', 255);
        if (action.index < 0 || action.index > Math.min(255, max)) {
          issues.push(issue('E_KEYCODE_MACRO', 'Macro M' + action.index + ' does not exist in this file'));
        }
        return;
      case 'tapdance':
        max = limitOf(opts, 'tapDances', 255);
        if (action.index < 0 || action.index > Math.min(255, max)) {
          issues.push(issue('E_KEYCODE_TAPDANCE', 'Tap dance TD(' + action.index + ') does not exist in this file'));
        }
        return;
      default:
        issues.push(issue('E_KEYCODE_ACTION', 'Unknown keycode action'));
    }
  }

  function check(text, opts) {
    if (typeof text !== 'string') return [issue('E_KEYCODE_TYPE', 'Keycode must be text')];
    var trimmed = text.trim(), out = [], action;
    if (!trimmed) return [issue('E_KEYCODE_EMPTY', 'Enter a keycode name')];
    if (/^(0[xX][0-9a-fA-F]+|[0-9]+)$/.test(trimmed)) {
      return [issue('I_KEYCODE_RAW', 'Numeric keycode is kept as written; the studio cannot preview it', 'info')];
    }
    action = parseCode(trimmed);
    if (!action) return [unknownIssue(trimmed)];
    if (mixedSides(trimmed)) {
      out.push(issue('E_KEYCODE_MODS', 'Mixed left and right modifiers are not one Vial key; pick one side'));
    }
    checkAction(action, opts || {}, out, 0);
    return out;
  }

  // --- public surface ------------------------------------------------------

  function categories() {
    var src = catalogData().categories || [], entries = index().entries, out = [], i, j, c;
    for (i = 0; i < src.length; i++) {
      c = {id: src[i].id, label: src[i].label, ids: []};
      for (j = 0; j < entries.length; j++) {
        if (entries[j].category === c.id) c.ids.push(entries[j].id);
      }
      out.push(c);
    }
    return out;
  }

  function byId(idOrAlias) {
    var entry = lookup(idOrAlias);
    if (entry) return entry;
    if (typeof idOrAlias !== 'string') return null;
    var action = parseCode(idOrAlias);
    if (!action) return null;
    if (action.k === 'macro') {
      return {id: 'M' + action.index, aliases: [], label: 'Macro ' + action.index, category: 'macro'};
    }
    if (action.k === 'tapdance') {
      return {id: 'TD(' + action.index + ')', aliases: [], label: 'Tap dance ' + action.index, category: 'tapdance'};
    }
    if (action.k === 'layer') {
      return {id: action.fn + '(' + action.layer + ')', aliases: [], label: action.fn + ' layer ' + action.layer, category: 'layer'};
    }
    return null;
  }

  // --- character lookup, known forms and macro actions ---------------------

  // Categories whose keys can type a character on at least one level.
  var CHAR_CATEGORIES = {letters: 1, digits: 1, punctuation: 1, keypad: 1};
  var LEVELS = ['plain', 'shift', 'altgr', 'shiftAltgr'];

  // Dead-key display accent -> the combining mark it adds, for NFD composition.
  var ACCENT_MARK = {
    '´': '\u0301', '`': '\u0300', '¨': '\u0308', '˚': '\u030a', '¯': '\u0304',
    '˘': '\u0306', '˝': '\u030b', '^': '\u0302', 'ˇ': '\u030c', '~': '\u0303',
    '¸': '\u0327', '˙': '\u0307'
  };

  var CHAR_OPTIONS = null;

  // The Vial code that types a key at one of the four Estonian levels.
  function levelCode(id, level) {
    if (level === 0) return id;
    var mods = level === 1 ? {shift: true} :
      level === 2 ? {alt: true, right: true} :
      {shift: true, alt: true, right: true};
    return format({k: 'mods', mods: decodeMods(encodeMods(mods)), inner: {k: 'basic', id: id}});
  }

  function buildCharOptions() {
    var map = {}, entries = index().entries, i, level;
    for (i = 0; i < entries.length; i++) {
      var e = entries[i], out, ch, list;
      if (CHAR_CATEGORIES[e.category] !== 1 || typeof e.hid !== 'number') continue;
      out = KS.estonian && KS.estonian.output ? KS.estonian.output(e.hid) : null;
      if (!out) continue;
      for (level = 0; level < 4; level++) {
        ch = out.levels[level];
        if (typeof ch !== 'string' || !ch) continue;
        ch = ch.normalize('NFC');
        list = map[ch] || (map[ch] = []);
        list.push({
          code: levelCode(e.id, level),
          level: LEVELS[level],
          hid: e.hid,
          dead: out.dead[level] === true,
          keypad: e.category === 'keypad'
        });
      }
    }
    return map;
  }

  // Plain < Shift < AltGr < Shift+AltGr, typing keys before the numeric keypad.
  function charOptions(ch) {
    if (!CHAR_OPTIONS) CHAR_OPTIONS = buildCharOptions();
    var list = CHAR_OPTIONS[ch] || [], out = [], i, j;
    for (i = 0; i < LEVELS.length; i++) {
      for (j = 0; j < list.length; j++) if (list[j].level === LEVELS[i] && !list[j].keypad) out.push(list[j]);
      for (j = 0; j < list.length; j++) if (list[j].level === LEVELS[i] && list[j].keypad) out.push(list[j]);
    }
    return out;
  }

  // The first typing key for a character, used as the base of a dead-key sequence.
  function baseOption(ch) {
    var opts = charOptions(ch), i;
    for (i = 0; i < opts.length; i++) if (opts[i].level === 'plain') return opts[i];
    return opts.length ? opts[0] : null;
  }

  function deadCodeFor(mark) {
    var entries = index().entries, i, level;
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (CHAR_CATEGORIES[e.category] !== 1 || typeof e.hid !== 'number') continue;
      var out = KS.estonian && KS.estonian.output ? KS.estonian.output(e.hid) : null;
      if (!out) continue;
      for (level = 0; level < 4; level++) {
        var ch = out.levels[level];
        if (out.dead[level] && ch && ACCENT_MARK[ch] === mark) return levelCode(e.id, level);
      }
    }
    return null;
  }

  // A precomposed character that has no direct key: dead accent, then its base letter.
  function sequenceFor(ch) {
    var parts = ch.normalize('NFD').split(''), base, mark, option, dead;
    if (parts.length !== 2) return null;
    base = parts[0];
    mark = parts[1];
    if (mark.charCodeAt(0) < 0x300 || mark.charCodeAt(0) > 0x36f) return null;
    option = baseOption(base);
    if (!option) return null;
    dead = deadCodeFor(mark);
    if (!dead) return null;
    return [dead, option.code];
  }

  function forCharacter(ch) {
    if (typeof ch !== 'string' || !ch) return {direct: [], sequence: null};
    var direct = charOptions(ch.normalize('NFC'));
    return {direct: direct, sequence: direct.length ? null : sequenceFor(ch)};
  }

  function modKeyFor(bit, right) {
    if (bit === CTRL) return right ? 'KC_RCTRL' : 'KC_LCTRL';
    if (bit === SHIFT) return right ? 'KC_RSHIFT' : 'KC_LSHIFT';
    if (bit === ALT) return right ? 'KC_RALT' : 'KC_LALT';
    return right ? 'KC_RGUI' : 'KC_LGUI';
  }

  function macroActionsFor(action) {
    var inner, bits, right, downs = [], ups = [], order = [CTRL, SHIFT, ALT, GUI], i;
    if (action.k === 'basic' || action.k === 'named') return [['tap', action.id]];
    if (action.k !== 'mods') fail('E_KEYCODE_ARG', 'A macro holds plain keys or one modifier-wrapped key');
    inner = action.inner;
    if (!inner || (inner.k !== 'basic' && inner.k !== 'named')) {
      fail('E_KEYCODE_ARG', 'A macro modifier can only wrap a single key');
    }
    bits = encodeMods(action.mods);
    right = (bits & RIGHT) === RIGHT;
    for (i = 0; i < order.length; i++) {
      if ((bits & order[i]) !== order[i]) continue;
      downs.push(['down', modKeyFor(order[i], right)]);
      ups.unshift(['up', modKeyFor(order[i], right)]);
    }
    return downs.concat([['tap', inner.id]], ups);
  }

  function macroActions(code) {
    var text = typeof code === 'string' ? code.trim() : String(code);
    var action = parseCode(text);
    if (!action) fail('E_KEYCODE_UNKNOWN', 'Unknown keycode "' + text + '"');
    return macroActionsFor(action);
  }

  function knownAction(action) {
    if (!action) return false;
    switch (action.k) {
      case 'none':
      case 'trans':
      case 'layer':
      case 'layermod':
      case 'osm':
      case 'macro':
      case 'tapdance':
        return true;
      case 'basic':
      case 'named':
        return !!lookup(action.id);
      case 'mods':
        return knownAction(action.inner);
      case 'modtap':
        return knownAction(action.tap);
      case 'layertap':
        return knownAction(action.tap);
      default:
        return false;
    }
  }

  function isKnown(cell) {
    if (typeof cell === 'number') return isFinite(cell);
    if (typeof cell !== 'string') return false;
    var text = cell.trim();
    if (!text) return false;
    if (text === '-1') return true;
    return knownAction(parseCode(text));
  }

  KS.keycodes = {
    KeycodeError: KeycodeError,
    parse: parse,
    format: format,
    check: check,
    byId: byId,
    isKnown: isKnown,
    forCharacter: forCharacter,
    macroActions: macroActions,
    modsBits: encodeMods,
    modsFromBits: decodeMods
  };

  // Built lazily on first use so load order between data and core files does not matter.
  Object.defineProperty(KS.keycodes, 'catalog', {
    enumerable: true,
    get: function () { return index().entries; }
  });
  Object.defineProperty(KS.keycodes, 'categories', {
    enumerable: true,
    get: function () { return categories(); }
  });
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
