# Credits and third-party licences

This project's own code (the `keypress_hlc` display and key-mapping code, the
computer helper, tools, tests, scripts and Keymap Studio) is licensed GPL-2.0-or-later.

| Component | Source | Licence |
| --- | --- | --- |
| QMK / Vial firmware (fetched by `setup.sh`, not stored here) | [vial-kb/vial-qmk](https://github.com/vial-kb/vial-qmk) | GPL-2.0-or-later |
| Halcyon modules, `firmware/users/halcyon_modules/` (unchanged) | [splitkb/qmk_userspace](https://github.com/splitkb/qmk_userspace) @ `e0900a55` | GPL-2.0-or-later |
| Keymap base (`config.h`, `keymap.json`, `vial.json`, `halcyon_overrides.c` of `keypress_hlc`) | splitkb's `vermoot_hlc` keymap in the same repository | GPL-2.0-or-later |
| `backups/splitkb_halcyon_kyria_rev4_vial_hlc_display.uf2` | splitkb.com's stock firmware, built from the two repositories above | GPL-2.0-or-later |
| Roboto Mono, `fonts/RobotoMono.ttf` | [googlefonts/RobotoMono](https://github.com/googlefonts/RobotoMono) | SIL Open Font License 1.1 (`fonts/RobotoMono-OFL.txt`) |
| Material Symbols Rounded, `fonts/MaterialSymbolsRounded.ttf` | [google/material-design-icons](https://github.com/google/material-design-icons) | Apache-2.0 (`fonts/MaterialSymbols-LICENSE.txt`) |
| DejaVu Sans Mono, `fonts/DejaVuSansMono.ttf` | [DejaVu fonts](https://dejavu-fonts.github.io/) | Bitstream Vera licence, changes public domain (`fonts/DejaVu-LICENSE.txt`) |
| Keymap Studio keycode catalog and QMK settings data | [vial-kb/vial-gui](https://github.com/vial-kb/vial-gui/tree/aef8222a2d0429a183b2ed692d5f9efcfd383f08) @ `aef8222a`, adapted 2026-10-25 | GPLv2 repository COPYING; `keycodes.py` explicitly GPL-2.0-or-later |

The screen images in `firmware/.../keypress_hlc/smooth_assets.c` are rendered
from these fonts by `tools/generate_smooth.py`. The colours come from the Lumi
Earth palette of the Lumi desktop theme.
