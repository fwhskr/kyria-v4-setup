# Keymap Studio LLA

Status: **READY** (amended 2026-10-25 after Vial research; first draft PROVISIONAL at `a5f1437`).
- Parent: [`architecture.md`](../../architecture.md).
- Canonical brief: `/home/kris/projects/kyria/docs/product/brief.md` (`main` `d585697`).
- Compatibility baseline: vial-gui `main` `aef8222a2d0429a183b2ed692d5f9efcfd383f08` (HLA §19).
- APIs and shapes from the first draft are kept. This amendment adds rules, data tables, `keycodes.forCharacter`, `keycodes.isKnown` and `vil.layoutOptions`.

## 1. Parent alignment

This LLA specializes the HLA with no deviation.
- GOAL-0 sets priority: character-first assignment (UI-4, API-KC `forCharacter`) and the learning PNG (UI-6) come before the feature editors.
- The original `/home/kris/Documents/kyria-keymap-studio.html` is read-only reference. The studio reuses only:
  - its geometry (line 9);
  - its palette and layer names (line 11);
  - its embedded default, which equals `kriskyria.vil`.

## 2. Directory layout and loading

```
keymap-studio/
  index.html                  app shell; <script src> tags in the fixed order below; no inline app logic
  DESIGN.md                   artist: visual system, UI-* state grid
  README.md                   artist: browser usage, scope and compatibility limits (CONSTRAINT-6)
  styles/studio.css
  src/data/board-kyria.js     BoardProfile (L1)
  src/data/default-vil.js     KS.DEFAULT_VIL_TEXT = exact text of kriskyria.vil (L1)
  src/data/qmk-settings.js    KS.QMK_SETTINGS = verbatim port of Vial qmk_settings.json @aef8222a (L1)
  src/data/estonian.js        Estonian output table (L2)
  src/data/keycode-catalog.js port of Vial keycodes.py @aef8222a (L2)
  src/core/json.js            API-JSON (L1)
  src/core/vil.js             API-VIL (L1)
  src/core/workspace.js       API-WS ops (L1)
  src/core/history.js         API-WS history (L1)
  src/core/keycodes.js        API-KC (L2)
  src/core/legend.js          API-LEG (L2)
  src/app/*.js                L3; main.js last
  tests/*.test.js, tests/load-core.js, tests/fixtures/   (L4)
```

Rules (ADR-S1):
- Each file is `(function (KS) { 'use strict'; … })(globalThis.KyriaStudio = globalThis.KyriaStudio || {});`.
  - No `import`/`export` and no `type="module"`.
  - No top-level calls into other files.
  - `src/app/main.js` loads last and starts on `DOMContentLoaded`.
- Script order: `src/data/*`, `src/core/json.js`, `keycodes.js`, `vil.js`, `legend.js`, `workspace.js`, `history.js`, then `src/app/*`, with `main.js` last.
- Core and data files never touch `document`, `localStorage`, `fetch`, `Date.now` or `Math.random`. They must `require()` in Node; `tests/load-core.js` loads them all.
- No network of any kind: no `fetch`, XHR, remote URL, CDN, web font or `default.json` fallback.

## 3. Lanes, file ownership and dependencies

| Lane | Agent | Owns (exclusive) | Depends on |
| --- | --- | --- | --- |
| L1 core-codec | engineer or general | `src/core/json.js`, `vil.js`, `workspace.js`, `history.js`; `src/data/board-kyria.js`, `default-vil.js`, `qmk-settings.js` | none |
| L2 core-keys | general | `src/core/keycodes.js`, `legend.js`; `src/data/estonian.js`, `keycode-catalog.js` | SCHEMA-DOC/SCHEMA-WS shapes (fixed here) |
| L3 app | artist | `index.html`, `DESIGN.md`, `README.md`, `styles/**`, `src/app/**`, and the Keymap Studio row/section in root `/README.md` | APIs; integrates when L1 and L2 land |
| L4 tests | general or small | `tests/**`, plus one `studio-test` target in `/Makefile`: `node --test 'keymap-studio/tests/*.test.js'` (the directory form fails on Node 22) | contracts only |

