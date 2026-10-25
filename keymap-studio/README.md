# Kyria Keymap Studio

An offline editor for the keymap of a splitkb.com **Kyria rev4** typed into a computer set to the
**Estonian** keyboard layout. Vial shows US key names; this studio shows what each key really types on
an Estonian computer (õ, ä, ö, ü, š, ž, €, @ …), lets you pick keys by the character you want, and saves a
readable picture of your layers to keep on screen while you learn the keyboard.

It edits Vial `.vil` files. It never connects to the keyboard: you load the exported file in
[Vial](https://get.vial.today/) yourself.

## Open it

1. Download this repository (green **Code** button, then **Download ZIP**) and unpack it, or clone it.
2. Open `keymap-studio/index.html` in Firefox or a Chromium-based browser (Chrome, Edge, Brave).
   Double-clicking the file works; no installation, server, build step or internet connection is needed.

Keep the whole `keymap-studio` folder together: `index.html` loads the files next to it.

## Edit your layout

1. In Vial: **File → Save current layout** to get a `.vil` file of the keyboard as it is now.
2. In the studio: **Open .vil…** and choose that file. (Until you do, the studio shows a built-in example
   layout.)
3. Select a key on the board, then choose what it should type:
   - search for a character (type `õ`, `@` or `€`) or a key name (`enter`, `volume`), or
   - click a key on the Estonian keyboard below, at the Plain, Shift, AltGr or Shift + AltGr level.

   If the key already has a hold action (for example *tap a, hold Shift*), picking a plain character keeps
   the hold.
4. Use the panel on the left of the picker for everything else: modifiers held while tapping, hold actions,
   layer keys, one-shot modifiers, macros, tap dances, or a Vial keycode typed by hand (checked as you type).
5. **Export .vil** downloads the edited file (`<name>-edited.vil`).
6. In Vial: **File → Load saved layout** and choose the exported file. Vial writes it to the keyboard.

Every change can be undone (**Ctrl+Z**, redo with **Ctrl+Shift+Z**). Edits are saved in this browser as you
work, so closing the tab loses nothing; the exported `.vil` file is the real copy.

The other sections edit what the opened file contains: **Macros**, **Tap dance**, **Combos**,
**Key overrides**, **Alt repeat**, the encoders (dials between the board halves), the module buttons below
the board, and in **Settings** the layout options and QMK settings.

## Reference image

**Reference image** (or **Save image** in the header) saves a PNG of one layer, the layers you choose, or all
layers. Every key shows the character it types on an Estonian computer, its Shift and AltGr characters in
the top corners, what it does when held in a band along the bottom, and which keys pass through to the base
layer. A single layer is 1920 × 1080 pixels, so it fills a common screen at 100 % zoom; choose **Sharp (2×)**
for high-resolution screens.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Arrow keys, Enter | Move between keys on the board, select a key |
| Delete | Clear the selected key |
| Ctrl+C, Ctrl+V | Copy and paste a key |
| Page Up, Page Down | Previous or next layer |
| / | Find a character |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo |
| Ctrl+O, Ctrl+S | Open a `.vil`, export the `.vil` |
| ? | List these shortcuts |

## Limits

- **Kyria rev4 only.** Files for other keyboards (another matrix size) are refused. The board drawing,
  encoder names and layout options come from the Kyria rev4 Vial definition in this repository.
- **Estonian layout only.** Legends assume the computer uses the standard Estonian layout (xkb `ee`, with
  dead keys). On any other layout the keys type different characters.
- **Offline file editor.** Nothing is read from or sent to a keyboard. Everything the studio knows comes
  from the opened file, so it can't tell which features or how many entries your keyboard really supports.
- **Vial decides on load.** Vial loads keycodes it doesn't know as `KC_NO` (the studio warns about those),
  drops macros, tap dances, combos and overrides beyond what the keyboard supports, and refuses macros that
  don't fit the keyboard's macro memory (its size is not stored in `.vil` files).
- **Text macros are US-ASCII.** Firmware types macro text through US key positions, so text steps accept
  plain ASCII only. Add Estonian characters to a macro with **Character or key**, which stores the exact
  key taps.
- **Your data stays in the browser.** Layer names, colours and your own key labels are kept in this
  browser's storage and are not written to the `.vil` file. Clearing browser data removes them.
- Everything else in the file, including the exact keyboard UID and fields the studio doesn't edit, is
  exported unchanged. An unedited file exports byte-for-byte identical.

## If something goes wrong

- **A message says files are missing:** open `index.html` from the complete `keymap-studio` folder.
- **"Not saved in this browser":** the browser blocks or has filled local storage. Export your `.vil`
  to keep your work.
- **The keyboard UID was rounded** by another tool: **Settings** offers to restore the exact Kyria UID.

Compatibility baseline: Vial GUI at commit `aef8222a2d0429a183b2ed692d5f9efcfd383f08`, `.vil` files with
Vial protocol 6. Tested in current Firefox and Chromium.
