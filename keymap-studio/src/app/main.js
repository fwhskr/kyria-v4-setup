(function (KS) {
  'use strict';
  const A = KS.app;

  const REQUIRED = [
    ['board', 'src/data/board-kyria.js'], ['DEFAULT_VIL_TEXT', 'src/data/default-vil.js'], ['estonian', 'src/data/estonian.js'],
    ['json', 'src/core/json.js'], ['keycodes', 'src/core/keycodes.js'], ['vil', 'src/core/vil.js'], ['legend', 'src/core/legend.js'],
    ['workspace', 'src/core/workspace.js'], ['history', 'src/core/history.js']
  ];

  function fail(lines) {
    const app = document.getElementById('app');
    if (!app) return;
    app.removeAttribute('aria-busy');
    while (app.firstChild) app.removeChild(app.firstChild);
    const box = document.createElement('div');
    box.className = 'boot-error';
    box.setAttribute('role', 'alert');
    const title = document.createElement('h1');
    title.textContent = 'Kyria Keymap Studio couldn\u2019t start';
    box.append(title);
    for (const line of lines) { const p = document.createElement('p'); p.textContent = line; box.append(p); }
    app.append(box);
  }

  function start() {
    const missing = REQUIRED.filter(([name]) => KS[name] === undefined).map(([, file]) => file);
    if (missing.length) {
      fail(['These files are missing or failed to load: ' + missing.join(', ') + '.',
        'Open index.html from the complete keymap-studio folder; every file must stay next to it.']);
      return;
    }
    try { A.state.boot(); }
    catch (e) {
      console.error(e);
      fail(['The built-in layout couldn\u2019t be loaded' + (e && e.message ? ': ' + e.message : '') + '.', 'Nothing in this browser was changed.']);
      return;
    }
    window.addEventListener('error', e => {
      A.state.setMessage(`Something went wrong: ${e.message || 'unknown error'}. Your keymap is unchanged; export it to keep it safe.`, 'alert');
      A.state.render();
    });
    window.addEventListener('unhandledrejection', e => {
      const reason = e.reason && e.reason.message ? e.reason.message : 'unknown error';
      A.state.setMessage(`Something went wrong: ${reason}. Your keymap is unchanged; export it to keep it safe.`, 'alert');
      A.state.render();
    });
    A.shell.mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