- Paths are relative to `keymap-studio/` unless they start with `/`.
- No lane edits another lane's files. Implementers never edit tests to pass, and L4 never edits code. Disputes go to architect.
- Untouchable: `/home/kris/Documents/*`, `host/layer-names.txt`, firmware, tools, backups, CI and the Backlog board.
- Fixture: `tests/fixtures/kriskyria.vil` is a byte-exact copy of `/home/kris/Documents/kriskyria.vil` (sha256 `2187ec80…2899`).
- Tests read `backups/kyriav4current.vil` and `firmware/keyboards/splitkb/halcyon/kyria/keymaps/keypress_hlc/layout_tables.h` and `vial.json` in place.

## 4. Module APIs

Shared rules:
- `Issue = {severity:'error'|'warning'|'info', code, path, message}`. `code` is a stable `E_*`/`W_*`/`I_*` value. `path` looks like `layout[2][3][1]`. `message` is short English text.
- Pure functions never mutate inputs. Tests deep-freeze inputs.

### API-JSON — `KS.json` (L1)

```
Node = {t:'o', e:[string, Node][]} | {t:'a', v:Node[]} | {t:'n', raw:string}
     | {t:'s', v:string} | {t:'b', v:boolean} | {t:'z'}          // plain data, JSON-safe
parse(text, {maxDepth=64}?) → Node        // throws KS.json.JsonError {message, offset, line, column}
stringify(node) → string                  // Python json.dumps default: ', ' and ': ', ensure_ascii
                                          //   (lowercase \u escapes, surrogate pairs), escapes \" \\ \n \r \t \b \f,
                                          //   other C0 as \u00XX, numbers = raw verbatim, no trailing newline
int(node) → number                        // canonical safe integer literal only, else throws
```

Invariant: `stringify(parse(t)) === t` for Vial-written files. Duplicate keys and key order are kept. Input is strict JSON only.

### API-VIL — `KS.vil` (L1)

```
decode(text, board) → {ok:true, doc, issues} | {ok:false, issues}
encode(doc) → string                       // byte-identical when unedited
validate(doc, board) → Issue[]             // any 'error' blocks export
capabilities(doc) → Capabilities
layoutOptions.decode(value:number, labels) → {label, kind:'bool'|'select', choices?:string[], value:number}[]
layoutOptions.encode(values:number[], labels) → number
```

Decode rules:
- **Size and layout.** Input over 2 000 000 characters gives `E_TOO_LARGE`. A missing or malformed `layout` gives `E_LAYOUT`, and decode fails. The matrix must equal `board.matrix` (10 × 7), else `E_MATRIX`. Layer count must be 1..32.
- **Vial-required fields** (FACT, brief verified inputs): `layout`, `encoder_layout` and `layout_options`. If `encoder_layout` or `layout_options` is missing, decode succeeds, the section is absent (never synthesized), and `validate` returns `E_VIAL_REQUIRED`, which blocks export.
- **uid.** It must be a canonical unsigned decimal ≤ 2^64−1 and is stored as a string.
  - `uid === board.roundedUid` gives `W_UID_ROUNDED`.
  - Any other unknown uid gives `W_UID_OTHER`.
  - Vial itself only warns on uid mismatch (research), so these are warnings, never errors.
- **Raw passthrough.** Item shapes (§5) must match exactly, including object key sequence. Otherwise:
  - a non-conforming item becomes `{$raw: Node}` with `W_RAW_ITEM`;
  - a non-conforming optional section becomes `{$raw: Node}` with `W_RAW_SECTION`;
  - unknown top-level members go to `doc.extra` with `I_UNKNOWN_FIELD`;
  - in all cases the data is exported verbatim.
- **Unknown keycodes.** A key cell string that is not catalog-known (`keycodes.isKnown`) gives `W_UNKNOWN_KEYCODE`: "Vial will load this as KC_NO". Examples: `KC_NONUS_BACKSLASH` and typos. The string is kept verbatim and is not an export blocker.
- **Layout options.** Packing (FACT, `layout_editor.py`):
  - Options are concatenated as a bit string with label[0] most significant.
  - A string label is 1 bit.
  - A select label `[title, ...choices]` takes `(choices.length − 1).bit_length()` bits.
  - The imported value is preserved. The original default stays `0`, never rebased to the live `15`.
  - `encode` returns `E_RANGE` if a choice is out of range.

### API-WS — `KS.workspace`, `KS.history` (L1)

