# Keymap Studio LLA

Status: **PROVISIONAL**. Parent: [`architecture.md`](../../architecture.md) (HLA). Brief: [`docs/product/brief.md`](../product/brief.md).
- READY: §2 layout and load rules, §3 lanes and ownership, §4 API signatures and invariants, §5 data model shapes, §6 to §8.
- PROVISIONAL: the Vial details listed in §9 (`VERIFY-R*`). Lanes implement these as data tables, so researcher answers change data, not APIs.

## 1. Parent alignment

The parent HLA defines goals, constraints and ADR adoption. This LLA specializes them and makes no deviation. The original `/home/kris/Documents/kyria-keymap-studio.html` is read-only reference material. Only its geometry and palette/name defaults are reused (line 9 geometry, line 11 `palette` and `initialNames`).

## 2. Directory layout and loading

```
keymap-studio/
  index.html                 app shell; <script src> tags in the fixed order below; no inline app logic
  DESIGN.md                  artist: visual system, UI-* state grid
  README.md                  artist: how to open/use offline, limits
  styles/studio.css
  src/data/board-kyria.js    BoardProfile (core-codec)
  src/data/default-vil.js    KS.DEFAULT_VIL_TEXT = exact text of kriskyria.vil (core-codec)
  src/data/estonian.js       Estonian output table (core-keys)
  src/data/keycode-catalog.js catalog + categories (core-keys)
  src/core/json.js           API-JSON (core-codec)
  src/core/vil.js            API-VIL (core-codec)
  src/core/workspace.js      API-WS ops (core-codec)
  src/core/history.js        API-WS history (core-codec)
  src/core/keycodes.js       API-KC (core-keys)
  src/core/legend.js         API-LEG (core-keys)
  src/app/*.js               artist; main.js last
  tests/*.test.js, tests/load-core.js, tests/fixtures/  (tests lane)
```

Rules (ADR-S1):
- Each file is `(function (KS) { 'use strict'; … KS.<ns> = {...}; })(globalThis.KyriaStudio = globalThis.KyriaStudio || {});`. No `import`/`export`, no `type="module"`, no top-level calls into other files. Cross-file calls happen only inside functions, so load order matters only for `src/app/main.js` (last), which starts the app on `DOMContentLoaded`.
- Script order in `index.html`: `src/data/*`, `src/core/json.js`, `keycodes.js`, `vil.js`, `legend.js`, `workspace.js`, `history.js`, then `src/app/*`, with `main.js` last.
- Core and data files use no `document`, `window`-only API, `localStorage`, `fetch`, `Date.now` or `Math.random`. They must load in Node with `require()`. `tests/load-core.js` requires every core and data file and returns `globalThis.KyriaStudio`.
- No network: no `fetch`, XHR, remote URL, CDN, web font or `default.json` fallback (that fallback was original line 41).

## 3. Lanes, file ownership and dependencies

| Lane | Agent | Owns (exclusive) | Depends on |
| --- | --- | --- | --- |
| L1 core-codec | engineer or general | `src/core/json.js`, `src/core/vil.js`, `src/core/workspace.js`, `src/core/history.js`, `src/data/board-kyria.js`, `src/data/default-vil.js` | none; VERIFY-R2..R7 data only |
| L2 core-keys | general | `src/core/keycodes.js`, `src/core/legend.js`, `src/data/estonian.js`, `src/data/keycode-catalog.js` | SCHEMA-DOC/SCHEMA-WS shapes (fixed here, not code); VERIFY-R1, R8 |
| L3 app | artist | `index.html`, `DESIGN.md`, `README.md`, `styles/**`, `src/app/**` | API contracts; final integration after L1 and L2 land |
| L4 tests | general or small | `tests/**`, plus one `studio-test` target in `/Makefile` (`node --test 'keymap-studio/tests/*.test.js'`; the directory form fails on Node 22) | contracts only; tests go green as L1 and L2 land |

