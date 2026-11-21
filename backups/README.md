# Keyboard backups

Everything needed to put the keyboard back the way it is.

| File | What | Made by / used by |
| --- | --- | --- |
| `live-keymap.json` | All 8 layers and the macro memory, exactly as stored on the keyboard | `make backup` / `make restore` |
| `live-settings.json` | QMK settings (tapping term and others), tap dances, combos, key overrides, encoder actions, layout options | `make backup` / `make restore` |
| `live-vial-definition.json` | The keyboard's Vial description (matrix and key positions) | reference |
| `*.vil` | Vial exports: *File → Save current layout* in Vial; load them with *File → Load saved layout* | Vial app |
| `splitkb_halcyon_kyria_rev4_vial_hlc_display.uf2` | splitkb.com's original firmware for this keyboard with the display module | flash it to go back to stock |

## Which file is current

- **Latest committed snapshot: the `live-*.json` files.** `live-keymap.json` and
  `live-settings.json` hold the keyboard's state as of the last `make backup`,
  and `make restore` writes exactly those files back (after checking the Vial
  identity, layer count, macro capacity and dynamic-entry capacities match,
  and refusing to change anything if they do not). `live-vial-definition.json`
  is the Vial description for reference; `make backup` does not replace it.
  The keymap picture at the top of the [main README](../README.md) uses
  `live-keymap.json` for keys and `live-settings.json` for encoder bindings
  and physical layout options.
- **Older: `kyriav4current.vil`.** A Vial export from July 2026. Keep it as a
  record, but do not load it to restore: it predates the current `live-*.json`
  state, so loading it would put back an older layout.
- **To refresh the current files:** run `make backup`, look at the diff, and
  commit the result. The backup scripts replace the files only with
  `--replace` (which `make backup` passes); git keeps the previous version.
- **Your own exports:** keep a separately named Vial export (*File → Save
  current layout*) before changing anything. Review any macro text before
  committing a backup to a public repository.

`make check-keyboard` shows whether the keyboard still matches these files,
without changing anything. `make restore` writes them back; it asks you to
hold **B** and **J** to unlock Vial and locks it again afterwards. Neither
backup, check nor restore ever sends a reset or bootloader command.

## Refresh the keymap picture

Reading the picture does not require any tools. To regenerate it after
refreshing the backup, use Node.js with [Playwright](https://playwright.dev/docs/library)
and its Chromium browser installed. From the repository root:

```sh
node tools/render_keymap.cjs
```

It writes `images/keymap.png` without connecting to a keyboard. If Playwright
is installed elsewhere, set `NODE_PATH` to that installation's `node_modules`
directory. To use an existing Chromium binary, set `CHROMIUM_PATH` to its path.
Check the labels and layer captions before committing the new picture. The
renderer targets this snapshot's Vial/QMK format and rejects unsupported
keycodes or settings; it is not a general backup-to-Vial converter.