```
workspace.create(doc, {filename}) → Workspace          // meta defaults: original initialNames/palette (line 11)
workspace.fromDefault() → Workspace                    // decode(KS.DEFAULT_VIL_TEXT); no errors allowed
workspace.apply(ws, op:Op) → Workspace                 // pure, copy-on-write; throws KS.workspace.OpError {code, message}
workspace.restore(json) → {ok, ws?, issues}            // validates stored SCHEMA-WS; never throws
history.create(ws, {limit=200}) → History {past, present, future}
history.commit(h, op) / undo(h) / redo(h) → History;  canUndo(h) / canRedo(h) → boolean
```

`Op` (plain data; the future transport seam):
`key.set{layer,row,col,code}`, `encoder.set{layer,index,dir,code}`, `macro.set{index,actions}`, `tapDance.set{index,value}`, `combo.set{index,value}`, `keyOverride.set{index,value}`, `altRepeat.set{index,value}`, `setting.set{qsid,value}`, `layoutOptions.set{value}`, `uid.restoreKnown{}`, `meta.layerName{layer,value}`, `meta.layerColor{layer,value}`, `meta.keyLabel{layer,row,col,value|null}`, `batch{ops}`.

Op rules:
- **Counts never change.** No op adds or removes layers, macros, tap dances, combos, overrides, alt-repeat entries, encoders or setting qsids. Targeting an absent, raw or out-of-range item gives `OpError`.
- **Keycode values.** In `key.set`, `encoder.set`, tap dance, combo, override and alt-repeat values, every keycode must pass `keycodes.check` with no errors. This includes catalog-known names (QA-8). The single exception is re-setting the identical imported string, so undo can restore raw imported codes.
- **`setting.set`** is allowed only for a qsid present in the file and described in `KS.QMK_SETTINGS`.
  - The value must fit the field width (`0 .. 2^(8·width) − 1`) and any `min`/`max`.
  - Boolean fields edit their `bit` within the qsid's integer.
  - A qsid that is absent (for example 8) is never added. A present but undescribed qsid is read-only.
- **Bit fields.**
  - `keyOverride.set`: `layers` must be 0..65535 (16-bit); `trigger_mods`, `negative_mod_mask` and `suppressed_mods` 0..255; `options` 0..255 (FACT `"<HHHBBBB"`).
  - `altRepeat.set`: `allowed_mods` must be 0..255. `options` may use only bits 0–3.
- **`layoutOptions.set`** must round-trip through `vil.layoutOptions` with the board labels.
- **`uid.restoreKnown`** is allowed only when the uid equals `board.roundedUid`.
- **Other limits.**
  - `key.set` on `-1` gives `E_NO_KEY`.
  - Layer names are at most 35 characters (line 32). Key labels are at most 24 characters (line 30). Colors must be `#rrggbb`.
  - `batch` is atomic.

### API-KC — `KS.keycodes` (L2)

```
parse(cell:string|number) → Action        // total, never throws; unknown → {k:'raw', text}
format(action) → string                   // canonical Vial qmk_id; throws KS.keycodes.KeycodeError
isKnown(cell) → boolean                   // qmk_id or alias in catalog, incl. compound forms with known inner codes
check(text, {layers, macros, tapDances}) → Issue[]   // user input: grammar + catalog membership + index ranges
forCharacter(ch:string) → {direct:CharOption[], sequence:string[]|null}
CharOption = {code:string, level:'plain'|'shift'|'altgr'|'shiftAltgr', hid:number, dead:boolean, keypad:boolean}
byId(idOrAlias) → CatalogEntry|null;  catalog: CatalogEntry[];  categories: {id,label,ids}[]
CatalogEntry = {id, aliases:string[], label, category, hid?:number}
Action = {k:'none'} | {k:'trans'} | {k:'basic', id} | {k:'named', id}
  | {k:'mods', mods, inner:Action} | {k:'modtap', mods, tap:Action}
  | {k:'layer', fn:'MO'|'TG'|'TO'|'OSL'|'DF'|'TT'|'PDF', layer} | {k:'layertap', layer, tap:Action}
  | {k:'layermod', layer, mods} | {k:'osm', mods} | {k:'macro', index} | {k:'tapdance', index}
  | {k:'raw', text}
Mods = {ctrl, shift, alt, gui, right}     // QMK 5-bit: one side flag; mixed sides → KeycodeError
```