- Paths are relative to `keymap-studio/` except `/Makefile`.
- No lane edits another lane's files. Disputed behaviour goes to architect. Implementers never edit tests to pass, and the tests lane never edits code.
- No lane touches `/home/kris/Documents/*`, `host/layer-names.txt`, firmware, tools, backups, CI or the Backlog board.
- Fixtures: `tests/fixtures/kriskyria.vil` is a byte-exact copy of `/home/kris/Documents/kriskyria.vil` (sha256 `2187ec80…2899`). Tests read `backups/kyriav4current.vil` and `firmware/.../keypress_hlc/layout_tables.h` in place.

## 4. Module APIs

Shared types:
- `Issue = {severity:'error'|'warning'|'info', code:string, path:string, message:string}`. `code` values are stable `E_*`/`W_*` strings. `path` is JSON-path-like, for example `layout[2][3][1]`. `message` is short English UI text (ASSUMPTION-1).
- Pure functions never mutate inputs. Tests deep-freeze inputs.

### API-JSON — `KS.json` (L1)

```
Node = {t:'o', e:[string, Node][]} | {t:'a', v:Node[]} | {t:'n', raw:string}
     | {t:'s', v:string} | {t:'b', v:boolean} | {t:'z'}          // plain data, JSON-safe
parse(text, {maxDepth=64}?) → Node        // throws KS.json.JsonError {message, offset, line, column}
stringify(node) → string                  // Python json.dumps default: ', ' and ': ', ensure_ascii
                                          //   (\uXXXX lowercase, surrogate pairs), escapes \" \\ \n \r \t \b \f,
                                          //   other C0 as \u00XX, numbers = raw verbatim, no trailing newline
int(node) → number                        // requires /^-?(0|[1-9][0-9]*)$/ and safe integer, else throws
```

Invariants: `stringify(parse(t)) === t` for every Vial-written file. Duplicate keys and key order are kept. Strict JSON only: no comments, no trailing commas, no NaN. A BOM or whitespace around the document is accepted and dropped (reported by vil as `W_REFORMATTED`).

### API-VIL — `KS.vil` (L1)

```
decode(text, board) → {ok:true, doc:VialDocument, issues:Issue[]} | {ok:false, issues:Issue[]}
encode(doc) → string                      // via json.stringify; byte-identical when unedited
validate(doc, board) → Issue[]            // errors block export
capabilities(doc) → Capabilities
```

Decode rules:
- Size > 2 000 000 characters gives `E_TOO_LARGE`. `layout` is required. The matrix must equal `board.matrix` (10 × 7), else `E_MATRIX`. Layer count must be 1..32.
- `uid` must be a canonical unsigned decimal ≤ 2^64−1 and is kept as a string. If `uid === board.roundedUid` the result is `W_UID_ROUNDED`. Another unknown uid gives `W_UID_OTHER`.
- Known item shapes (§5) must match exactly, including object key sequence. A non-conforming item becomes `{$raw: Node}` and adds `W_RAW_ITEM` (read-only, still exported verbatim). A non-conforming optional section becomes `{$raw: Node}` and adds `W_RAW_SECTION`.
- Unknown top-level members go to `doc.extra` verbatim and add `I_UNKNOWN_FIELD`.

### API-WS — `KS.workspace`, `KS.history` (L1)

```
workspace.create(doc, {filename}) → Workspace          // meta defaults: original initialNames/palette
workspace.fromDefault() → Workspace                    // decode(KS.DEFAULT_VIL_TEXT); must have no errors
workspace.apply(ws, op:Op) → Workspace                 // pure, copy-on-write; throws KS.workspace.OpError {code, message}
workspace.restore(json) → {ok, ws?, issues}            // validates stored SCHEMA-WS; never throws
history.create(ws, {limit=200}) → History {past:Workspace[], present:Workspace, future:Workspace[]}
history.commit(h, op) / undo(h) / redo(h) → History;  canUndo(h) / canRedo(h) → boolean
```

`Op` (plain data, the future transport seam):
`key.set{layer,row,col,code}`, `encoder.set{layer,index,dir,code}`, `macro.set{index,actions}`, `tapDance.set{index,value}`, `combo.set{index,value}`, `keyOverride.set{index,value}`, `altRepeat.set{index,value}`, `setting.set{id,value}`, `layoutOptions.set{value}`, `uid.restoreKnown{}`, `meta.layerName{layer,value}`, `meta.layerColor{layer,value}`, `meta.keyLabel{layer,row,col,value|null}`, `batch{ops}`.

