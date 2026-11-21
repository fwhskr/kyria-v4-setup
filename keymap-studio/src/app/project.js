/*
 * Project storage: the keymap lives in layouts/kyria.vil (plus layouts/kyria.studio.json for layer
 * names, colours and key labels), read and written through the local studio server's /api/layout.
 * The browser keeps no copy. Pure parts (payload mapping, the saver) take their dependencies as
 * arguments so the tests can drive them without a browser or a server.
 */
(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const API = '/api/layout';
  const DEFAULT_PATH = 'layouts/kyria.vil';
  const DEFAULT_FILENAME = 'kyria.vil';
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const KEY_ID = /^(0|[1-9][0-9]*):(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/;

  function projectError(message) { const e = new Error(message); e.code = 'E_PROJECT'; return e; }

  /* ---------- workspace -> PUT body ---------- */
  function payload(ws) {
    return {
      vil: KS.vil.encode(ws.doc),
      meta: {
        schema: 1,
        filename: ws.filename,
        layerNames: ws.meta.layerNames.slice(),
        layerColors: ws.meta.layerColors.slice(),
        keyLabels: Object.assign({}, ws.meta.keyLabels)
      }
    };
  }

  /* ---------- GET body -> workspace ---------- */
  // Each metadata part is used only when it fits the decoded layout; otherwise the defaults from
  // KS.workspace.create stay and a warning says which part was ignored.
  function applyMeta(ws, meta) {
    const notes = [];
    if (meta === null || meta === undefined) return notes;
    const warn = message => notes.push({severity: 'warning', code: 'W_STUDIO_META', path: '', message});
    if (!isObject(meta)) { warn('layouts/kyria.studio.json isn\u2019t an object; default layer names, colours and labels are used'); return notes; }
    const layout = ws.doc.fields.layout, n = layout.length;
    if (own(meta, 'layerNames')) {
      const v = meta.layerNames;
      if (Array.isArray(v) && v.length === n && v.every(x => typeof x === 'string' && x.trim() && x.trim().length <= 35)) ws.meta.layerNames = v.map(x => x.trim());
      else warn(`Layer names in layouts/kyria.studio.json don\u2019t fit the ${n} layers; the default names are used`);
    }
    if (own(meta, 'layerColors')) {
      const v = meta.layerColors;
      if (Array.isArray(v) && v.length === n && v.every(x => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x))) ws.meta.layerColors = v.map(x => x.toLowerCase());
      else warn(`Layer colours in layouts/kyria.studio.json don\u2019t fit the ${n} layers; the default colours are used`);
    }
    if (own(meta, 'keyLabels')) {
      const v = meta.keyLabels;
      if (!isObject(v)) warn('Key labels in layouts/kyria.studio.json aren\u2019t readable; automatic labels are used');
      else {
        const kept = {};
        let dropped = 0;
        for (const [id, label] of Object.entries(v)) {
          const m = KEY_ID.exec(id);
          const code = m ? layout[Number(m[1])]?.[Number(m[2])]?.[Number(m[3])] : undefined;
          if (m && code !== undefined && code !== -1 && typeof label === 'string' && label.length && label.length <= 24) kept[id] = label;
          else dropped++;
        }
        ws.meta.keyLabels = kept;
        if (dropped) warn(`${dropped} key ${dropped === 1 ? 'label' : 'labels'} in layouts/kyria.studio.json didn\u2019t match a key and ${dropped === 1 ? 'was' : 'were'} left out`);
      }
    }
    return notes;
  }

  function workspaceFrom(body) {
    if (!isObject(body) || typeof body.vil !== 'string') throw projectError('the server answered without a keymap');
    const result = KS.vil.decode(body.vil, KS.board);
    if (!result.ok) {
      const err = (result.issues || []).find(i => i.severity === 'error') || (result.issues || [])[0];
      throw projectError(`layouts/kyria.vil isn\u2019t a Vial layout the studio can open${err ? ': ' + err.message.replace(/\.$/, '') : ''}`);
    }
    const meta = isObject(body.meta) ? body.meta : null;
    const filename = meta && typeof meta.filename === 'string' && meta.filename && meta.filename.length <= 255 ? meta.filename : DEFAULT_FILENAME;
    let ws;
    try { ws = KS.workspace.create(result.doc, {filename}); }
    catch (e) { throw projectError(`layouts/kyria.vil can\u2019t be edited: ${e.message}`); }
    const notes = applyMeta(ws, body.meta);
    return {ws, issues: (result.issues || []).concat(notes), path: typeof body.path === 'string' && body.path ? body.path : DEFAULT_PATH};
  }

  async function readError(res) {
    let detail = '';
    try { const j = await res.json(); if (j && typeof j.error === 'string') detail = j.error; } catch (_) { /* body is not JSON */ }
    return `${detail ? detail.replace(/\.$/, '') : 'the server answered ' + res.status}`;
  }
  const networkError = e => `the studio server didn\u2019t answer${e && e.message ? ' (' + e.message.replace(/\.$/, '') + ')' : ''}`;

  async function load({fetch: fetchFn, url = API} = {}) {
    let res;
    try { res = await fetchFn(url, {method: 'GET', cache: 'no-store', headers: {Accept: 'application/json'}}); }
    catch (e) { throw projectError(networkError(e)); }
    if (!res.ok) throw projectError(await readError(res));
    let body;
    try { body = await res.json(); } catch (_) { throw projectError('the server\u2019s answer wasn\u2019t JSON'); }
    return workspaceFrom(body);
  }

  /*
   * Debounced saver. Only the newest payload is ever sent (last write wins); one request is in
   * flight at a time so answers can't arrive out of order. A failed payload is kept and goes out
   * again with retry() or is replaced by the next change. onState gets
   * {state: 'saving'} | {state: 'saved', path} | {state: 'error', error}.
   */
  function createSaver({fetch: fetchFn, url = API, delay = 300, onState = () => {},
    setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = t => clearTimeout(t)} = {}) {
    let pending = null, timer = null, inFlight = null;

    async function put(body, keepalive) {
      const init = {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store'};
      let res;
      try { res = await fetchFn(url, keepalive ? Object.assign({keepalive: true}, init) : init); }
      catch (e) {
        // Browsers refuse keepalive bodies above 64 KiB; a plain request may still get through.
        if (keepalive) return put(body, false);
        return {ok: false, error: networkError(e)};
      }
      if (!res.ok) return {ok: false, error: await readError(res)};
      let path = DEFAULT_PATH;
      try { const j = await res.json(); if (j && typeof j.path === 'string' && j.path) path = j.path; } catch (_) { /* ok without a body */ }
      return {ok: true, path};
    }

    function send() {
      const body = pending;
      pending = null;
      inFlight = put(body, false).then(result => {
        inFlight = null;
        if (pending) { if (timer === null) send(); return result; }
        if (result.ok) onState({state: 'saved', path: result.path});
        else { pending = body; onState({state: 'error', error: result.error}); }
        return result;
      });
      return inFlight;
    }

    function fire() {
      timer = null;
      if (pending && !inFlight) send();
    }

    function schedule(body) {
      pending = body;
      if (timer !== null) clearTimer(timer);
      timer = setTimer(fire, delay);
      onState({state: 'saving'});
    }

    // Sends what is waiting now. keepalive is for pagehide: the request outlives the page, so it
    // goes out at once even while an earlier one is still running.
    function flush({keepalive = false} = {}) {
      if (timer !== null) { clearTimer(timer); timer = null; }
      if (!pending) return inFlight || Promise.resolve(null);
      if (keepalive) { const body = pending; pending = null; return put(body, true); }
      if (inFlight) return inFlight.then(() => flush());
      return send();
    }

    return {schedule, flush, retry: () => flush(), hasPending: () => pending !== null || timer !== null || inFlight !== null};
  }

  A.project = {API, DEFAULT_PATH, payload, applyMeta, workspaceFrom, load, createSaver};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
