# Kyria v4 setup

Firmware, tools and backups for a **splitkb.com Halcyon Kyria rev4** with the
Halcyon TFT display on both halves (Vial, QMK).

## Start here

Pick your path; you do not need all three.

| Path | Needs | Do this |
| --- | --- | --- |
| **1. View or learn** | Nothing: no install, no keyboard | Study the keymap picture below, then open Keymap Studio's built-in example ([how to open it](keymap-studio/README.md)) |
| **2. Change or import a layout in Vial** | Vial app, your keyboard | **Save the current layout first** (see [Changing the layout](#changing-the-layout)), then edit in Vial or the studio and load the `.vil` in Vial |
| **3. Optional: helper, backup/restore, build, flash** | Compatible hardware + Linux computer | See [After reinstalling the computer](#after-reinstalling-the-computer) and [Updating the firmware](#updating-the-firmware) |

A layout change in Vial updates the keyboard's saved configuration, not its
firmware. If you flash a new firmware build, be ready to reload your layout.

[![Backed-up keymap, all 8 layers](images/keymap.png)](images/keymap.png)

*All eight layers from the [repository backup](backups/README.md), including
the transparent final layer. Legends assume the standard Estonian layout
(xkb `ee`, with dead keys). The picture is a snapshot, not a live reading
or the firmware's default layout. Click it for full size.*

## What this fits — and what it does not

- **Keyboard:** splitkb.com Halcyon Kyria **rev4** with the Halcyon TFT
  display on both halves. Don't flash this firmware on other models,
  revisions, or module configurations.
- **This repository's backups describe the owner's keyboard.** Your keyboard
  may have a different layout. Compare it read-only first with
  `make check-keyboard`; `make restore` checks the Vial identity and layer
  and macro capacities and refuses to change anything on a mismatch.
- **Computer side (path 3 only):** Linux. The screen helper is a systemd
  user service and its keyboard-language detection needs Hyprland; on other
  desktops the language row stays empty and US characters are shown. The
  keyboard itself types without any of this; only the screen extras need it.

## The screens

![Left and right screens](images/preview-pairs.png)

- **Right screen:** the last key you pressed, large. Letters are always
  capitals; Shift, Ctrl, Alt, Super, Enter, arrows, media keys and so on show
  as symbols. Below it: the modifiers you are holding (`Ctrl Shift`, `AltGr`,
  `Meh`, `Hyper`) and your user name.
- **Left screen:** the current layer number, its name, and the computer's
  keyboard language.
- **Keyboard language aware:** with the computer set to Estonian, the right
  screen shows what is actually typed (Ö, Ä, Ü, Õ, Š, Ž, €, …). US English and
  Estonian (with and without dead keys) are built in.
- Lumi Earth colours on black: sand for the large character, leaf green and
  mist blue for the two text rows. Anti-aliased Roboto Mono and Material
  Symbols, drawn at 16 grey levels.

The firmware cannot know your user name, keyboard language or layer names by
itself; a small helper program on the computer sends them over USB (see
[The computer helper](#the-computer-helper)). Without it the keyboard still
works fully; those rows just stay empty and the screen shows US characters.

![Every screen](images/preview.png)

The images above are rendered from the real firmware drawing code and font
data by `make preview`, not mock-ups.

## What is where

| Path | What |
| --- | --- |
| `images/keymap.png` | All 8 layers of the backed-up layout, drawn from `backups/live-keymap.json`; legends assume standard Estonian |
| `release/kyria_rev4_keypress_display.uf2` | The project's prebuilt firmware for both halves |
| `backups/` | The keyboard's keymap, macros and Vial settings, plus Vial exports and splitkb's stock firmware ([details](backups/README.md)) |
| `host/` | The computer helper, its login service, the device permission rule and `layer-names.txt` |
| `firmware/` | QMK userspace: the `keypress_hlc` keymap and splitkb's Halcyon modules ([details](firmware/README.md)) |
| `tools/` | Asset generators, preview renderer, backup / restore / flash scripts |
| `fonts/` | The fonts the screen images are made from, with their licences |
| `tests/` | Host tests that run the real display code against stubbed QMK |
| `setup.sh` | Fetches pinned tools and sources into `.venv/` and `.deps/` |

## After reinstalling the computer

The keyboard keeps its firmware and layout; only the computer side needs
setting up again. This whole section is optional: the keyboard types with or
without the helper.

1. Install the basics (openSUSE shown; other distributions have the same
   packages): `sudo zypper install git python3 gcc make zstd libhidapi-hidraw0 libxkbcommon0`
2. Get this project and fetch its pinned tools (about 2 GB, a few minutes):
   ```sh
   git clone https://github.com/fwhskr/kyria-v4-setup.git
   cd kyria-v4-setup
   ./setup.sh
   ```
3. Allow your user to talk to the keyboard (asks for your password once):
   `make udev`, and check you are in the `input` group (`groups`).
4. Start the screen helper now and at every login: `make install-helper`

That's all: the screens show your user name, language and layer names again.
Vial (the layout editor app) also needs step 3.

## Changing layer names

Edit `host/layer-names.txt`: one name per line, layer 0 first. The helper
notices the change and updates the screen within seconds; no firmware update
is needed. Up to 9 letters show full size, up to 12 in smaller text.

## Changing the layout

**Save your original layout first.** In [Vial](https://get.vial.today/), use
*File → Save current layout* and keep that `.vil` somewhere safe. Layouts
can contain macro text, so review exports before sharing them publicly.

For **Estonian character-first editing and readable typing-reference images**, use
[Keymap Studio](keymap-studio/README.md). Download this repository, then open
`keymap-studio/index.html` in your browser — no installation, server or keyboard
connection is needed. Export a `.vil` file and load it using Vial when you are
ready to apply your changes: *File → Load saved layout*. The studio does not
flash or write to your keyboard. Keep your original `.vil` for rollback.

Want to copy this setup? The picture is a reference, not an importable file.
The `.vil` in `backups/` is older and does **not** match the picture. See the
[backup guide](backups/README.md) for what can be restored and where.

## Updating the firmware

```sh
make test        # display code and key mapping tests
make firmware    # builds .build/kyria_rev4_keypress_display.uf2
make flash       # then double-press reset on one half; repeat for the other half
make restore     # puts backups/ back; hold B and J when asked
make release     # keep the new firmware as release/… and commit it
```

Each half is flashed separately: plug USB into that half, then double-press
its reset button so the `RPI-RP2` drive appears. `make flash` waits for the
drive, copies the firmware and waits for the keyboard to return. Nothing here
ever sends a reset or bootloader command by itself.

A new firmware build resets the keymap in the keyboard's memory (Vial ties
the stored layout to the build), so restore your layout after flashing: either
`make restore`, or load your `.vil` file in Vial. `make check-keyboard`
compares the keyboard with `backups/` without changing anything.

To go back to splitkb's original firmware, flash
`backups/splitkb_halcyon_kyria_rev4_vial_hlc_display.uf2` the same way
(`.venv/bin/python tools/flash.py backups/splitkb_halcyon_kyria_rev4_vial_hlc_display.uf2`).

## The computer helper

`host/kyria_display_helper.py` runs as a systemd user service
(`make install-helper`, `make uninstall-helper`). It sends:

- your login name, for the right screen;
- the active keyboard language from Hyprland (it follows layout switches
  instantly), which also selects which characters the right screen shows;
- the names in `host/layer-names.txt`.

It talks to the keyboard through Vial's raw HID interface with its own
command (`0x4B`), never touches the keymap or settings, and resends
everything whenever the keyboard is plugged back in. The keyboard keeps the
values only while powered. Language detection needs Hyprland; on other
desktops the language row stays empty and US characters are shown.

## Building from source

`./setup.sh` installs, inside this folder only:

| Dependency | Version |
| --- | --- |
| [Vial QMK](https://github.com/vial-kb/vial-qmk) + submodules | `dd43959a` |
| [QMK toolchain](https://github.com/qmk/qmk_toolchains) (ARM GCC 15.2.0) | `v15.2.0-1`, SHA-256 checked |
| QMK CLI, Pillow, hidapi | pinned in `requirements.txt` |

`make assets` regenerates `smooth_assets.c/h` (every character, symbol and
font) and `layout_tables.h` (what each key types per language, read from the
system's keyboard library) — the output is byte-for-byte reproducible.
`make clangd` writes a `compile_commands.json` for editors.

Adding a keyboard language: add it to `LAYOUTS` in `tools/generate_layouts.py`,
run `make assets test firmware`, and flash.

## Troubleshooting

| Symptom | What it means | Try |
| --- | --- | --- |
| `make backup` / `make restore` / `make check-keyboard` says *Expected exactly one Halcyon Kyria raw HID interface* | No matching device found, or more than one is connected | Connect exactly one Halcyon Kyria rev4 and check that it is detected by Vial |
| `make restore` says *Vial identity mismatch* (or layer, macro or entry capacity mismatch) and *no changes made* | The connected keyboard is not the one these backups were taken from (for example different firmware) | Stop; do not force it. Save that keyboard's own layout first (see [Changing the layout](#changing-the-layout)), and only restore backups that belong to it |
| Helper logs *Keyboard found but not opened* or *Keyboard write failed* | The computer cannot talk to the keyboard | Run `make udev` and check you are in the `input` group (`groups`); the group change needs a new login session |
| Helper logs *Keyboard firmware has no display commands* | The helper's display protocol is not available | If you want the screen extras, confirm the hardware matches before [updating the firmware](#updating-the-firmware); no update is needed to type |
| Screen rows stay empty; US characters shown | The helper is not running, or it cannot detect the language | Start it with `make install-helper`. Without Hyprland the language row stays empty by design; the keyboard still works fully |
| `make flash` says *No RPI-RP2 drive appeared within 2 minutes* | That half never entered its bootloader | Plug USB into the half to update, double-press *its* reset button, and start `make flash` again; flash each half separately |
| `make restore` cannot unlock | The unlock keys are not held | Hold **B** and **J** together on the keyboard until told to release; release them after the keyboard locks again |
| Studio says files are missing, or will not finish in the browser | The studio folder is incomplete, or browser storage is blocked or full | Open `index.html` from the complete `keymap-studio` folder and export your `.vil`; see [Keymap Studio](keymap-studio/README.md) |

## Licence

GPL-2.0-or-later (see `LICENSE`), like QMK and splitkb's modules it builds on.
Fonts keep their own licences; see [NOTICE.md](NOTICE.md) for all credits.
