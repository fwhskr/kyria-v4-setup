(function (KS) {
  'use strict';
  function create(ws,{limit = 200} = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new RangeError('History limit must be 1–10000');
    return {past:[],present:ws,future:[],limit};
  }
  const canUndo = h => h.past.length > 0;
  const canRedo = h => h.future.length > 0;
  function commit(h,op) {
    const present = KS.workspace.apply(h.present,op);
    return {past:[...h.past,h.present].slice(-h.limit),present,future:[],limit:h.limit};
  }
  function undo(h) {
    return canUndo(h) ? {past:h.past.slice(0,-1),present:h.past[h.past.length - 1],future:[h.present,...h.future],limit:h.limit} : h;
  }
  function redo(h) {
    return canRedo(h) ? {past:[...h.past,h.present].slice(-h.limit),present:h.future[0],future:h.future.slice(1),limit:h.limit} : h;
  }
  KS.history = {create,commit,undo,redo,canUndo,canRedo};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