Catalog rules:
- **Source.** The catalog is a port of vial-gui `src/main/python/keycodes/keycodes.py` at `aef8222a`. It includes every `qmk_id`, every alias and every compound template (mod wraps, mod-taps, layer functions, OSM, TD, macros, user codes, lighting `RM_*`).
- **Names.** `format` emits `qmk_id` only, so `KC_NONUS_BSLASH` is emitted, never `KC_NUBS`. `KC_NONUS_BACKSLASH` is not a catalog name.
- **Verbatim storage.** Document strings are never reformatted unless edited (ADR-S3).
- **Coverage.** Every name in the owner's Vial-written files must be `isKnown` (test).
- **Other protocols.** A file whose `vial_protocol` is not 6 gives `W_PROTOCOL`: names are checked against this catalog.

`forCharacter` (GOAL-0, ADR-S10):
- **Option order.** `direct` holds every way to type `ch` from `estonian.js`, ordered plain < shift < altgr < shiftAltgr, then typing keys before keypad.
- **Codes per level.**
  - plain: `KC_x`
  - shift: `LSFT(KC_x)`
  - altgr: `RALT(KC_x)`
  - shiftAltgr: the catalog's right Shift+Alt wrap of `KC_x` (`format` of `{shift, alt, right}`), omitted if the catalog has none.
- **Dead keys.** `dead:true` marks a dead accent.
- **Sequences.** `sequence` is non-null only for a precomposed letter not directly on the layout. It holds `[deadKeyCode, baseCode]` from the NFD decomposition, for example `é` → dead acute + `KC_E`. The UI may offer it as a macro of two `tap` actions, but only if a free (all-empty) macro slot exists.

### API-LEG — `KS.legend` (L2)

```
describe(cell, ws) → Legend
at(ws, layer, row, col) → Legend          // KC_TRNS → layer 0 value, inherited:true (ADR-S7)
encoder(ws, layer, index, dir) → Legend   // dir 0 = clockwise, 1 = counter-clockwise (FACT, research)
macroText(actions) → {text:string, complete:boolean}   // ASSUMPTION-4; dead-key NFC composition
Legend = {code, inherited:boolean, fromLayer:number,
  kind:'char'|'shortcut'|'action'|'layer'|'modifier'|'macro'|'tapdance'|'none'|'raw',
  main:string, shift?:string, altgr?:string, shiftAltgr?:string, dead?:boolean,
  hold?:{kind:'mod'|'layer', text:string, layer?:number},
  detail?:string, layer?:number, approximate?:boolean, unknown?:boolean, a11y:string}
```

Legend semantics:
- **Main text.** `main` is what an Estonian host types. Examples:
  - `LSFT(KC_5)` → `%`
  - `RALT(KC_4)` → `$`
  - `KC_SCOLON` → `ö`
  - `LCTL(KC_C)` → `Ctrl + c`
  - macro `~n` → `ñ`

  Letters are lowercase in `main` and uppercase in `shift`.
- **Hold.** Mod-tap and layer-tap fill `hold`.
- **Detail.** Tap dance `detail` lists tap, hold, double and tap-hold.
- **Unknown codes.** `unknown:true` marks a code that is not catalog-known.

`KS.estonian.output(hid) → {levels:[plain,shift,altgr,shiftAltgr], dead:[4×bool]} | null`:
- Levels are real characters with lowercase letters, and `null` where `layout_tables.h` has 0.
- Dead flags (FACT, libxkbcommon `ee` keysym names):
  - 0x0d AltGr, Shift+AltGr
  - 0x2e plain, Shift, Shift+AltGr
  - 0x2f AltGr, Shift+AltGr
  - 0x30 Shift+AltGr
  - 0x31 and 0x32 Shift+AltGr
  - 0x33 AltGr, Shift+AltGr
  - 0x34 Shift+AltGr
  - 0x35 plain, Shift
  - 0x38 Shift+AltGr
  - No others.

## 5. SCHEMA-DOC and SCHEMA-WS

