# Kyria Keymap Studio: design

Status: Stage 1 design, 2026-10-25. Design and plan only; nothing here authorizes implementation.
Owner brief: `docs/product/brief.md` (GOAL-1/2, CAP-1..5, CONSTRAINT-1..5).
Core contracts (document model, Vial codec, keycode parser, Estonian output tables, persistence, history, validation) belong to the architect in `architecture.md`. Section 12 lists what this UI needs from those contracts; where names differ, `architecture.md` wins.

## 1. Read of the brief

Reading this as: a single-owner offline editing workspace and printable reference for an Estonian-layout Halcyon Kyria rev4, in the existing dark-blue, colour-per-layer language, leaning toward a dense professional tool in the Vial family rather than a marketing page.

- DESIGN_VARIANCE: low. The owner asked to keep the dark blue, colour-coded keyboard concept.
- MOTION_INTENSITY: low. Motion only answers actions.
- VISUAL_DENSITY: high. Fifty keys, eight layers and seven feature tables on one workspace.

Subject, audience, job. The subject is one physical keyboard with a fixed 10 × 7 matrix and fixed geometry, typed into an Estonian (xkb `ee`, dead keys) computer. The audience is its owner, who knows Vial and QMK, edits occasionally, and keeps a reference image to remember the layers. The primary job is to change what keys do and see, in real Estonian characters, what each key will type; the second job is a reference sheet readable at a glance.

## 2. What the original does, measured

Sources: `/home/kris/Documents/kyria-keymap-studio.html` (read only, never modified) rendered headless at 1440 × 900 and its "Save image" output (3840 × 3780 PNG) inspected at full resolution.

| Problem | Measurement or observation | Design response |
|---|---|---|
| Hold legends unreadable | `hold Shift` drawn at 5.5 units on a 44-unit key (0.125 k); 3 px when the sheet is fitted to a 1080 px screen | Hold band, 0.20 k minimum, bold, high-contrast fill (section 5) |
| AltGr legends tiny and prefixed with "G" | 7 units (0.159 k) | Corner legend 0.25 k, colour and position carry the meaning |
| Legends overflow keys | `Enter`, `Space`, `Bksp` exceed the keycap in board and PNG | Fit cascade with measured text; never shrink below minimum, abbreviate instead |
| Inheritance shown only as a tiny `↓` | 0.125 k glyph | Dashed keycap, muted resolved legend, source named only when it differs from the layer default |
| Raw codes leak into legends | `GUI + 6`, `L6`, `decimal` | Real Estonian output first, explicit Unknown treatment only for codes the studio cannot describe |
| Estonian table hand-typed with gaps | Grave AltGr empty (xkb gives `•`), letters' AltGr partially guessed | Output data generated from the same libxkbcommon source as the firmware table (section 6) |
| Encoders, macros, tap dance, combos, overrides not editable | Macros and tap dances only listed | Full editors (section 8) |
| Filler and template chrome | `ESTONIAN · KYRIA` eyebrow, tagline "Your keys, made memorable.", poster card restating the export button, an inert "Offline app" pill | Removed; the reference sheet gets a real preview view instead |

## 3. Design plan, review and revision

First pass: Vial clone (board on top, keycode tabs below), original palette, `system-ui`, legends in the original corner positions but larger, monospace for every keycode and small label, a card per macro and combo, icon-only side rail.

Review against the brief and the generic defaults, and what changed:

1. `system-ui` is the default any tool gets. Replaced with **Atkinson Hyperlegible Next**, designed for character disambiguation. On a keymap the whole job is telling `l`, `I`, `|` and `1` apart, `0` from `O`, and `,` from `.` at small sizes. Subject reason, not taste.
2. Monospace for small labels is a template tell. Kept only where text is literally code: the raw Vial keycode field and the Unknown fallback. Uses the matching **Atkinson Hyperlegible Mono**.
3. Bigger corner text alone does not solve hold behaviour, which is the most important unreadable thing. Introduced the **hold band**: a filled strip at the bottom of the keycap that only ever means "when held". One position, one meaning, on screen and on the sheet.
4. Card per feature row is the SaaS-card kit. Replaced with master-detail lists: plain rows, selected row filled, no per-row borders.
5. Icon-only rail is generic and unlabelled. Rail has text labels plus the project's own icon set; icon-only only as the narrow-width fallback, with accessible names.
6. Board-on-top with a fixed keycode tab strip fitted poorly at 1440 × 900. Encoder dials moved into the empty space between the halves, so the board needs no extra strip.

Spend of boldness: the keycap legend system, identical on the editing board and in the PNG. Everything around it stays quiet.

## 4. Tokens

All components consume semantic custom properties from `styles/tokens.css`. Raw values exist only there. Contrast figures were computed from these values (WCAG 2.x formula).

### Colour

