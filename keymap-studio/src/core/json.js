(function (KS) {
  'use strict';
  class JsonError extends Error {
    constructor(message, text, offset) {
      super(message); this.name = 'JsonError'; this.offset = offset;
      const lines = text.slice(0, offset).split('\n');
      this.line = lines.length; this.column = lines[lines.length - 1].length + 1;
    }
  }
  function parse(text, {maxDepth = 64} = {}) {
    if (typeof text !== 'string') throw new JsonError('Expected JSON text', '', 0);
    if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 512) throw new JsonError('Invalid maximum depth', text, 0);
    let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    const fail = message => { throw new JsonError(message, text, i); };
    const ws = () => { while (/[\x20\t\r\n]/.test(text[i] || '\0')) i++; };
    function string() {
      const start = i++;
      while (i < text.length) {
        const c = text[i++];
        if (c === '"') {
          try { return JSON.parse(text.slice(start, i)); } catch (_) { fail('Invalid string escape'); }
        }
        if (c.charCodeAt(0) < 32) fail('Control character in string');
        if (c === '\\') {
          if (text[i] === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) fail('Invalid Unicode escape'); i += 5; }
          else if ('"\\/bfnrt'.includes(text[i] || '\0')) i++;
          else fail('Invalid string escape');
        }
      }
      fail('Unterminated string');
    }
    function value(depth) {
      ws(); if (depth > maxDepth) fail('Maximum JSON depth exceeded');
      const c = text[i];
      if (c === '"') return {t:'s', v:string()};
      if (c === '{' || c === '[') {
        i++; ws(); const object = c === '{', end = object ? '}' : ']', items = [];
        if (text[i] === end) { i++; return object ? {t:'o', e:items} : {t:'a', v:items}; }
        for (;;) {
          ws(); let key;
          if (object) { if (text[i] !== '"') fail('Expected object key'); key = string(); ws(); if (text[i++] !== ':') fail('Expected colon'); }
          const child = value(depth + 1); items.push(object ? [key, child] : child); ws();
          if (text[i] === end) { i++; break; }
          if (text[i++] !== ',') fail('Expected comma');
        }
        return object ? {t:'o', e:items} : {t:'a', v:items};
      }
      for (const [word, node] of [['true',{t:'b',v:true}],['false',{t:'b',v:false}],['null',{t:'z'}]]) {
        if (text.slice(i, i + word.length) === word) { i += word.length; return node; }
      }
      const m = text.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
      if (!m) fail('Expected JSON value'); i += m[0].length; return {t:'n',raw:m[0]};
    }
    const node = value(0); ws(); if (i !== text.length) fail('Unexpected trailing input'); return node;
  }
  function quote(s) {
    return JSON.stringify(s).replace(/[\x7f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  }
  function stringify(node) {
    function write(n, depth) {
      if (!n || depth > 64) throw new Error('Invalid JSON node');
      switch (n.t) {
        case 'o': return '{' + n.e.map(([k,v]) => quote(k) + ': ' + write(v, depth + 1)).join(', ') + '}';
        case 'a': return '[' + n.v.map(v => write(v, depth + 1)).join(', ') + ']';
        case 's': if (typeof n.v === 'string') return quote(n.v); break;
        case 'n': if (typeof n.raw === 'string' && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(n.raw)) return n.raw; break;
        case 'b': if (typeof n.v === 'boolean') return String(n.v); break;
        case 'z': return 'null';
      }
      throw new Error('Invalid JSON node');
    }
    return write(node, 0);
  }
  function int(node) {
    if (!node || node.t !== 'n' || !/^-?(0|[1-9][0-9]*)$/.test(node.raw) || !Number.isSafeInteger(Number(node.raw))) throw new Error('Expected safe integer');
    return Number(node.raw);
  }
  KS.json = {parse, stringify, int, JsonError};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
