(function (KS) {
  'use strict';
  const known = ['version','uid','layout','encoder_layout','layout_options','macro','vial_protocol','via_protocol','tap_dance','combo','key_override','alt_repeat_key','settings'];
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const raw = v => v && typeof v === 'object' && own(v, '$raw');
  const issue = (severity,code,path,message) => ({severity,code,path,message});
  const integer = n => { const v = KS.json.int(n); if (String(v) !== n.raw) throw Error('Noncanonical integer'); return v; };
  function plain(n) {
    if (n.t === 's') return n.v;
    if (n.t === 'n') return integer(n);
    if (n.t === 'a') return n.v.map(plain);
    if (n.t === 'o') {
      const o = Object.create(null);
      for (const [k,v] of n.e) { if (own(o,k)) throw Error('Duplicate key'); o[k] = plain(v); }
      return o;
    }
    throw Error('Unsupported value');
  }
  const cell = v => typeof v === 'string' || Number.isSafeInteger(v);
  const uint = v => Number.isSafeInteger(v) && v >= 0;
  const uid = v => typeof v === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(v) && (v.length < 20 || v <= '18446744073709551615');
  function itemOK(section,v) {
    if (section === 'macro') return Array.isArray(v) && v.every(a => Array.isArray(a) && (
      (a[0] === 'text' && a.length === 2 && typeof a[1] === 'string') ||
      (a[0] === 'delay' && a.length === 2 && uint(a[1])) ||
      (['tap','down','up'].includes(a[0]) && a.length >= 2 && a.slice(1).every(cell))));
    if (section === 'tap_dance') return Array.isArray(v) && v.length === 5 && v.slice(0,4).every(cell) && uint(v[4]);
    if (section === 'combo') return Array.isArray(v) && v.length === 5 && v.every(cell);
    const keys = section === 'key_override' ? ['trigger','replacement','layers','trigger_mods','negative_mod_mask','suppressed_mods','options'] : ['keycode','alt_keycode','allowed_mods','options'];
    return v && !Array.isArray(v) && typeof v === 'object' && Object.keys(v).join('|') === keys.join('|') && keys.every((k,i) => i < 2 ? cell(v[k]) : uint(v[k]));
  }
  function section(n,k,issues) {
    const preserve = (node,path,code) => { issues.push(issue('warning',code,path,'Unsupported data kept read-only')); return {$raw:node}; };
    try {
      if (k === 'layout' || k === 'encoder_layout') {
        const matrix = (node,depth,path) => {
          if (depth > 0) { if (node.t !== 'a') throw Error(); return node.v.map((v,i) => matrix(v,depth - 1,`${path}[${i}]`)); }
          try { const v = plain(node); if (!cell(v)) throw Error(); return v; } catch (_) { return preserve(node,path,'W_RAW_ITEM'); }
        };
        return matrix(n,3,k);
      }
      if (['macro','tap_dance','combo','key_override','alt_repeat_key'].includes(k)) {
        if (n.t !== 'a') throw Error();
        return n.v.map((node,i) => { try { const v = plain(node); if (!itemOK(k,v)) throw Error(); return v; } catch (_) { return preserve(node,`${k}[${i}]`,'W_RAW_ITEM'); } });
      }
      if (k === 'settings') {
        if (n.t !== 'o') throw Error(); const seen = new Set();
        return n.e.map(([id,v]) => { if (!/^(0|[1-9][0-9]*)$/.test(id) || !Number.isSafeInteger(+id) || seen.has(id)) throw Error(); seen.add(id); const x = integer(v); if (!uint(x)) throw Error(); return [+id,x]; });
      }
      if (k === 'uid') { if (n.t !== 'n' || !uid(n.raw)) throw Error(); return n.raw; }
      const v = plain(n);
      if (['version','vial_protocol','via_protocol','layout_options'].includes(k) && !uint(v)) throw Error();
      return v;
    } catch (_) { return preserve(n,k,'W_RAW_SECTION'); }
  }
  function toNode(v) {
    if (raw(v)) return v.$raw;
    if (Array.isArray(v)) return {t:'a',v:v.map(toNode)};
    if (typeof v === 'string') return {t:'s',v};
    if (typeof v === 'number' && Number.isSafeInteger(v)) return {t:'n',raw:String(v)};
    if (v && typeof v === 'object') return {t:'o',e:Object.keys(v).map(k => [k,toNode(v[k])])};
    throw Error('Invalid document value');
  }
  function encode(doc) {
    const emitted = new Set(), used = new Set(), entries = [];
    for (const k of doc.order) {
      if (own(doc.fields,k) && !emitted.has(k)) {
        const v = doc.fields[k]; emitted.add(k);
        entries.push([k,k === 'uid' && !raw(v) ? {t:'n',raw:v} : k === 'settings' && !raw(v) ? {t:'o',e:v.map(([id,x]) => [String(id),toNode(x)])} : toNode(v)]);
      } else {
        const i = doc.extra.findIndex(([name],i) => name === k && !used.has(i));
        if (i < 0) throw Error('Invalid document order'); used.add(i); entries.push(doc.extra[i]);
      }
    }
    if (emitted.size !== Object.keys(doc.fields).length || used.size !== doc.extra.length) throw Error('Incomplete document order');
    return KS.json.stringify({t:'o',e:entries});
  }
  function validate(doc, board) {
    if (!doc || !doc.fields || typeof doc.fields !== 'object' || !Array.isArray(doc.order) || !Array.isArray(doc.extra) || !board?.matrix) return [issue('error','E_DOCUMENT','','Invalid document or board profile')];
    const issues = [], f = doc.fields;
    for (const k of ['layout','encoder_layout','layout_options']) if (!own(f,k)) issues.push(issue('error','E_VIAL_REQUIRED',k,'Required Vial field is missing'));
    if (!uid(f.uid)) issues.push(issue('error','E_UID','uid','Invalid unsigned 64-bit UID'));
    else if (f.uid !== board.knownUid) issues.push(issue('warning',f.uid === board.roundedUid ? 'W_UID_ROUNDED' : 'W_UID_OTHER','uid',f.uid === board.roundedUid ? 'UID was rounded; explicit restoration is available' : 'UID differs from the known Kyria'));
    const layout = f.layout;
    if (!Array.isArray(layout) || layout.length < 1 || layout.length > 32) issues.push(issue('error','E_LAYOUT','layout','Expected 1–32 layout layers'));
    else {
      const validRow = r => Array.isArray(r) && r.length === board.matrix.cols && r.every(v => cell(v) || (raw(v) && v.$raw.t === 'n'));
      if (layout.some(l => !Array.isArray(l) || l.length !== board.matrix.rows || !l.every(validRow))) issues.push(issue('error','E_MATRIX','layout','Expected the Kyria matrix'));
    }
    if (own(f,'encoder_layout') && !raw(f.encoder_layout) && (!Array.isArray(f.encoder_layout) || !Array.isArray(layout) || f.encoder_layout.length !== layout.length || f.encoder_layout.some(l => !Array.isArray(l) || l.length !== f.encoder_layout[0].length || l.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(v => cell(v) || raw(v)))))) issues.push(issue('error','E_ENCODER','encoder_layout','Invalid per-layer encoder pairs'));
    if (own(f,'layout_options') && !raw(f.layout_options) && !uint(f.layout_options)) issues.push(issue('error','E_LAYOUT_OPTIONS','layout_options','Invalid layout options'));
    if (KS.keycodes && KS.keycodes.isKnown) {
      const visit = (v,path) => {
        if (raw(v)) return;
        if (typeof v === 'string' && !KS.keycodes.isKnown(v)) issues.push(issue('warning','W_UNKNOWN_KEYCODE',path,'Vial will load this as KC_NO'));
        else if (Array.isArray(v)) v.forEach((x,i) => visit(x,`${path}[${i}]`));
      };
      for (const k of ['layout','encoder_layout','tap_dance','combo']) visit(f[k],k);
      for (const k of ['key_override','alt_repeat_key']) if (Array.isArray(f[k])) f[k].forEach((v,i) => { if (!raw(v)) for (const field of (k === 'key_override' ? ['trigger','replacement'] : ['keycode','alt_keycode'])) visit(v[field],`${k}[${i}].${field}`); });
    }
    return issues;
  }
  function decode(text, board) {
    if (typeof text !== 'string') return {ok:false,issues:[issue('error','E_JSON','','Expected text')]};
    if (text.length > 2000000) return {ok:false,issues:[issue('error','E_TOO_LARGE','','File exceeds 2 MB')]};
    try {
      const root = KS.json.parse(text), issues = [];
      if (root.t !== 'o') return {ok:false,issues:[issue('error','E_DOCUMENT','','Expected Vial object')]};
      const doc = {order:[],fields:Object.create(null),extra:[]};
      for (const [k,n] of root.e) {
        doc.order.push(k);
        if (known.includes(k) && !own(doc.fields,k)) doc.fields[k] = section(n,k,issues);
        else { doc.extra.push([k,n]); issues.push(issue('info','I_UNKNOWN_FIELD',k,'Additional field preserved verbatim')); }
      }
      if (KS.json.stringify(root) !== text) issues.push(issue('warning','W_REFORMATTED','','JSON spacing normalized to Vial format'));
      issues.push(...validate(doc,board));
      return issues.some(i => i.severity === 'error' && i.code !== 'E_VIAL_REQUIRED') || !own(doc.fields,'layout') ? {ok:false,issues} : {ok:true,doc,issues};
    } catch (e) { return {ok:false,issues:[issue('error','E_JSON','',e instanceof KS.json.JsonError ? `${e.message} at ${e.line}:${e.column}` : 'Invalid Vial document')]}; }
  }
  function capabilities(doc) {
    const f = doc.fields, count = k => Array.isArray(f[k]) ? f[k].length : 0, editable = {};
    for (const k of known) editable[k] = own(f,k) && !raw(f[k]);
    return {source:'file',layers:count('layout'),matrix:{rows:f.layout.length ? f.layout[0].length : 0,cols:f.layout.length && f.layout[0].length ? f.layout[0][0].length : 0},encoders:count('encoder_layout') ? f.encoder_layout[0].length : 0,macros:count('macro'),macroBytes:null,tapDance:count('tap_dance'),combos:count('combo'),keyOverrides:count('key_override'),altRepeat:count('alt_repeat_key'),settingQsids:Array.isArray(f.settings) ? f.settings.map(x => x[0]) : [],layoutOptions:uint(f.layout_options),vialRequiredMissing:['layout','encoder_layout','layout_options'].filter(k => !own(f,k)),editable};
  }
  function optionSpecs(labels) {
    return labels.map(label => typeof label === 'string' ? {label,kind:'bool',bits:1} : {label:label[0],kind:'select',choices:label.slice(1),bits:Math.ceil(Math.log2(label.length - 1))});
  }
  const layoutOptions = {
    decode(value,labels) {
      if (!uint(value) || value > 4294967295) { const e = new RangeError('Invalid layout options'); e.code = 'E_RANGE'; throw e; }
      const specs = optionSpecs(labels); let offset = specs.reduce((sum,s) => sum + s.bits,0);
      return specs.map(s => { offset -= s.bits; const v = Math.floor(value / 2 ** offset) % 2 ** s.bits; const result = {label:s.label,kind:s.kind,value:v}; if (s.choices) result.choices = s.choices; return result; });
    },
    encode(values,labels) {
      const specs = optionSpecs(labels);
      if (!Array.isArray(values) || values.length !== specs.length) { const e = new RangeError('Invalid option count'); e.code = 'E_RANGE'; throw e; }
      return specs.reduce((value,s,i) => {
        if (!Number.isInteger(values[i]) || values[i] < 0 || values[i] >= (s.choices ? s.choices.length : 2)) { const e = new RangeError('Option choice out of range'); e.code = 'E_RANGE'; throw e; }
        return value * 2 ** s.bits + values[i];
      },0);
    }
  };
  KS.vil = {decode,encode,validate,capabilities,layoutOptions};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