| Token | Value | Use, contrast |
|---|---|---|
| `--surface-app` | `#0d1521` | Page and board background (original `--bg`) |
| `--surface-panel` | `#152033` | Rail, composer, picker, lists |
| `--surface-sunken` | `#0f1a29` | Picker well, inputs |
| `--surface-selected` | `#22344d` | Selected list row; text 10.9:1, muted 4.9:1 |
| `--keycap` | `#1d2b3e` | Keycap fill; every layer colour ≥ 6.1:1 on it |
| `--keycap-inherited` | `#142133` | Transparent keys |
| `--keycap-band` | `#2c3f57` | Modifier hold band; ink 9.3, Shift 7.4, AltGr 6.9 |
| `--line` | `#2b3c52` | Decorative hairlines only (1.5:1) |
| `--line-control` | `#617a9c` | Input and control boundaries (≥ 3.2:1 on every surface) |
| `--keycap-empty-line` | `#5a6c84` | Disabled (`KC_NO`) key outline, 3.4:1 on board |
| `--text` | `#e8eff9` | Body, band text (≥ 5.0:1 on every band) |
| `--text-muted` | `#91a4bc` | Secondary text, inherited legends (6.4:1 panel, 6.4:1 inherited keycap). Never on bands (4.2:1) |
| `--accent` | `#70b7ff` | Focus rings, links, active rail item (7.7:1 panel) |
| `--primary-fill` / `--primary-ink` | `#a9d4ff` / `#0d1d31` | The single primary button (11.0:1) |
| `--level-shift` | `#ffcf85` | Shift output legend (original amber) |
| `--level-altgr` | `#71e3cd` | AltGr output legend (original teal) |
| `--status-unknown` | `#ffbd68` | Unknown keycode border and tag (8.7:1 on keycap) |
| `--status-danger` | `#ff7a85` | Errors (6.5:1 panel) |
| `--status-warning` | `#f2c14e` | Warnings (9.7:1 panel) |
| `--status-success` | `#86dbbd` | Saved state (10.0:1 panel) |
| `--layer-0` … `--layer-7` | `#70b7ff #4dd8cc #83d38a #ffbd68 #ba9bff #ffe071 #ff8f9c #9daabd` | Original layer palette, owner-editable per layer |

Derived per layer (computed in code from `--layer-n`, not hand-typed): keycap tint for layer keys = layer colour at 14 % over `--surface-app`; layer hold band = layer colour at 30 % over the tint. Band text on layer bands is always `--text` (layer colour on its own band is only 3.5–4.5:1).

Status never relies on colour alone: Unknown also has a dotted border and an "Unknown" tag, errors carry an icon and text, inherited keys are dashed.

### Typography

- `--font-ui`: `"Atkinson Hyperlegible Next", "Adwaita Sans", "DejaVu Sans", sans-serif`. Weights 400, 600, 700, subsets latin and latin-ext (covers õ ä ö ü š ž € and the dead-key accents).
- `--font-code`: `"Atkinson Hyperlegible Mono", "DejaVu Sans Mono", monospace`. Weight 400, latin.
- Source: Google Fonts builds via Fontsource (OFL-1.1), measured 7–13 KB per woff2 file, about 90 KB total. Embedded as base64 `data:` URLs in `assets/fonts.css` because Chromium refuses `file://` font loads; verified loading under `file://` in headless Chromium 153 and Firefox 155 on 2026-10-25. The OFL text ships beside it.
- UI scale (px, classical scale): 12 shortcut hints only; 14 dense controls and list rows; 16 body and form text; 18 section headings; 21 view titles; 26 sheet layer title at 1×. Line height 1.45 for body, 1.2 for headings. Body measure ≤ 65ch.
- Weights: 400 body, 600 labels and legends, 700 hold bands and tags.
- Letters on keys are shown as capitals (keycap convention, same as the Kyria's own right-hand screen). See question D1.

### Space, shape, elevation, motion

- Spacing: 4, 8, 12, 16, 24, 32, 48 px.
- Radii by hierarchy, not one radius everywhere: keycap 0.10 k; controls 8 px; panels 14 px; layer tabs 8 px; no pills.
- Elevation: no drop shadows on panels. Popovers and dialogs only: `0 12px 32px rgb(0 0 0 / .45)` plus a `--line-control` outline.
- Motion: selection ring 120 ms ease-out (opacity and stroke only); popover 140 ms opacity plus 4 px translate; assigned-key confirmation pulse 180 ms on the changed keycap's outline. `prefers-reduced-motion: reduce` removes travel and the pulse. No load animations. No `transition: all`.
- Icons: Material Symbols Rounded, the project's existing icon system (`fonts/MaterialSymbolsRounded.ttf`, codepoints in `tools/generate_smooth.py` `SYMBOLS`, the same symbols the keyboard's screen draws). Shipped as SVG path data from Google's official per-icon SVGs (`google/material-design-icons`, Apache-2.0) in `assets/icons.js`, drawn as inline SVG on screen and `Path2D` on canvas. No second icon library.

## 5. Keycap legend system

One layout function computes legend runs for a key action at keycap size `k`. The SVG board and the canvas sheet draw the same runs, so the board is a faithful preview of the sheet.

### Anatomy (fractions of keycap side k)

```
 ┌──────────────────────────────┐  radius 0.10k, padding 0.06k
 │ !  ← Shift output      @ ←───┼── AltGr output (essentials, see 6)
 │    0.25k, 600, amber   0.25k │   teal; top corners
 │                              │
 │             2   ← main legend│   single glyph 0.44k, 600,
 │                              │   centred on its ink box
 │                              │   words: fit 0.32k→0.20k
 ├──────────────────────────────┤
 │  ⇧ Shift   ← hold band 0.27k │   only ever "when held"
 └──────────────────────────────┘   text 0.21k→0.20k, 700, --text
```

Other zones, used only when that kind needs them:

- Top tag (top-left, 0.21 k→0.20 k, 700, muted): context that changes what the main legend means, such as `Super +`, `M0`, `TD0`, `Toggle`, `Unknown`. Never on the same key as a Shift corner legend, since a key that carries a tag has no Shift level of its own.
- Bottom qualifier (bottom-right, 0.20 k, 700, muted, no fill): `keypad`, `↓ Name` on transparent keys. Never on a key with a hold band.
- Icon: main 0.34 k with a 0.20 k word under it; band icon 0.22 k.

Hard minimum: **no text on any keycap smaller than 0.20 k** (original 0.125 k). Corner legends go from 0.159 k to 0.25 k, single main glyphs from at most 0.386 k to 0.44 k.

### Fit cascade (measured with `measureText` in the bundled font)