```
VialDocument = {order:string[], fields:{…known Vial keys present…}, extra:[string, Node][]}
fields (Vial names; any optional section may be {$raw:Node}; required for export: layout, encoder_layout, layout_options):
  version:number  uid:string  layout:KeyCell[][][]  encoder_layout:[KeyCell /*CW*/, KeyCell /*CCW*/][][]
  layout_options:number  macro:MacroAction[][]  vial_protocol:number  via_protocol:number
  tap_dance:[onTap, onHold, onDoubleTap, onTapHold, tappingTermMs][]       // KeyCell×4 + number
  combo:[KeyCell, KeyCell, KeyCell, KeyCell, output:KeyCell][]
  key_override:{trigger,replacement,layers,trigger_mods,negative_mod_mask,suppressed_mods,options}[]
  alt_repeat_key:{keycode,alt_keycode,allowed_mods,options}[]
  settings:[qsid:number, value:number][]   // file order
KeyCell = string | number                  // -1 = no key; other numbers kept verbatim, read-only
MacroAction = ['text', string] | ['tap'|'down'|'up', ...KeyCell[]] | ['delay', number]
Any list item may be {$raw:Node}.  encode emits `order`, then fields/extra in that order.
Capabilities = {source:'file', layers, matrix:{rows,cols}, encoders, macros, macroBytes:null /* unknown offline */,
  tapDance, combos, keyOverrides, altRepeat, settingQsids:number[], layoutOptions:boolean,
  vialRequiredMissing:string[], editable:{[section]:boolean}}
Workspace = {schema:2, filename, doc:VialDocument, meta:{layerNames:string[], layerColors:string[], keyLabels:{[`l:r:c`]:string}}}
BoardProfile = {id:'splitkb-kyria-rev4', matrix:{rows:10, cols:7}, knownUid:'10669769700359951850',
  roundedUid:'10669769700359952000', keys:[{row,col,x,y,angle}] /* 50, original line 9 */,
  moduleCells:[{row,col,side:'left'|'right'}] /* rows 4 and 9, cols 0–4 */,
  encoders:[{index,label}] /* 4 */, layoutOptionLabels /* verbatim from keypress_hlc/vial.json */}
```

- Bit names (FACT):
  - `key_override.options`: bit 0 trigger_down, 1 required_mod_down, 2 negative_mod_up, 3 one_mod, 4 no_reregister, 5 no_unregister_on_other_key_down, 7 enabled.
  - `alt_repeat_key.options`: bit 0 default_to_this, 1 bidirectional, 2 ignore_mod_handedness, 3 enabled.
  - Mod bytes follow ASSUMPTION-5.
- Module cells: `side` is inferred from the split matrix (rows 0–4 left, 5–9 right) and the definition labels "Halcyon module left/right". They have no drawn position and are listed, not placed (FACT: 60 cells, 50 geometry).
- Storage key `kyria-keymap-studio/v2`. Never read or write `kyria-studio-v1`.

## 6. NFRs

- QA-0: every character in `estonian.js` levels can be assigned in at most two interactions after selecting a key. The legend updates immediately.
- QA-1: an unedited import, then export, is byte-identical for `tests/fixtures/kriskyria.vil` and `backups/kyriav4current.vil`. One edit changes only that value's bytes.
- QA-2: the uid string is exact through decode, encode, storage and undo.
- QA-3: works from `file://` in current Chromium and Firefox with zero network requests.
- QA-4: WCAG 2.2 AA keyboard, focus and names. Board keys use roving focus with arrow keys. There is a live status region, and meaning never depends on colour alone.
- QA-5 (learning image):
  - The smallest PNG text is at least 0.19 × key width; the original was 0.125.
  - The typed character is the largest text on each key.
  - Per-layer export is legible at 100% zoom in an image viewer.
  - Sizes go in `DESIGN.md`, and the PNG stays within browser canvas limits.
- QA-6: reload restores the workspace. Corrupt storage shows a message and loads the default. Quota errors are shown. A `storage` event from another tab gives a warning.
- QA-7: every failure surfaces an Issue or status message. No uncaught exception leaves the UI inconsistent.
- QA-8: the studio never writes a keycode that is not catalog-known, except a verbatim imported string.

## 7. Threat model

