# Kyria Keymap Studio

An offline editor for the keymap of a splitkb.com **Kyria rev4** typed into a computer set to the
**Estonian** keyboard layout. Vial shows US key names; this studio shows what each key really types on
an Estonian computer (õ, ä, ö, ü, š, ž, €, @ …), lets you pick keys by the character you want, and saves a
readable picture of your layers to keep on screen while you learn the keyboard.

It edits the project's keymap, `layouts/kyria.vil` (a Vial `.vil` file), and **Write to keyboard** puts it on the
connected keyboard. You can still load the `.vil` in [Vial](https://get.vial.today/) instead.

## Open it

1. Download this repository (green **Code** button, then **Download ZIP**) and unpack it, or clone it.
2. From the repository root, run `make studio`, then open http://127.0.0.1:8737/ in Firefox or a Chromium-based browser (Chrome, Edge, Brave). To start it at every login instead, run `make install-studio` once (remove it with `make uninstall-studio`). The server runs only on `127.0.0.1`; no internet connection is needed.

Every change is saved straight into `layouts/kyria.vil` (the keymap, loadable in Vial) and `layouts/kyria.studio.json` (layer names, colours and key labels). Commit those two files with git to keep the change.

Keep the whole `keymap-studio` folder together: `index.html` loads the files next to it.

Opening `keymap-studio/index.html` as a file still shows the studio, but it does not save: a persistent banner says the page was opened as a file and names `make studio` and http://127.0.0.1:8737/.

## Edit your layout

1. Start the studio with `make studio` and open http://127.0.0.1:8737/. It opens the project's `layouts/kyria.vil` (with `layouts/kyria.studio.json` when present). If you want to start from the keyboard as it is now, save it in Vial first (**File → Save current layout**) and replace `layouts/kyria.vil` with that file.
2. **Open .vil…** replaces the opened keymap with another `.vil` file when you want to work from a different file.
3. Select a key on the board, then choose what it should type:
   - search for a character (type `õ`, `@` or `€`) or a key name (`enter`, `volume`), or
   - click a key on the Estonian keyboard below, at the Plain, Shift, AltGr or Shift + AltGr level, or
   - click Esc, Tab, Backspace, Enter, Insert, Delete, Home, End, Page Up, Page Down, Print Screen,
     Scroll Lock, Pause or an arrow in the keys below the Estonian keyboard (search finds them too:
     `ins`, `del`, `pgdn`, `scrlk`, `prtsc`), or
   - for Ctrl, Shift, Alt, AltGr, Super and keys such as F1 or the keypad, open
     **Modifiers and other keys** (or the **Ctrl, Shift, Alt and other modifiers** link beside the levels).
     The levels only choose which character a key types; they don't assign Shift or AltGr themselves.

   If the key already has a hold action (for example *tap a, hold Shift*), picking a plain character keeps
   the hold.
4. Use the panel on the left of the picker for everything else: modifiers held while tapping, hold actions,
   layer keys, one-shot modifiers, macros, tap dances, or a Vial keycode typed by hand (checked as you type).
5. To put it on the keyboard, click **Write to keyboard** in the header (see below). Loading `layouts/kyria.vil`
   in Vial (**File → Load saved layout**) still works too. **Export .vil** downloads a copy
   (`<name>-edited.vil`) if you want one elsewhere.

Every change can be undone (**Ctrl+Z**, redo with **Ctrl+Shift+Z**). Every change is saved into
`layouts/kyria.vil` as you work, so closing the tab loses nothing. Nothing about the keymap is kept in the
browser.

The other sections edit what the opened file contains: **Macros**, **Tap dance**, **Combos**,
**Key overrides**, **Alt repeat**, the encoders (dials between the board halves), the module buttons below
the board, and in **Settings** the layout options and QMK settings.

## Write to keyboard

**Write to keyboard** (header, only at http://127.0.0.1:8737/) copies the open keymap onto the keyboard
plugged in over USB, the same way Vial would, without leaving the studio:

1. Plug the keyboard in normally (not in flash mode). The studio reads it and lists every difference: keys
   by layer and position, macros, tap dances, combos, key overrides, encoders and settings. If nothing
   differs it says so.
2. Click **Write**. Only the differences are written, and each one is read back from the keyboard.
3. Changing **macros** needs Vial's unlock: hold **B** and **J** until the bar fills. Both halves must be
   connected by their cable, because B is on the left half and J on the right. Key, combo and other changes
   don't need it. The keyboard is locked again afterwards.

Before each write the keyboard's current state is saved to `backups/before-write/` (the newest 20 are kept;
the folder is not committed). Each half stores its own keymap and only the half plugged in over USB is
written, so press **Write to keyboard** again after plugging in the other half. Nothing here flashes
firmware or sends a reset.

## Reference image

**Reference image** (or **Save image** in the header) saves one PNG, `kyria-all-layers.png`, with every
layer of the keymap, including layers that do nothing yet, whichever layer you are looking at. Every key
shows the character it types on an Estonian computer, its Shift and AltGr characters in the top corners,
what it does when held in a band along the bottom, and which keys pass through to the base layer. The layers
sit in two columns; for the built-in eight-layer keymap the image is 2590 × 2545 pixels. Choose
**Sharp (2×)** for high-resolution screens; each option shows its size in pixels.

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
- **Keyboard access only on request.** The keyboard is read and written only from the **Write to keyboard**
  dialog; the editor itself works from the file, so it can't tell which features or how many entries your
  keyboard supports until you open that dialog.
- **Vial decides on load.** Vial loads keycodes it doesn't know as `KC_NO` (the studio warns about those),
  drops macros, tap dances, combos and overrides beyond what the keyboard supports, and refuses macros that
  don't fit the keyboard's macro memory (its size is not stored in `.vil` files).
- **Text macros are US-ASCII.** Firmware types macro text through US key positions, so text steps accept
  plain ASCII only. Add Estonian characters to a macro with **Character or key**, which stores the exact
  key taps.
- **Layer names, colours and labels** are kept in `layouts/kyria.studio.json`, next to the keymap. They are
  not written into the `.vil` file, because Vial has no place for them.
- Everything else in the file, including the exact keyboard UID and fields the studio doesn't edit, is
  exported unchanged. An unedited file saved by Vial exports byte-for-byte identical; a file with other
  JSON spacing is rewritten in Vial's formatting (the studio warns), with the same content.

## If something goes wrong

- **A message says files are missing:** open `index.html` from the complete `keymap-studio` folder.
- **"Not saved: this page was opened as a file":** you opened `index.html` directly. Run `make studio` in the
  kyria folder and open http://127.0.0.1:8737/.
- **A save fails or the studio can't reach its server:** the server stopped. Start it again with
  `make studio` (or `make install-studio`); until then edits stay only in the open tab, so export your `.vil`
  if you need to keep them.
- **The keyboard UID was rounded** by another tool: **Settings** offers to restore the exact Kyria UID.

Compatibility baseline: Vial GUI at commit `aef8222a2d0429a183b2ed692d5f9efcfd383f08`, `.vil` files with
Vial protocol 6. Tested in current Firefox and Chromium.
