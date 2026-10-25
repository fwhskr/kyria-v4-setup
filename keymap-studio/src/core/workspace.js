(function (KS) {
  'use strict';
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const clone = v => JSON.parse(JSON.stringify(v));
  const raw = v => v && typeof v === 'object' && own(v,'$raw');
  class OpError extends Error {
    constructor(code,message) { super(message); this.name = 'OpError'; this.code = code; }
  }
  const fail = (code,message) => { throw new OpError(code,message); };
  function index(list,i) {
    if (!Array.isArray(list) || !Number.isInteger(i) || i < 0 || i >= list.length) fail('E_RANGE','Target is absent or out of range');
    if (raw(list[i])) fail('E_READ_ONLY','Unsupported item is read-only');
    return list[i];
  }
  function create(doc,{filename = 'keymap.vil'} = {}) {
    if (KS.vil.validate(doc,KS.board).some(i => i.severity === 'error' && i.code !== 'E_VIAL_REQUIRED')) fail('E_DOCUMENT','Invalid document');
    if (typeof filename !== 'string' || filename.length > 255) fail('E_FILENAME','Invalid filename');
    const names = ['Base','Special','Number','Symbol','Navi','Media','Function','Spare'];
    const palette = ['#70b7ff','#4dd8cc','#83d38a','#ffbd68','#ba9bff','#ffe071','#ff8f9c','#9daabd'];
    return {schema:2,filename,doc:clone(doc),meta:{layerNames:doc.fields.layout.map((_,i) => names[i] || 'Layer ' + i),layerColors:doc.fields.layout.map((_,i) => palette[i % palette.length]),keyLabels:{}}};
  }
  function fromDefault() {
    const result = KS.vil.decode(KS.DEFAULT_VIL_TEXT,KS.board);
    if (!result.ok || result.issues.some(i => i.severity === 'error')) fail('E_DEFAULT','Bundled layout is invalid');
    return create(result.doc,{filename:'kriskyria.vil'});
  }
  function code(value,f,old) {
    if (typeof old === 'number') {
      if (value === old) return value;
      fail('E_READ_ONLY','Imported numeric keycode is read-only');
    }
    if (typeof value === 'string' && value === old) return value;
    if (typeof value !== 'string' || !value.trim() || value.length > 200) fail('E_KEYCODE','Enter a keycode');
    if (/\bKC_NONUS_BACKSLASH\b/.test(value)) fail('E_KEYCODE','Use KC_NONUS_BSLASH');
    if (KS.keycodes) {
      const issues = KS.keycodes.check(value,{layers:f.layout.length,macros:Array.isArray(f.macro) ? f.macro.length : 0,tapDances:Array.isArray(f.tap_dance) ? f.tap_dance.length : 0});
      if (issues.some(i => i.severity === 'error')) fail('E_KEYCODE',issues.find(i => i.severity === 'error').message);
    } else fail('E_DEPENDENCY','Keycode validation is unavailable');
    return value;
  }
  function apply(ws,op) {
    const next = clone(ws);
    function run(o,depth) {
      if (!o || typeof o !== 'object' || depth > 64) fail('E_OP','Invalid operation');
      const f = next.doc.fields;
      if (o.type === 'batch') {
        if (!Array.isArray(o.ops) || o.ops.length > 10000) fail('E_OP','Invalid batch');
        for (const child of o.ops) run(child,depth + 1); return;
      }
      const target = {'key.set':'layout','encoder.set':'encoder_layout','macro.set':'macro','tapDance.set':'tap_dance','combo.set':'combo','keyOverride.set':'key_override','altRepeat.set':'alt_repeat_key','setting.set':'settings','layoutOptions.set':'layout_options','uid.restoreKnown':'uid'}[o.type];
      if (target && next.doc.extra.some(([k]) => k === target)) fail('E_READ_ONLY','Duplicate document fields are read-only');
      switch (o.type) {
        case 'key.set': {
          const row = index(index(f.layout,o.layer),o.row), old = index(row,o.col);
          if (old === -1) fail('E_NO_KEY','No key at this position');
          if (typeof old !== 'string') fail('E_READ_ONLY','Numeric keycode is read-only');
          row[o.col] = code(o.code,f,old); break;
        }
        case 'encoder.set': {
          const pair = index(index(f.encoder_layout,o.layer),o.index), old = index(pair,o.dir);
          if (typeof old !== 'string') fail('E_READ_ONLY','Numeric keycode is read-only');
          pair[o.dir] = code(o.code,f,old); break;
        }
        case 'macro.set': case 'tapDance.set': case 'combo.set': case 'keyOverride.set': case 'altRepeat.set': {
          const section = {'macro.set':'macro','tapDance.set':'tap_dance','combo.set':'combo','keyOverride.set':'key_override','altRepeat.set':'alt_repeat_key'}[o.type];
          const old = index(f[section],o.index);
          const value = o.type === 'macro.set' ? o.actions : o.value;
          let result;
          try { const candidate = clone(next.doc); candidate.fields[section][o.index] = clone(value); result = KS.vil.decode(KS.vil.encode(candidate),KS.board); } catch (_) { fail('E_VALUE','Invalid feature definition'); }
          if (!result.ok || raw(result.doc.fields[section][o.index])) fail('E_VALUE','Unsupported feature definition');
          if (section === 'key_override' && (value.layers > 65535 || ['trigger_mods','negative_mod_mask','suppressed_mods','options'].some(k => value[k] > 255))) fail('E_VALUE','Override bit field is out of range');
          if (section === 'alt_repeat_key' && (value.allowed_mods > 255 || value.options > 15)) fail('E_VALUE','Alt-repeat bit field is out of range');
          if (section === 'tap_dance' && value[4] > 65535) fail('E_VALUE','Tapping term is out of range');
          if (section === 'macro') value.forEach((action,i) => {
            if (['tap','down','up'].includes(action[0])) action.slice(1).forEach((c,j) => code(c,f,old[i]?.[j + 1]));
          });
          else if (section === 'combo' || section === 'tap_dance') value.slice(0,section === 'combo' ? 5 : 4).forEach((c,i) => code(c,f,old[i]));
          else for (const k of (section === 'key_override' ? ['trigger','replacement'] : ['keycode','alt_keycode'])) code(value[k],f,old[k]);
          f[section][o.index] = clone(value); break;
        }
        case 'setting.set': {
          if (!Array.isArray(f.settings)) fail('E_READ_ONLY','Settings are absent or read-only');
          const i = f.settings.findIndex(([id]) => id === o.qsid);
          if (i < 0) fail('E_RANGE','Unknown setting id');
          const fields = KS.QMK_SETTINGS?.tabs?.flatMap(t => t.fields).filter(field => field.qsid === o.qsid) || [];
          if (!fields.length) fail('E_READ_ONLY','Setting is not described by Vial');
          if (o.bit !== undefined) {
            const field = fields.find(field => (field.bit ?? 0) === o.bit && field.type === 'boolean');
            if (!field || ![true,false,0,1].includes(o.value)) fail('E_VALUE','Invalid setting bit');
            const mask = 2 ** o.bit, oldBit = Math.floor(f.settings[i][1] / mask) % 2;
            f.settings[i][1] += ((o.value ? 1 : 0) - oldBit) * mask;
          } else {
            const field = fields[0], max = 2 ** (8 * (field.width || 1)) - 1;
            if (!Number.isSafeInteger(o.value) || o.value < (field.min ?? 0) || o.value > Math.min(max,field.max ?? max) || (fields.length === 1 && field.type === 'boolean' && o.value > 1)) fail('E_VALUE','Setting is outside its supported range');
            f.settings[i][1] = o.value;
          }
          break;
        }
        case 'layoutOptions.set':
          if (!own(f,'layout_options') || raw(f.layout_options)) fail('E_READ_ONLY','Layout options are read-only');
          if (!Number.isSafeInteger(o.value) || o.value < 0 || o.value > 4294967295) fail('E_VALUE','Layout options must be unsigned 32-bit');
          try { if (KS.vil.layoutOptions.encode(KS.vil.layoutOptions.decode(o.value,KS.board.layoutOptionLabels).map(x => x.value),KS.board.layoutOptionLabels) !== o.value) fail('E_VALUE','Unsupported layout option bits'); } catch (_) { fail('E_VALUE','Invalid layout option choice'); }
          f.layout_options = o.value; break;
        case 'uid.restoreKnown':
          if (f.uid !== KS.board.roundedUid) fail('E_UID','Only a rounded Kyria UID can be restored');
          f.uid = KS.board.knownUid; break;
        case 'meta.layerName':
          index(next.meta.layerNames,o.layer);
          if (typeof o.value !== 'string') fail('E_VALUE','Invalid layer name');
          next.meta.layerNames[o.layer] = o.value.trim().slice(0,35) || 'Layer ' + o.layer; break;
        case 'meta.layerColor':
          index(next.meta.layerColors,o.layer);
          if (typeof o.value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(o.value)) fail('E_VALUE','Use a hex colour');
          next.meta.layerColors[o.layer] = o.value.toLowerCase(); break;
        case 'meta.keyLabel': {
          const row = index(index(f.layout,o.layer),o.row); if (index(row,o.col) === -1) fail('E_NO_KEY','No key at this position');
          const id = `${o.layer}:${o.row}:${o.col}`;
          if (o.value === null) delete next.meta.keyLabels[id];
          else { if (typeof o.value !== 'string') fail('E_VALUE','Invalid key label'); next.meta.keyLabels[id] = o.value.slice(0,24); } break;
        }
        default: fail('E_OP','Unknown operation');
      }
    }
    run(op,0); return next;
  }
  function restore(json) {
    const bad = message => ({ok:false,issues:[{severity:'error',code:'E_STORAGE',path:'',message}]});
    try {
      if (typeof json !== 'string' || json.length > 4000000) return bad('Invalid saved workspace size');
      KS.json.parse(json,{maxDepth:256});
      const ws = JSON.parse(json);
      if (!ws || ws.schema !== 2 || typeof ws.filename !== 'string' || ws.filename.length > 255 || !ws.doc || !ws.meta) return bad('Invalid saved workspace');
      const text = KS.vil.encode(ws.doc), result = KS.vil.decode(text,KS.board);
      if (!result.ok) return {ok:false,issues:result.issues};
      // Reject forged fields/raw wrappers instead of silently changing the stored document.
      if (JSON.stringify(ws.doc) !== JSON.stringify(result.doc)) return bad('Saved document is not canonical');
      const m = ws.meta, n = result.doc.fields.layout.length;
      if (!Array.isArray(m.layerNames) || m.layerNames.length !== n || m.layerNames.some(x => typeof x !== 'string' || x.length > 35 || x !== x.trim()) || !Array.isArray(m.layerColors) || m.layerColors.length !== n || m.layerColors.some(x => typeof x !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(x)) || !m.keyLabels || Array.isArray(m.keyLabels) || typeof m.keyLabels !== 'object') return bad('Invalid saved layer metadata');
      for (const [id,label] of Object.entries(m.keyLabels)) {
        if (!/^(0|[1-9][0-9]*):(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/.test(id) || typeof label !== 'string' || label.length > 24) return bad('Invalid saved key label');
        const [l,r,c] = id.split(':').map(Number), v = result.doc.fields.layout[l]?.[r]?.[c];
        if (v === undefined || v === -1) return bad('Saved key label has no key');
      }
      return {ok:true,ws:{schema:2,filename:ws.filename,doc:result.doc,meta:clone(m)},issues:result.issues};
    } catch (_) { return bad('Saved workspace is corrupt'); }
  }
  KS.workspace = {create,fromDefault,apply,restore,OpError};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
