# Keyboard backups

Everything needed to put the keyboard back the way it is.

| File | What | Made by / used by |
| --- | --- | --- |
| `live-keymap.json` | All 8 layers and the macro memory, exactly as stored on the keyboard | `make backup` / `make restore` |
| `live-settings.json` | QMK settings (tapping term and others), tap dances, combos, key overrides, encoder actions, layout options | `make backup` / `make restore` |
| `live-vial-definition.json` | The keyboard's Vial description (matrix and key positions) | reference |
| `*.vil` | Vial exports: *File → Save current layout* in Vial; load them with *File → Load saved layout* | Vial app |
| `splitkb_halcyon_kyria_rev4_vial_hlc_display.uf2` | splitkb.com's original firmware for this keyboard with the display module | flash it to go back to stock |

`kyriav4current.vil` is an older Vial export (July 2026); the `live-*.json`
files are the current state. Put new Vial exports here too and commit them.

`make check-keyboard` shows whether the keyboard still matches these files,
without changing anything. `make restore` writes them back; it asks you to
hold **B** and **J** to unlock Vial and locks it again afterwards.