| Threat | Control | Test |
| --- | --- | --- |
| Script injection via keycode, macro or name text | `textContent`/`setAttribute`, `createElementNS`, canvas `fillText`; no `innerHTML` with data | L4 hostile strings; L3 browser |
| Stack exhaustion | `maxDepth` 64 and a 2 MB limit | L4 |
| Prototype pollution | Node objects are entry arrays; `keyLabels` keys validated as `l:r:c` | L4 `__proto__` fixture |
| Silent data loss, including Vial's silent `KC_NO` | Raw passthrough, byte-identity tests, catalog-checked input, `W_UNKNOWN_KEYCODE`, export blocked on errors | L4 |
| Exfiltration | No network code; grep check for `fetch(`/`http` in `src/` | L4 static |

Residual risks are stated in UI-9:
- macro memory is unknown offline;
- Vial drops entries beyond device counts and loads unknown names as `KC_NO`.

## 8. UI contract and verification

| ID | UI (L3) | States |
| --- | --- | --- |
| UI-1 | Header: Import, Export .vil, Save image, Undo/Redo (Ctrl+Z, Ctrl+Shift+Z), status/alert region | success, error, disabled |
| UI-2 | Layer tabs; layer name/colour meta | |
| UI-3 | Board SVG from BoardProfile + `legend.at`; selection; inherited keys dimmed "↓ Base"; unknown-code badge | |
| UI-4 | **Primary**: Estonian character picker. Keyboard-shaped levels (Normal, Shift, AltGr, Shift+AltGr) plus a character search box. Uses `forCharacter`; dead accents labelled. **Secondary**: action composer (mod wrap, mod-tap hold, layer fn, layer-tap, OSM, TD, macro, catalog categories, raw entry with live `check`) | no selection = disabled |
| UI-5 | Panels for Macros, Tap dance, Combos, Key overrides, Alt repeat, Encoders (CW/CCW), Settings (from `QMK_SETTINGS`, present qsids only), Layout options, Module buttons (10 listed cells) | per Capabilities; raw = read-only "kept as is"; absent = "not in this file" |
| UI-6 | Learning PNG: current layer / chosen layers / all, spare toggle, encoder and module rows when non-empty | loading, success, error |
| UI-7 | Issues list. Export is blocked on errors (incl. `E_VIAL_REQUIRED`). Rounded-uid warning with explicit restore | |
| UI-8 | Autosave/recovery messages; reset to default with confirm | |
| UI-9 | Limits: offline file editor; capabilities from the file; nothing sent to the keyboard; Vial loads unknown names as KC_NO, drops entries beyond device counts, and checks macro memory | |

Traceability:
- GOAL-0 → UI-4, UI-6, QA-0, QA-5, VERIFY-6, VERIFY-7.
- CAP-1 → API-KC, API-LEG, UI-4, VERIFY-5, VERIFY-6.
- CAP-2 → API-JSON, API-VIL, VERIFY-1..3.
- CAP-3 → API-WS ops, UI-5, VERIFY-4.
- CAP-4 → API-LEG, UI-6, QA-5, VERIFY-6, VERIFY-7.
- CAP-5 → API-WS history, UI-1, UI-7, UI-8, QA-6, QA-7, VERIFY-4, VERIFY-7.
- CONSTRAINT-1 and CONSTRAINT-5 → ADR-S4.
- CONSTRAINT-2 → API-KC.
- CONSTRAINT-3 → §3, VERIFY-8.
- CONSTRAINT-4 → Capabilities, UI-9.
- CONSTRAINT-6 → README, VERIFY-9.

| VERIFY | Covers | Lane / gate |
| --- | --- | --- |
| VERIFY-1 | QA-1, QA-2: round-trip fixtures; uid survives storage JSON and history | L4 node, echo |
| VERIFY-2 | `json.parse` errors (line/col), depth, duplicates, Python-style escapes | L4 node, echo |
| VERIFY-3 | Decode issues: matrix, size, raw items/sections, rounded uid, extras, `E_VIAL_REQUIRED`, `W_UNKNOWN_KEYCODE` (for example `KC_NONUS_BACKSLASH`) | L4 node, echo |
| VERIFY-4 | Every Op: pure, count-preserving, OpError cases, settings width/bit/absent-qsid rules, layout-options packing (owner values 0, 10, 15 with the definition labels), undo/redo/limit | L4 node, echo |
| VERIFY-5 | `estonian.js` levels equal the `layout_tables.h` Estonian block under uppercase display mapping; dead flags equal §4 exactly | L4 node, echo |
| VERIFY-6 | Owner-file names are `isKnown`; `check` rejects typos and `KC_NONUS_BACKSLASH`; `format` emits `KC_NONUS_BSLASH`; `forCharacter` for `õ ä ö ü š ž € @ % < ´ é`; legends for the §4 examples; encoder dir labels | L4 node, echo |
| VERIFY-7 | UI-1..UI-9 functional, QA-0, QA-3..QA-6, PNG readability, both browsers over `file://` | L3 artist |
| VERIFY-8 | Original HTML sha256 unchanged; `host/layer-names.txt` untouched | primary audit |
| VERIFY-9 | README usage and limits present; the published revision equals the verified one | primary before push |