Op rules:
- Ops never change counts (layers, macros, tap dances, combos, overrides, encoders, setting ids). Targeting an absent, raw or out-of-range item gives `OpError`.
- `key.set` on a `-1` cell gives `E_NO_KEY`.
- `uid.restoreKnown` is allowed only when the current uid equals `board.roundedUid` (OQ-3).
- `meta.layerName` is trimmed and limited to 35 characters (original line 32). `meta.keyLabel` is limited to 24 characters (original line 30). Colors must be `#rrggbb`.
- `batch` is atomic.

### API-KC — `KS.keycodes` (L2)

```
parse(cell:string|number) → Action        // total, never throws; unknown → {k:'raw', text}
format(action) → string                   // canonical Vial name (VERIFY-R1); throws KS.keycodes.KeycodeError
check(text, {layers, macros, tapDances}) → Issue[]   // for user-typed codes; grammar + ranges
byId(idOrAlias) → CatalogEntry|null;  catalog: CatalogEntry[];  categories: {id,label,ids}[]
CatalogEntry = {id, aliases:string[], label, category, hid?:number}   // hid = HID usage for typing keys
Action = {k:'none'} | {k:'trans'} | {k:'basic', id} | {k:'named', id}
  | {k:'mods', mods, inner:Action} | {k:'modtap', mods, tap:Action}
  | {k:'layer', fn:'MO'|'TG'|'TO'|'OSL'|'DF'|'TT'|'PDF', layer} | {k:'layertap', layer, tap:Action}
  | {k:'layermod', layer, mods} | {k:'osm', mods} | {k:'macro', index} | {k:'tapdance', index}
  | {k:'raw', text}
Mods = {ctrl, shift, alt, gui, right}     // QMK 5-bit: one side flag for all; mixed sides → KeycodeError
```

The document stores code strings verbatim. `format` is used only for codes the user composes, and a code that is not edited is never reformatted (ADR-S3). The catalog includes every name present in the owner's Vial-written files (for example `KC_BSPACE`, `KC__VOLUP`, `RM_*`) plus the VERIFY-R1 set.

### API-LEG — `KS.legend` (L2)

```
describe(cell, ws) → Legend               // no layer resolution
at(ws, layer, row, col) → Legend          // KC_TRNS → layer 0 value, inherited:true (ADR-S7)
encoder(ws, layer, index, dir) → Legend
macroText(actions) → {text:string, complete:boolean}   // text actions via US send_string, Estonian output, dead-key NFC
Legend = {code, inherited:boolean, fromLayer:number,
  kind:'char'|'shortcut'|'action'|'layer'|'modifier'|'macro'|'tapdance'|'none'|'raw',
  main:string, shift?:string, altgr?:string, shiftAltgr?:string, dead?:boolean,
  hold?:{kind:'mod'|'layer', text:string, layer?:number},
  detail?:string, layer?:number, approximate?:boolean, a11y:string}
```