1. Try the zone's preferred size, step down by 0.5 px to the zone minimum.
2. Words: split at spaces, `+` or `-` into two lines at 0.26 k→0.20 k.
3. Abbreviation table (from the copy deck: `Backspace→Bksp`, `Print Screen→PrtSc`, `Page Down→PgDn`, `Caps Lock→Caps`, layer name → `Layer n` → `Ln`, `Ctrl + Shift` → `Ctrl ⇧`).
4. Still too long: ellipsis at minimum size, and the full text appears in the sheet's notes and in the key's accessible name. Text never overflows its zone and never goes below the minimum.

Prototype check (scratch, 2026-10-25): the anatomy above rendered in headless Chromium at k = 62 and k = 96 with the bundled fonts. Every run fitted its zone except two placements that the zone rules above now forbid (tag wider than half width, qualifier in a half-width corner).

### Kinds

| Kind (example code) | Main | Top-left | Top-right | Bottom |
|---|---|---|---|---|
| Character key (`KC_2`) | `2` | Shift output `"` unless it is just the capital letter | AltGr output `@` | — |
| Dead key (`KC_GRAVE`) | accent over a dotted circle `◌̌` | Shift dead accent `~` | AltGr `•` | — |
| Shifted or AltGr character (`LSFT(KC_1)`, `RALT(KC_S)`) | the character typed: `!`, `š` | — | — | — |
| Shortcut (`LGUI(KC_6)`, `LCTL(KC_C)`) | key legend `6`, `C` | tag `Super +`, `Ctrl +` | — | — |
| Mod-tap (`LSFT_T(KC_A)`) | `A` | Shift output if any | AltGr if any | band `⇧ Shift` |
| Layer-tap (`LT(2,KC_SPC)`) | icon + `Space` | — | — | layer band `Number` in that layer's band colour |
| Hold layer (`MO(6)`) | layer name `Function` in layer colour, keycap tinted | — | — | layer band `hold 6` |
| Other layer actions (`TG TO OSL TT DF`, `LM`) | layer name | tag `Toggle`, `Switch to`, `Next key`, `Tap-toggle`, `Default`, `Hold + Ctrl` | — | qualifier `layer n` |
| One-shot modifier (`OSM(MOD_LSFT)`) | icon + `Shift` | tag `One-shot` | — | — |
| Modifier key (`KC_LSFT`, `KC_RALT`) | icon + `Shift`, `AltGr` | — | — | qualifier `right` for right-hand Ctrl, Shift, Super |
| Action key (`KC_ENT KC_BSPC KC_TAB` arrows, `HOME`…) | icon + short word | — | — | — |
| Function key (`KC_F12`) | `F12` | — | — | — |
| Keypad (`KC_KP_7`) | `7` | — | — | qualifier `keypad` |
| Media, mouse (`KC_VOLU`, `KC_MS_U`) | icon + `Vol +`, `Mouse ↑` | — | — | — |
| Macro (`M0`) | the Estonian text it types (`ñ`), else `Macro 3` | tag `M0` | — | — |
| Tap dance (`TD(0)`) | on-tap output, or muted `—` when tap does nothing | tag `TD0` | double-tap output | band = on-hold output |
| Transparent (`KC_TRNS`) | resolved legend in `--text-muted`, dashed keycap | resolved | resolved | qualifier `↓ Name` only when the source differs from the layer's usual source |
| Disabled (`KC_NO`) | empty keycap, `--keycap-empty-line` outline | — | — | — |
| Known special (`QK_BOOT CW_TOGG QK_REPEAT_KEY USER00 RGB_TOG`) | short name: `Boot`, `Caps Word`, `Repeat`, `User 0`, `RGB` | — | — | — |
| **Unknown** (anything the keycode contract cannot describe) | the raw code in `--font-code` 0.20 k, wrapped at `_`, `(` or `,`, at most two lines, then `…` | tag `Unknown` in `--status-unknown` | — | — ; dotted amber border |

Unknown is never blank, never guessed, and is kept verbatim in the file. The full code always appears in the composer, the key's accessible name and the sheet's notes.

The owner's per-key image label (original feature, kept) replaces the main legend only; the other zones stay automatic.

## 6. Estonian output rules

- Output data comes from the same source as the firmware's `layout_tables.h` Estonian block: libxkbcommon `ee` basic (with dead keys), levels plain, Shift, AltGr, Shift+AltGr, keypad with Num Lock on. The studio ships a generated copy; it is never hand-typed. The architect owns the generator and data contract.
- Dead keys (caron, tilde, acute, grave, diaeresis, ring, circumflex, double acute, breve, dot above, cedilla, macron) render as the accent over a dotted circle wherever they appear: board, picker, sheet.
- AltGr corner legends on plain character keys are limited to Estonian essentials (see question D2): every AltGr output on the number row and punctuation keys, and `š ž €` on S, Z, E. The picker's AltGr mode always shows every AltGr output, and any key that explicitly sends an AltGr character shows that character as its main legend.
- Macros: Vial text steps are sent as US key positions. The studio shows what that text actually types on the Estonian computer (`~n` types `ñ` because `~` is the dead tilde). Characters that cannot be typed are listed as a warning on the macro, never silently dropped.
- Modifier names: Ctrl, Shift, Alt, AltGr, Super (see question D6).

## 7. Workspace

Browser `file://` app, no server, no build. Single page with hash routes per view (`#/keymap`, `#/macros`, …) so the browser back button works.

