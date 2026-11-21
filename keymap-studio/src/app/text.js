(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  A.text = {
    appName: 'Kyria Keymap Studio',
    views: [
      {id: 'keymap', label: 'Keymap'},
      {id: 'macros', label: 'Macros'},
      {id: 'tapdance', label: 'Tap dance'},
      {id: 'combos', label: 'Combos'},
      {id: 'overrides', label: 'Key overrides'},
      {id: 'altrepeat', label: 'Alt repeat'},
      {id: 'settings', label: 'Settings'},
      {id: 'sheet', label: 'Reference image'}
    ],
    levels: [
      {id: 0, label: 'Plain', mods: null},
      {id: 1, label: 'Shift', mods: {shift: true}},
      {id: 2, label: 'AltGr', mods: {alt: true, right: true}},
      {id: 3, label: 'Shift + AltGr', mods: {shift: true, alt: true, right: true}}
    ],
    plural,
    issues: n => plural(n, 'issue', 'issues'),
    savedTo: path => `Saved to ${path}`,
    loadedFrom: path => `Loaded from ${path}`,
    savingTo: path => `Saving to ${path}\u2026`,
    saveFailed: 'Not saved',
    memoryOnly: 'Not saved: memory only',
    serverUrl: 'http://127.0.0.1:8737/',
    // Where the keymap being edited lives, for dialogs that replace it.
    keymapHere: path => path || 'the keymap open in this tab',
    saveError: (path, error) => `Not saved: writing ${path} failed (${error}). Your edits are kept in this tab and are saved with the next change, or try again now.`,
    loadError: error => `Not saved: layouts/kyria.vil couldn\u2019t be loaded (${error}). The built-in layout is shown and edits stay in this tab only. Check that \u201cmake studio\u201d is running, then reload.`,
    noTarget: 'Select a key on the board, or a slot in an editor, before choosing a character.',
    tooLarge: 'Choose a .vil file under 2 MB.',
    importFailed: (name, msg) => `Couldn\u2019t open ${name}: ${msg} Nothing was changed.`,
    exportBlocked: n => `Fix ${plural(n, 'error', 'errors')} before exporting. The issues list shows where.`,
    unsafeText: 'Firmware text macros send US-ASCII only: letters, digits, punctuation, space, tab, newline, Backspace and Escape. Add \u00f5, \u00e4, \u00f6, \u00fc, \u0161, \u017e and other Estonian characters with \u201cCharacter or key\u201d, which adds them as key taps.',
    limits: [
      'This studio edits .vil files offline. It never connects to, reads from or sends anything to a keyboard.',
      'Everything it knows about the keyboard comes from the opened file and the Kyria rev4 definition shipped with it.',
      'When you load the exported file in Vial (File \u2192 Load saved layout), Vial loads any keycode it doesn\u2019t know as KC_NO and drops macros, tap dances, combos and overrides beyond what the keyboard supports.',
      'Macro memory size is not stored in .vil files. Vial refuses macros that don\u2019t fit when you load the file.',
      'Key legends show what an Estonian (xkb \u201cee\u201d, with dead keys) computer types. Other computer layouts type different characters.'
    ]
  };
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