Semantics:
- `main` is what the key types on an Estonian host. Examples: `LSFT(KC_5)` gives `%`, `RALT(KC_4)` gives `$`, `KC_SCOLON` gives `ö`, `LCTL(KC_C)` gives `Ctrl + c`.
- Letters are lowercase in `main` and uppercase in `shift`.
- Mod-tap and layer-tap fill `hold`. Tap dance `detail` lists tap/hold/double/tap-hold. Macro `main` is `macroText`.
- Unknown codes show verbatim with `kind:'raw'`.
- `KS.estonian.output(hid) → {levels:[plain,shift,altgr,shiftAltgr], dead:[4×bool]} | null`. The levels hold real characters with lowercase letters; dead accents are the accent character, and `null` where `layout_tables.h` has 0.
- Dead flags (FACT: libxkbcommon `ee` keysym names, queried at Stage 1 through `tools/generate_layouts.py` helpers):
  - 0x0d AltGr, Shift+AltGr (hook, horn)
  - 0x2e plain, Shift, Shift+AltGr (´ ` ¸)
  - 0x2f AltGr, Shift+AltGr (¨ ˚)
  - 0x30 Shift+AltGr (¯)
  - 0x31 and 0x32 Shift+AltGr (˘)
  - 0x33 AltGr, Shift+AltGr (´ ˝)
  - 0x34 Shift+AltGr (^)
  - 0x35 plain, Shift (ˇ ~)
  - 0x38 Shift+AltGr (˙)
  - Everything else is not dead.

## 5. SCHEMA-DOC and SCHEMA-WS

```
VialDocument = {order:string[], fields:{…known Vial keys present…}, extra:[string, Node][]}
fields (Vial names; any optional section may be {$raw:Node}):
  version:number  uid:string  layout:KeyCell[][][]  encoder_layout:[KeyCell,KeyCell][][]
  layout_options:number  macro:MacroAction[][]  vial_protocol:number  via_protocol:number
  tap_dance:[KeyCell,KeyCell,KeyCell,KeyCell,number][]   combo:[KeyCell×5][]
  key_override:{trigger,replacement,layers,trigger_mods,negative_mod_mask,suppressed_mods,options}[]
  alt_repeat_key:{keycode,alt_keycode,allowed_mods,options}[]
  settings:[number, number][]             // ordered [id, value]; object keys in the file
KeyCell = string | number                 // -1 = no key; other numbers kept verbatim, read-only
MacroAction = ['text', string] | ['tap'|'down'|'up', ...KeyCell[]] | ['delay', number]   // VERIFY-R2
Any list item may be {$raw:Node}.  encode emits `order`, then fields/extra in that order.
Capabilities = {source:'file', layers, matrix:{rows,cols}, encoders, macros, macroBytes:null,
  tapDance, combos, keyOverrides, altRepeat, settingIds:number[], layoutOptions:boolean,
  editable:{[section]:boolean}}          // counts come from the file; 0/absent → panel hidden or empty-state
Workspace = {schema:2, filename, doc:VialDocument, meta:{layerNames:string[], layerColors:string[], keyLabels:{[`l:r:c`]:string}}}
BoardProfile = {id:'splitkb-kyria-rev4', matrix:{rows:10, cols:7}, knownUid:'10669769700359951850',
  roundedUid:'10669769700359952000', keys:[{row,col,x,y,angle}] /* 50, original line 9 */,
  encoders:[{index,label}] /* 4 */, layoutOptionLabels /* from keypress_hlc/vial.json */}
```

- Storage key: `kyria-keymap-studio/v2`, holding `JSON.stringify(Workspace)`. Never read or write `kyria-studio-v1`.
- Matrix cells outside `board.keys` that are not `-1` (rows 4 and 9, for example `KC_MUTE` at 4,0) are listed as "Other matrix positions". Their physical meaning is Unknown.

## 6. NFRs

- QA-1: an unedited import, then export, is byte-identical for all four Vial-written owner files (HLA §2). One edit changes only that value's bytes.
- QA-2: the uid string is exact through decode, encode, storage and undo.
- QA-3: works from `file://` in current Chromium and Firefox with zero network requests.
- QA-4: WCAG 2.2 AA. Board keys reachable by keyboard (roving focus and arrows), visible focus, names include the legend and code, live status region, no colour-only meaning.
- QA-5: the PNG's smallest text is at least 0.19 × key width. The original ratio is 5.5/44 = 0.125. Final sizes go in `DESIGN.md`. The PNG stays within browser canvas limits and is verified by artist in both browsers.
- QA-6: reload restores the workspace. Corrupt storage gives a message and a default layout, never a blank app. Quota errors are shown. A `storage` event from another tab gives a warning.
- QA-7: every failure surfaces an Issue or status message. No uncaught exception leaves the UI inconsistent.

## 7. Threat model

Inputs are imported `.vil` text and stored JSON.

| Threat | Control | Test |
| --- | --- | --- |
| Script injection via keycode, macro or name text | DOM uses `textContent` or `setAttribute`. SVG is built with `createElementNS`. Canvas uses `fillText`. No `innerHTML` with data. | L4 hostile-string fixture; L3 browser check |
| Stack exhaustion | Iterative parser or `maxDepth` 64. 2 MB limit. | L4 deep-nesting test |
| Prototype pollution | Node objects are entry arrays; extras are arrays; `keyLabels` keys are validated as `l:r:c` | L4 `__proto__` fixture |
| Silent data loss | Raw passthrough, byte-identity tests, export blocked on errors | QA-1 tests |
| Exfiltration | No network code; checked by grep for `fetch(`/`http` in `src/` | L4 static test |

Residual risk: Vial may still refuse a file for device-side reasons not stored in `.vil`, such as macro memory (VERIFY-R2). The UI states this limit (UI-9).

## 8. UI contract and verification

| ID | UI (L3) | States |
| --- | --- | --- |
| UI-1 | Header: Import, Export .vil, Save image, Undo/Redo (Ctrl+Z, Ctrl+Shift+Z), status/alert region | success, error, disabled |
| UI-2 | Layer tabs and layer name/colour meta | |
| UI-3 | Board SVG from BoardProfile and `legend.at`; selection; inherited keys dimmed with "↓ Base" | |
| UI-4 | Estonian picker with Normal, Shift, AltGr and Shift+AltGr levels, catalog categories, and a composer for mod wrap, mod-tap, layer fn, layer-tap, OSM, TD, macro, and raw entry with live `keycodes.check` | |
| UI-5 | Panels for Macros, Tap dance, Combos, Key overrides, Alt repeat, Encoders, Settings, Other matrix positions | shown only per Capabilities; raw = read-only "kept as is"; empty |
| UI-6 | PNG: all or current layer, spare layers toggle, encoder strip; Canvas 2D | loading, success, error |
| UI-7 | Issues list; export blocked on errors; warnings for rounded uid with the explicit restore action | |
| UI-8 | Autosave and recovery messages; reset to default with confirm | |
| UI-9 | Limits note: offline file editor, capabilities from file, nothing sent to the keyboard | |

Traceability:
- CAP-1 → API-KC, API-LEG, UI-4, VERIFY-5, VERIFY-6.
- CAP-2 → API-JSON, API-VIL, VERIFY-1..3.
- CAP-3 → API-WS ops, UI-5, VERIFY-4.
- CAP-4 → API-LEG, UI-6, QA-5, VERIFY-6, VERIFY-7.
- CAP-5 → API-WS history, UI-1, UI-7, UI-8, QA-6, QA-7, VERIFY-4, VERIFY-7.
- CONSTRAINT-1 and CONSTRAINT-5 → ADR-S4.
- CONSTRAINT-2 → API-KC.
- CONSTRAINT-3 → §3, VERIFY-8.
- CONSTRAINT-4 → Capabilities, UI-9.

| VERIFY | Covers | Lane / gate |
| --- | --- | --- |
| VERIFY-1 | QA-1, QA-2: round-trip owner files; uid survives storage JSON and history | L4 node, echo |
| VERIFY-2 | `json.parse` errors (line/col), depth, duplicates, escapes vs Python for non-ASCII | L4 node, echo |
| VERIFY-3 | decode issues: matrix, size, raw items/sections, rounded uid, extras | L4 node, echo |
| VERIFY-4 | every Op: pure, count-preserving, OpError cases, undo/redo/limit | L4 node, echo |
| VERIFY-5 | `estonian.js` levels equal the `layout_tables.h` Estonian block after uppercase display mapping; dead flags equal the §4 FACT list exactly | L4 node, echo |
| VERIFY-6 | keycodes parse/format for every code in owner files; check() ranges; legends for the cited examples and macro `~n` → `ñ` | L4 node, echo |
| VERIFY-7 | UI-1..UI-9 functional, QA-3..QA-6, PNG readability, both browsers over `file://` | L3 artist (functional and visual) |
| VERIFY-8 | original HTML sha256 unchanged; `host/layer-names.txt` untouched | primary audit |

## 9. PROVISIONAL Vial details (researcher fills; data-only impact)

| ID | Question | Default until answered | Lane/file |
| --- | --- | --- | --- |
| VERIFY-R1 | Names Vial (protocol 6) writes and accepts: combined mods, multi-mod mod-tap, LT, LM, OSM, TT, PDF, QK_*, RM_*, mouse, USER, unknown codes (int or hex?) | Emit only names seen in owner files plus QMK names Vial is confirmed to write; others are raw entry only | L2 `keycode-catalog.js` |
| VERIFY-R2 | Macro action forms; macro memory limit on load | §5 forms; unknown = raw; UI warns that the limit is unknown | L1, L3 |
| VERIFY-R3 | QMK settings id table (name, type, width, bits, range) | Show ids present as integer fields 0..65535 with no names | L3 settings panel data |
| VERIFY-R4 | `key_override.options`/mod masks and `alt_repeat_key` fields/options bits | Raw integer fields | L3 |
| VERIFY-R5 | `layout_options` bit packing | Read-only raw value | L3 |
| VERIFY-R6 | `encoder_layout` pair order (CCW, CW) | `[0]=CCW`, `[1]=CW` (owner files: VOLD, VOLU) | L2 legend, L3 |
| VERIFY-R7 | Vial load behaviour on uid mismatch or count differences | Warn only | L1 issues text |
| VERIFY-R8 | Text macros sent as US ASCII via send_string | Yes; legend `approximate:true` if a character is unmapped | L2 |

## 10. ADRs

- ADR-S1 Classic scripts, no build. Context: `file://` with no build step (brief line 18). Decision: ordered classic scripts with a namespace. Runner-up: one HTML file built by concatenation. Rejected because it needs a build step and one shared file for all lanes. ES modules were rejected because they fail from `file://` in Chromium. Consequence: no bundler. Load order is enforced by the rule in §2.
- ADR-S2 Lossless JSON. Decision: own parser to Node, plus a Python-style writer. Runner-up: `JSON.parse` with source-text reviver. Rejected because it still needs a custom writer and loses order and unknown-field detail. Evidence: rounded-uid files in `/home/kris/Downloads`.
- ADR-S3 Document mirrors `.vil`; codes are stored verbatim. Runner-up: a normalized Action tree. Rejected because it rewrites aliases and unknown codes.
- ADR-S4 Core, app and source separation with `Op` + `Capabilities` (CONSTRAINT-5). Runner-up: UI mutates JSON directly, as the original does. Rejected because it blocks a device source later.
- ADR-S5 Canvas 2D PNG from Legend. Runner-up: the original SVG, then img, then canvas chain. Rejected for text control and taint robustness.
- ADR-S6 Estonian table from `layout_tables.h` with a cross-check test. Runner-up: the hand table at original line 12. Rejected because it is incomplete (for example, the GRAVE AltGr `•` is missing).
- ADR-S7 Transparent keys show the layer 0 value (original line 25 behaviour). Runner-up: nearest lower non-transparent layer. Rejected because layers reached by MO from Base fall through to Base. Limitation: DF can change the default layer.
- ADR-S8 Studio metadata stays in the browser under key v2. It never goes into `.vil`, and v1 is never written. Runner-up: metadata in a `.vil` extra field. Rejected because it alters Vial files.
- ADR-S9 Tests use `node:test` with no npm. Runner-up: Vitest/Jest. Rejected because they add dependencies and a lockfile.

## 11. Owner questions (defaults applied)

- OQ-1: Should the app's own text (buttons, help) be English as now, or Estonian? Default: English. The keyboard layout is Estonian only.
- OQ-2: Starting layout before any import. Default: built-in copy of `/home/kris/Documents/kriskyria.vil`, which the original embeds. Alternative: `backups/kyriav4current.vil`.
- OQ-3: When a file has the rounded uid `10669769700359952000`, offer a one-click "restore real Kyria UID"? Default: yes, as an explicit and undoable action.
- OQ-4: Copy layer names and colours from the original app's browser storage? Default: no. The original is left completely alone.