### Shell at 1440 × 900

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Kyria Keymap Studio   kriskyria.vil  Edited since export     ↶  ↷   ⚠ 2 issues   Open .vil…  [Export .vil] │ 56, sticky
├───────────────┬─────────────────────────────────────────────────────────────────────────────┤
│ ▦ Keymap      │ [0 Base][1 Special][2 Number][3 Symbol][4 Navi][5 Media][6 Function][7 Spare] ⚙ │ 48
│ ▶ Macros    1 │                                  Reached by holding Number (left thumb)      │
│ ◇ Tap dance 1 │ ┌──────────────────────────── board, k = 64 ────────────────────────────┐   │
│ ⊕ Combos    1 │ │   ▢ ▢ ▢ ▢ ▢ ▢    ◯ Left encoder   ◯ Right encoder    ▢ ▢ ▢ ▢ ▢ ▢   │   │ ≈ 400
│ ⇄ Overrides   │ │   ▢ ▢ ▢ ▢ ▢ ▢    ◯ Left module    ◯ Right module     ▢ ▢ ▢ ▢ ▢ ▢   │   │
│ ↻ Alt repeat  │ │   ▢ ▢ ▢ ▢ ▢ ▢ ▢                                    ▢ ▢ ▢ ▢ ▢ ▢ ▢ │   │
│ ⚙ Settings    │ │          ▢ ▢ ◇ ◇ ◇ ◇ ◇                      ◇ ◇ ◇ ◇ ◇ ▢ ▢          │   │
│ ▣ Reference   │ └──────────────────────────────────────────────────────────────────────┘   │
│   sheet       │ ┌ Left home row, pinky ─────────┐ ┌ [Find a character or action, e.g. @ or volume] ┐ │
│               │ │ composer, 384 px              │ │ Keyboard  Layers  Media and mouse  Macros …  │ │ ≥ 320
│               │ │                               │ │ Plain  Shift  AltGr                           │ │
│               │ │                               │ │ Estonian ISO keyboard + nav + numpad          │ │
│               │ └───────────────────────────────┘ └──────────────────────────────────────────────┘ │
├───────────────┴─────────────────────────────────────────────────────────────────────────────┤
│ Changed Base, left home row pinky to "A, hold Shift". Ctrl+Z undoes it.     Saved in this browser │ 32, sticky
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Rail 200 px with icon + label; the count after a label is entries in use, which tells the owner where content is. Below 1360 px wide the rail collapses to 64 px icons with tooltips and accessible names.
- Board: `k = clamp(60, floor(availableWidth / 17 × 0.92), 84)` px, pitch `k / 0.92` (original ratio 44/48). Geometry is the original 50-key array (authoritative); thumb keys keep their rotation and their legends rotate with them (question D7). When the container is narrower than 17 pitches at k = 60, the board scrolls horizontally inside its own frame with an edge shadow; the page never scrolls sideways.
- Encoder dials sit in the empty region between the halves (≈ 4.8 × 3.1 u). Each dial: name from the bundled definition (`Soldered encoder left`, `Halcyon module left`, …; `Encoder n` when the definition has no name), two mini keycaps at 0.62 k for counter-clockwise and clockwise. When the file's layout options disable that encoder, the dial shows "Off in layout options" in muted text and stays editable, because Vial keeps the mapping. Option-dependent matrix keys (rows 4 and 9) appear as mini keycaps beside the dial of their option group only when the option is on.
- Layer bar: tabs (`role=tablist`) with a 4 px left bar in the layer colour, number and name; active tab tinted. The gear opens "Layer settings": name (≤ 35 characters) and colour (8 palette swatches as a radio group plus a custom colour input). The meta line states how the layer is reached ("Reached by holding Number (left thumb)", derived from layer keys pointing here) and, for layers with transparent keys, "Dashed keys fall through to Base".
- Page scroll at 900 px tall is acceptable; the top bar and status line stay sticky. At 1080 px tall everything fits.

### Composer (selected key editor)

Changes apply immediately as one undoable command each (Vial behaviour); there is no Apply button.

```
┌ Left home row, pinky        matrix 1,5 ┐
│ What it does  [Key][Layer][Macro][Tap dance][Other] │
│                                                    │
│ Tap      ┌──────┐  A   (pick below)                │
│          └──────┘                                  │
│ Hold modifiers while tapping                       │
│   [Ctrl] [Shift] [Alt] [AltGr] [Super]  ☐ right hand│
│ When held  (•) Nothing  ( ) Modifier [Shift ▾]     │
│            ( ) Layer [2 Number ▾]                  │
│ ────────────────────────────────────────────       │
│ Vial keycode  [LSFT_T(KC_A)           ]            │
│ Label on reference sheet  [            ]           │
│   Replaces the automatic legend. Not saved in .vil │
└────────────────────────────────────────────────────┘
```

- Header names the position from geometry: half, row (top, home, bottom, thumb), finger column (outer pinky, pinky, ring, middle, index, inner index) or thumb position counted from outside; matrix coordinates as muted secondary text.
- Key: Tap well is the active assignment slot (accent outline); the picker assigns into the active slot. Modifier toggles wrap the tap (`LCTL(…)`, `RALT(…)`); "right hand" switches to right-hand variants. When held: mod-tap or layer-tap. If the tap is not a basic key, the hold controls stay visible and explain: "Hold actions need a basic key as the tap. "!" is Shift + 1, so it can't also have a hold action."
- Layer: target layer select (names and colours), action radio: Hold (MO), Toggle (TG), Switch to (TO), Next key only (OSL), Hold or tap to toggle (TT), Set default (DF), Hold with modifiers (LM + modifier toggles).
- Macro and Tap dance: select by index with the summary ("M0 types ñ", "TD0: hold Super"), plus "Edit macro" / "Edit tap dance" links into the views.
- Other: the action chosen from a non-keyboard picker tab, with its plain description ("Boot: restarts the keyboard into firmware update mode").
- Vial keycode: editable; Enter commits. Syntax error: "Keycodes look like KC_A, MO(2) or LSFT_T(KC_A)." Valid but unrecognised: accepted, with "The studio doesn't recognise this keycode. It is kept exactly as typed and shown as Unknown."

### Picker

