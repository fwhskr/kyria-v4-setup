(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'indeterminate', 'open']);

  function apply(el, attrs) {
    if (!attrs) return el;
    for (const name of Object.keys(attrs)) {
      const v = attrs[name];
      if (v === undefined || v === null || v === false) continue;
      if (name === 'text') el.textContent = String(v);
      else if (name === 'on') for (const ev of Object.keys(v)) el.addEventListener(ev, v[ev]);
      else if (name === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
      else if (name === 'style') for (const p of Object.keys(v)) el.style.setProperty(p, v[p]);
      else if (PROPS.has(name)) el[name] = v;
      else el.setAttribute(name, v === true ? '' : String(v));
    }
    return el;
  }

  function add(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const h = (tag, attrs, ...children) => add(apply(document.createElement(tag), attrs), children);
  const s = (tag, attrs, ...children) => add(apply(document.createElementNS(SVG_NS, tag), attrs), children);

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  let uid = 0;
  const id = prefix => `${prefix}-${++uid}`;

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = h('a', {href: url, download: name, hidden: true});
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function slug(text) {
    const s2 = String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s2 || 'layer';
  }

  /* Native <dialog> with a list of actions; resolves with the chosen value or null. */
  function choose({title, body, actions, danger}) {
    return new Promise(resolve => {
      const returnFocus = document.activeElement;
      const dlg = h('dialog', {class: 'dialog', 'aria-labelledby': id('dlg-title')});
      const titleId = dlg.getAttribute('aria-labelledby');
      const buttons = actions.map((a, i) => h('button', {
        type: 'button', class: ['button', a.primary && (danger ? 'button-danger' : 'button-primary')],
        text: a.label, on: {click: () => close(a.value)}, autofocus: i === actions.length - 1 ? true : undefined
      }));
      dlg.append(h('h2', {id: titleId, class: 'dialog-title', text: title}),
        ...[].concat(body || []).map(p => (p instanceof Node ? p : h('p', {class: 'dialog-text', text: p}))),
        h('div', {class: 'dialog-actions'}, buttons));
      let done = false;
      function close(value) {
        if (done) return; done = true;
        dlg.close(); dlg.remove();
        if (returnFocus && returnFocus.isConnected) returnFocus.focus();
        resolve(value);
      }
      dlg.addEventListener('cancel', e => { e.preventDefault(); close(null); });
      document.body.append(dlg);
      dlg.showModal();
    });
  }

  A.dom = {h, s, clear, id, download, slug, choose, SVG_NS};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