## 9. Resolved Vial details (formerly VERIFY-R*)

| ID | Resolution | Source |
| --- | --- | --- |
| R1 | Unknown names load as `KC_NO` (silently). Canonical `KC_NONUS_BSLASH`, alias `KC_NUBS`; `KC_NONUS_BACKSLASH` is invalid. The catalog is ported from `keycodes.py`. | research, brief |
| R2 | Macro actions are `text`/`tap`/`down`/`up`/`delay` as in §5. Memory size is unknown offline: warn only. | research |
| R3 | Settings come from `qmk_settings.json` (`tabs[].fields[]`: `type`, `title`, `qsid`, `width`, `bit`, …). Edit only present qsids; an absent qsid 8 is legitimate. | research, architect read |
| R4 | Key override and alt-repeat fields and bits as in §5. `layers` is 16-bit; mod bytes are 8-bit (`"<HHHBBBB"`). Mod bit order is ASSUMPTION-5. | research, `key_override.py` |
| R5 | `layout_options`: label[0] is most significant. Bool = 1 bit; select = `(n−1).bit_length()`. Preserve imported values; no rebase of the default `0`. | research, `layout_editor.py` |
| R6 | `encoder_layout` pair: index 0 = CW, 1 = CCW. **This reverses the first draft's default.** | research, `keyboard_comm.py` |
| R7 | A uid mismatch is a warning only in Vial. The studio warns. | research |
| R8 | Text macros use US-ASCII `send_string`. Still ASSUMPTION-4, affecting only the legend `approximate` flag. | open, non-critical |

## 10. ADRs

- ADR-S1 Classic scripts, no build. Runner-up: a single HTML built by concatenation. Rejected because it needs a build step and one shared file. ES modules fail from `file://` in Chromium.
- ADR-S2 Lossless JSON: own parser to Node plus a Python-style writer. Runner-up: a `JSON.parse` reviver. Rejected because it still needs a custom writer and loses order. Evidence: the rounded-uid files.
- ADR-S3 The document mirrors `.vil`, and codes are stored verbatim. Runner-up: a normalized Action tree. Rejected because it rewrites aliases and unknown codes.
- ADR-S4 Core, app and source separation with `Op` + `Capabilities`. Runner-up: the UI mutates JSON (original). Rejected because it blocks a future device source or replacement.
- ADR-S5 Canvas 2D PNG from Legend. Runner-up: SVG, then img, then canvas. Rejected for text control.
- ADR-S6 Estonian data from `layout_tables.h` with a cross-check test. Runner-up: the original hand table. Rejected because it is incomplete.
- ADR-S7 Transparent keys show layer 0. Runner-up: nearest lower layer. Rejected because MO from Base falls through to Base. Limitation: DF.
- ADR-S8 Studio metadata stays in browser storage under key v2, never in `.vil`. Runner-up: a `.vil` extra field. Rejected because it alters Vial files.
- ADR-S9 `node:test` with no npm. Runner-up: Vitest/Jest. Rejected because of the dependencies.
- ADR-S10 (new, GOAL-0) The primary picker is character-first, backed by `forCharacter`. The keycode/action composer is secondary. Runner-up: the original keycode-first tabs. Rejected because Vial lacks an Estonian keymap, which is the owner's core problem. Consequence: L2 owns the reverse lookup, and the picker never shows a US label as the primary legend.

## 11. Decisions confirmed

- UI copy: English.
- Default keymap: the original's embedded layout (= `kriskyria.vil` text, `layout_options` 0).
- Rounded uid: explicit, undoable restore.
- No migration from `kyria-studio-v1`.
- Publication: after tests, in the existing repository (CONSTRAINT-6).

No open owner questions.