- Search field first: matches characters (reverse lookup through the Estonian table: `@` → "AltGr + 2"), names ("enter", "volume", "layer 2", "print") and raw codes. Results are buttons that assign into the active slot.
- Tabs: Keyboard, Layers, Media and mouse, Macros, Tap dances, Quantum, Lighting (only when the definition declares lighting), User. The original's ISO/JIS tab is dropped; its contents are on the Estonian keyboard and in search.
- Keyboard tab: full Estonian ISO keyboard with navigation cluster and numpad, keys 44 px tall when space allows (container query), never under 36 px. Mode segmented control Plain, Shift, AltGr. Plain mode shows all three levels per key (Shift top-left, AltGr top-right) and assigns the plain key; Shift and AltGr modes show only that level and assign `LSFT(…)` or `RALT(…)`. Keys with no output in a mode show no legend and are `aria-disabled` with the reason in the tooltip.
- No slot selected: "Select a key on the board to assign." Picker buttons stay operable and show that message in the status line instead of failing silently.

## 8. Feature views

All are master-detail: list on the left (320 px, rows 40 px, selected row `--surface-selected`, unused entries collapsed behind "Show 27 unused"), detail on the right. Every detail shows "Used by" (layers and key positions referencing the entry) with links that select the key on the board. Entry counts come from the imported file; the studio never adds entries the file does not have.

- **Macros**: summary per row ("M0 types ñ", "M3 Ctrl + C, then Ctrl + V", "M5 empty"). Detail: numbered steps (a real sequence) of Text, Tap, Press, Release, Delay; add buttons per type, move up and down buttons, delete. Text steps show "Types on your Estonian computer:" with the simulated output and highlight characters that differ from what was written. "Add Estonian text" converts typed Estonian text into the key taps that produce it, including dead-key sequences. Memory line: "Uses 3 bytes" plus "The keyboard's macro memory limit isn't stored in .vil files" unless the capability profile knows the limit.
- **Tap dance**: four key wells (On tap, On hold, Double tap, Tap then hold) plus "Tapping term" in ms. Row summary: "TD0: hold Super".
- **Combos**: up to four input wells and one output well. A mini board (non-interactive, k ≈ 24, legends hidden except highlighted keys) shows where the input keys sit on each layer. Warnings: fewer than two inputs, output empty ("Combo 0 does nothing: its output is empty."), duplicate input sets.
- **Key overrides**: sentence summary ("Shift + Backspace sends Delete on all layers"). Detail: enabled switch; trigger modifiers (8 toggles, LCtrl … RGui, labelled Ctrl, Shift, Alt, AltGr, Super per side) and trigger key; replacement; layers as toggles for the file's layers, with "Layers 8–15 stay as in the file" when hidden bits are set; negative and suppressed modifiers; the six Vial options in plain language from vial-gui `editor/key_override.py`.
- **Alt repeat**: enabled, last key, alt key, allowed modifiers, the three options. Present because the file contains `alt_repeat_key` (question for the primary in section 15).
- **Settings**: Vial's QMK settings groups (Magic, Grave Escape, Tap-Hold, Auto Shift, Combo, One Shot Keys, Mouse keys) with Vial's titles, showing only `qsid` values present in the file; bit fields as checkboxes, integers as number inputs with min, max and "ms" where the setting is a time. "Layout options" group from the bundled definition labels (`Soldered encoder left`, `Halcyon module left: None or Encoder`, …), editing `layout_options`. A file without settings shows "This file has no QMK settings." and nothing else.
- **Reference sheet**: options column (300 px) and a live canvas preview scaled to fit, with "Show at 100 %" to inspect real pixel size. Options: Sheet: All layers or This layer; Include layers that do nothing (default off); Save PNG. Errors from the renderer appear here.

## 9. Reference sheet (PNG)

Rendered with Canvas 2D directly from the shared legend runs (no SVG-to-image step), after `document.fonts.load` confirms every weight used. Exported at 2× device scale.

### This layer (16:9)

```
1920 × 1080 at 1×, 3840 × 2160 PNG
┌──────────────────────────────────────────────────────────────────────────────┐ 48 margin
│ 6  Function                                  Kyria rev4, Estonian layout     │ title 26/700 in layer colour
│ Reached by holding Function (right thumb)     kriskyria.vil, 25 Oct 2026      │ 16/400 muted
│                                                                              │
│          board, k = 96, pitch 104, ≈ 1774 × 600                              │
│                                                                              │
│ On this layer                              How to read                        │
│ M0 types ñ                                  [⇧ sample] Shift  [@ sample] AltGr │
│ TD0: tap nothing, hold Super (200 ms)       [band] when held  [dashed] falls  │
│ Unknown code <raw code> at <position>       through  [dotted] unknown code    │
└──────────────────────────────────────────────────────────────────────────────┘
```

At k = 96 the smallest text is 19.2 px at 1× (38.4 px in the PNG). Fitted to a 1920 × 1080 screen, the hold band text stays ≥ 19 px; the original's was 3 px. When notes exceed the space, the sheet grows taller rather than shrinking text.

### All layers (one PNG)

Two columns of layer panels at k = 64 (pitch ≈ 70), panel ≈ 1260 × 500 at 1×, plus one panel for "How to read" and the combo, macro and tap-dance notes. Layers that do nothing (all transparent or disabled) are left out unless included. Seven layers: ≈ 2600 × 2100 at 1×, ≈ 5200 × 4200 PNG. Smallest text 12.8 px at 1×. Relative to sheet width that is 1.7 × the original's hold text: 1.6 × from the text-to-key ratio, 1.07 × from tighter packing.

File names: `kyria-<layer-name>.png`, `kyria-all-layers.png`, slugified ASCII.

## 10. Flows and states

| Flow | States and copy |
|---|---|
| First run | Loads the bundled copy of `kriskyria.vil` (the original's embedded default). Document chip: "Built-in kriskyria.vil". |
| Reload | Restores the autosaved document, layer, selection and view. |
| Open .vil | Picker limited to `.vil,.json`. Errors leave the current document untouched: "Choose a .vil file under 2 MB." / "This file isn't valid JSON, so it can't be a Vial layout. Nothing was changed." / "This layout isn't for the Kyria's 10 × 7 matrix. Nothing was changed." Unsaved edits first: dialog "Replace the current layout? Edits since your last export will be lost." Buttons: "Export first", "Replace", "Cancel". Success: "Opened kriskyria.vil." Preserved but unedited fields: info line "Kept 2 fields the studio doesn't edit; they are exported unchanged." UID differs from the current document: dialog naming both UIDs (exact digits), "Open anyway" or "Cancel". |
| Export .vil | Errors block: "Fix 1 error before exporting." with the issues drawer opened. Warnings do not block. Success: "Exported kriskyria-edited.vil." The chip changes to "Matches last export". Shortcut Ctrl+S. |
| Edit | Every change is one undo step with a label; status line names it: "Changed Base, left home row pinky to "A, hold Shift". Ctrl+Z undoes it." Undo and redo buttons carry the label in their accessible name. |
| Issues | Top-bar button only when issues exist ("2 issues"). Drawer lists errors then warnings, each with "Show", which navigates and selects the target. |
| Autosave | Status line right: "Saved in this browser". Failure is persistent, not a toast: banner "This browser isn't saving your changes (storage is full or blocked). Export your .vil to keep them." |
| Revert | File menu "Revert to opened file…" with confirmation naming the file. |
| PNG export | Pending: Save PNG button busy, label "Saving…". Fonts not loaded: "The sheet fonts didn't load, so the image wasn't saved. Reload the page and try again." Canvas too large: "Your browser couldn't create an image this large. Try "This layer"." Success: "Saved kyria-all-layers.png." |
| Empty feature list | Never shown empty: entry counts come from the file. A file without that feature: "This file has no tap dances." |

No keyboard connection UI exists: no connect button, no device status (CONSTRAINT-1).

## 11. Accessibility and keyboard

- Landmarks: header (top bar), nav (rail), main (view), status line `role=status` (`aria-live=polite`); errors use `role=alert`. Skip link "Skip to keyboard".
- Board: a single tab stop with roving focus. Each key is `role=button` with `aria-pressed` for selection and an accessible name built from the legend runs ("A, hold Shift. Left home row, pinky"). Arrow keys move to the nearest key in that direction by geometry; Enter or Space selects; Escape clears selection; Delete sets Disabled; Ctrl+C and Ctrl+V copy and paste a key action; Page Up and Page Down switch layers.
- Global: Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y, Ctrl+O open, Ctrl+S export, Ctrl+F focus picker search, `?` opens the shortcut list. Shortcuts never fire while typing in a field.
- Tabs (layer bar, picker) follow the ARIA tabs pattern; segmented controls are radio groups; dialogs use native `<dialog>` with `showModal()` (inert background, Escape closes, focus restored).
- Focus: `:focus-visible` 2 px `--accent` outline at 2 px offset; on keycaps a 3 px white inner stroke plus accent halo (≥ 13:1 against every keycap tint). Selection is shown by stroke and `aria-pressed`, never by colour alone.
- Targets: ≥ 24 × 24 px everywhere; picker keys ≥ 36 px; board keys ≥ 60 px.
- Forced colours: keycaps use `CanvasText` outlines, selection uses `Highlight`; legend colours fall back to system colours.
- 200 % zoom: layout reflows to the stacked narrow layout; board scrolls inside its frame.
- All user-visible strings live in one copy deck (`ui/strings.js`), plurals via functions, so the UI language question (D5) costs one file.

## 12. What the UI needs from the core (for `architecture.md`)

The UI never touches file text, storage or a transport directly; it reads a document snapshot and sends commands. This is what keeps a future keyboard connection or Vial replacement possible without UI changes (CONSTRAINT-5).

1. Document snapshot: layer count; keycode at (layer, row, col); encoder (layer, index, direction); macros; tap dances; combos; key overrides; alt repeat keys; QMK settings present (qsid → value); `layout_options`; UID as an exact string (the bundled file's UID `10669769700359951850` exceeds 2^53 and is corrupted by plain `JSON.parse`); list of preserved fields the studio does not edit.
2. Commands with a human label for undo, applied atomically; change notifications.
3. History: undo, redo, availability and labels.
4. Keycode model: parse code → structured action of the kinds in section 5, or `unknown` with the raw code; serialize back; rule queries ("can this tap have a hold action").
5. Estonian output: levels for a basic key; output of key + modifiers including dead-key status; reverse lookup character → key + modifiers; typed-output simulation for macro steps with untypeable characters reported.
6. Transparency resolver: (layer, row, col) → resolved code and source layer, with the documented rule; plus "how is this layer reached" from layer keys.
7. Capability profile: entry counts per feature, macro memory limit when known, QMK settings definitions, layout option labels, encoder names, physical geometry (50 keys plus option-dependent keys), lighting presence. Unknown capabilities are explicit `unknown`, never defaults.
8. Validation issues: severity, feature, index, message parts, navigation target; export gating on errors.
9. Codec: import text → document and warnings, or a typed error; export → text with exact UID and preserved fields.
10. Persistence: autosave result events (saved, failed with reason); studio metadata (layer names, colours, sheet labels) stored separately from the document.
11. Source descriptor: `{type: "file", name, openedAt, exportedAt}`; the chip renders only this. A later `{type: "device"}` source plugs in behind it.

## 13. Files and implementation plan

App root: `keymap-studio/` (brief GOAL-1). Classic `<script>` files in a fixed order on one global namespace (name per `architecture.md`); no modules, no fetch, so it runs from `file://` in Gecko (owner's default browser is Zen) and Chromium. Core file names and the namespace come from `architecture.md`; these are the UI-owned files:

| File | Content |
|---|---|
| `keymap-studio/index.html` | Shell markup, landmarks, script and style order |
| `keymap-studio/styles/tokens.css` | Section 4 tokens; the only place with raw colours |
| `keymap-studio/styles/app.css` | Layers: reset, layout, components, utilities |
| `keymap-studio/assets/fonts.css`, `assets/OFL.txt` | Base64 `@font-face` for Atkinson Hyperlegible Next 400/600/700 latin + latin-ext and Mono 400 latin |
| `keymap-studio/assets/icons.js` | Material Symbols Rounded path data, names matching `tools/generate_smooth.py` `SYMBOLS` plus rail icons; licence via `fonts/MaterialSymbols-LICENSE.txt` |
| `keymap-studio/ui/strings.js` | Copy deck and abbreviation table |
| `keymap-studio/ui/legend.js` | Legend layout: action + k → runs, fit cascade |
| `keymap-studio/ui/keycap-svg.js` | Runs → SVG keycaps (board, mini boards, picker) |
| `keymap-studio/ui/shell.js` | Top bar, rail, routing, status line, issues drawer, dialogs, shortcuts |
| `keymap-studio/ui/board.js` | Board, roving focus, selection, encoder dials, layer bar and settings |
| `keymap-studio/ui/composer.js`, `ui/picker.js` | Section 7 |
| `keymap-studio/ui/macros.js`, `tapdance.js`, `combos.js`, `overrides.js`, `altrepeat.js`, `settings.js` | Section 8 |
| `keymap-studio/ui/sheet.js` | Canvas renderer, both sheet formats, preview view, PNG export |

Ordered visible tasks for Stage 3 (each with its own functional and visual checks):

1. Tokens, fonts, icons, shell and routing, status line, dialogs, shortcut layer.
2. Legend engine and SVG keycaps with the full kinds table, then the board with geometry, focus, selection, inheritance, encoder dials, layer bar. Needs core items 1, 4, 5, 6, 7.
3. Picker with search, then composer. Needs core items 2, 3, 4, 5.
4. Macros, tap dance, combos, key overrides, alt repeat, settings views (independent of each other once 2 exists).
5. Reference sheet view and PNG export. Needs 2.
6. Import, export, issues, autosave failure and revert flows wired to the codec, validation and persistence. Needs core items 8, 9, 10, 11.
7. Narrow and zoomed layouts, forced colours, reduced motion, full self-verification matrix.

Prerequisites that stop a task if missing: the core contracts above, and the generated Estonian table. No visible task fakes them.

## 14. Verification plan

### Installed tooling (inspected 2026-10-25, nothing installed)

- No project harness: no `package.json`; `playwright` and `playwright-cli` are not on PATH.
- Usable library: Playwright 1.63.0 in the npx cache, `/home/kris/.npm/_npx/6bcb61ec6d5aea22/node_modules/playwright`, loaded with `require()` from Node v22.23.1. Its browser revisions are cached in `~/.cache/ms-playwright`: `chromium_headless_shell-1243`, `chromium-1243`, `firefox-1543`. Both Chromium and Firefox launched headless, opened `file://` pages with base64 fonts and the original app, and downloaded its PNG.
- Firefox build 1543 is the closest available proxy for the owner's default browser, Zen (`app.zen_browser.zen`, Gecko); Zen itself is not automated. Chromium is the second engine.
- Accessibility rules: axe-core 4.11.0 at `/home/kris/.local/share/playwright-artifacts/audits/20261009-task26-buy-flow/deps/node_modules/axe-core/axe.min.js`, injected with `page.addScriptTag`; loads in both engines.
- Interactive inspection: `@playwright/cli` 0.1.17 at `/home/kris/.npm/_npx/1e6cc5b018c8a4f1/node_modules/@playwright/cli/playwright-cli.js` (its `chromium-1232` is cached). Newer cached CLI 0.1.22 needs revision 1247, which is not cached.
- PNG inspection: system Python 3.13 with Pillow.
- Risk: npx cache entries are not a pinned install and can be pruned; if absent at verification time the check is INCONCLUSIVE and needs an owner decision, not a substitute install.
- Scratch root for every run: `/tmp/opencode/playwright-audits/<timestamp>-kyria-studio-<slug>/`, deleted afterwards. Headless only, never the owner's desktop.

### Functional checks

Load from `file://` with no console errors and no non-`file:`/`data:`/`blob:` requests; open the bundled file; edit a key through picker, composer and raw field; undo and redo; reload and confirm autosave; export `.vil` and re-import, comparing the full text including the exact UID; each feature editor change round-trips through export; invalid, oversized and wrong-matrix files leave the document unchanged with the specified copy; blocked storage shows the banner; PNG export downloads with the expected pixel size in both formats; Unknown keycode survives export verbatim.

### Visual predicates (both engines, unless noted)

| ID | Predicate |
|---|---|
| AP-1 | Unrotated board keycap width ≥ 60 px at 1280 × 800, ≥ 62 px at 1440 × 900, 84 px at 1920 × 1080 |
| AP-2 | Every legend run's box lies inside its keycap zone (key-local coordinates via `getBBox`), no two runs intersect |
| AP-3 | Computed font size of every keycap run ≥ 0.20 k; corner legends ≥ 0.25 k; single main glyphs 0.44 k (dead-key accents 0.50 k) |
| AP-4 | Text colour pairs from computed styles meet section 4 ratios (≥ 4.5:1 text, ≥ 3:1 control boundaries) |
| AP-5 | Sheet canvas text runs (recorded by wrapping `fillText` in the test page): every run ≥ 0.20 k and measured width ≤ zone width; This layer PNG is 3840 × 2160 unless notes force more height |
| AP-6 | An Unknown code renders the raw code text and the "Unknown" tag; no keycap with a non-`KC_NO` code renders zero text runs |
| AP-7 | `elementFromPoint` at each key centre, including 15°, 30° and 45° thumbs, returns that key |
| AP-8 | No page-level horizontal overflow at 1920, 1440, 1280, 1024, 390 widths; board frame scrolls instead |
| AP-9 | Every focusable control shows a `:focus-visible` outline ≥ 2 px; tab order follows the landmark order; dialogs trap and restore focus |
| AP-10 | axe-core: no serious or critical violations on each view |
| AP-11 | Reduced motion: no transition longer than 0 ms on keycaps; forced colours: keycap outlines visible (Chromium `forcedColors` emulation) |
| AP-12 | Rendered screenshots of every view and both sheets inspected against the wireframes above |

Viewport and state matrix: 1920 × 1080, 1440 × 900, 1280 × 800 (editing targets); 1024 × 768 (supported, board scrolls); 390 × 844 (reflow sanity); 200 % zoom at 1440. States: no selection, key selected, Unknown key, transparent layer, layer key, encoder selected, each feature view with used and unused entries, issues present, storage failure, import error dialog, export blocked, PNG pending and failure. Theme: dark only, plus forced colours.

## 15. Questions

Look and feel, for the owner (each has a default the design already uses):

- D1. Letters on keys and in the sheet: capitals like keycaps and the Kyria's own screen, or lowercase as now? Default: capitals.
- D2. AltGr characters in key corners: Estonian essentials (number row, punctuation, š ž €) or every AltGr character xkb defines (Æ, ß, “, → …)? Default: essentials. The picker always shows all.
- D3. Typeface: bundle Atkinson Hyperlegible Next and Mono (about 90 KB, OFL), or use system fonts? Default: bundle.
- D4. PNG formats: "All layers" in one image and "This layer" at 16:9. Also want every layer as separate images in one go? Default: no (the browser would ask to allow multiple downloads).
- D5. Interface language: English as now, or Estonian? Default: English.
- D6. Name of the Windows/command key: Super (as in the repository README), GUI, or Win? Default: Super.
- D7. Legends on the angled thumb keys: rotated with the key as now, or kept upright? Default: rotated.

For the primary and architect (not look and feel): include the Alt repeat editor because the file contains `alt_repeat_key` and the owner chose full offline editing (default: include); the bundled `kriskyria.vil` has `layout_options` 0 while `backups/live-settings.json` records `0000000f`, which decides whether encoder dials show as on or off.

## 16. Slop diff

| Default | Decision |
|---|---|
| Cream background, serif display, terracotta accent | Not used; brief keeps dark blue |
| Near-black with one acid accent | Not used; eight-colour layer palette is the owner's existing concept |
| SaaS card kit, one radius, soft shadows | Master-detail lists, radius by hierarchy, no panel shadows |
| ALL-CAPS eyebrows, middle-dot meta strings | Removed (`ESTONIAN · KYRIA`) |
| Monospace for small data labels | Only for literal keycodes |
| `→` appended to buttons | None; arrows appear only as key legends |
| Numbered markers | Only on macro steps, which are a real sequence |
| Decorative status dots, emoji | None; rail glyphs in the ASCII sketch stand for Material Symbols icons |
| Hover-scale, fade-in on load, `transition: all` | None |
| Stock tagline | Removed ("Your keys, made memorable.") |

## 17. Sources

- Original app: `/home/kris/Documents/kyria-keymap-studio.html` (read only).
- Estonian output: `firmware/keyboards/splitkb/halcyon/kyria/keymaps/keypress_hlc/layout_tables.h`, generated by `tools/generate_layouts.py` from libxkbcommon; `/usr/share/X11/xkb/symbols/ee`.
- Definition and layout options: `firmware/keyboards/splitkb/halcyon/kyria/keymaps/keypress_hlc/vial.json`, `backups/live-settings.json`.
- Layer names: `host/layer-names.txt` (read only; the main checkout holds the owner's uncommitted edit to it).
- Icon vocabulary: `tools/generate_smooth.py` `SYMBOLS`; per-icon SVGs from https://github.com/google/material-design-icons/tree/master/symbols/web
- Fonts: https://api.fontsource.org/v1/fonts/atkinson-hyperlegible-next and https://api.fontsource.org/v1/fonts/atkinson-hyperlegible-mono (OFL-1.1, built from https://github.com/google/fonts).
- Vial QMK settings: https://github.com/vial-kb/vial-gui/blob/main/src/main/resources/base/qmk_settings.json
- Key override and alt repeat fields and options: https://github.com/vial-kb/vial-gui/blob/main/src/main/python/protocol/key_override.py, https://github.com/vial-kb/vial-gui/blob/main/src/main/python/editor/key_override.py, https://github.com/vial-kb/vial-gui/blob/main/src/main/python/protocol/alt_repeat_key.py
- Macro actions: https://github.com/vial-kb/vial-gui/blob/main/src/main/python/editor/macro_recorder.py

## 18. Failure modes considered

1. Font fails to load under some `file://` policy: legends would re-measure in a fallback font and overflow. Sheet export refuses with the specified error; the board falls back and AP-2 catches overflow in tests.
2. Long owner-chosen layer names (≤ 35 characters): fit cascade ends in `Ln` on keys, full name in the tab and accessible name.
3. Large UID loses precision through `JSON.parse`: flagged to the architect (section 12), verified by the export round-trip check.
4. Very large all-layers canvas on a low-memory browser: caught `toBlob` failure with the "Try This layer" message.
5. Picker click with no selected key: status message, no silent no-op.
6. Transparent key on a layer reached through another layer: resolver contract returns the real source; the qualifier names it when it differs.
