# Kyria Keymap Studio

Status: approved scope, 2026-10-25.

## Goals
- GOAL-0 (primary purpose, owner clarification 2026-10-25): Vial lacks an Estonian keymap, making key assignment difficult. Make assignment character-first with actual Estonian outputs, and provide a readable exported reference image the owner can keep on screen while learning to type on the Kyria. These two workflows outrank breadth of Vial-style features. A full Vial replacement is a future direction, not the current delivery target.
- GOAL-1: Improve the owner's browser keymap app in /home/kris/projects/kyria/keymap-studio without modifying the original /home/kris/Documents/kyria-keymap-studio.html.
- GOAL-2: Prepare Vial files offline for later import in actual Vial.

## Users and capabilities
Owner of the Kyria keyboard; existing matrix and physical geometry are authoritative.
- CAP-1 (must): Estonian-only key picker, accurate output legends and complete practical Vial key action composition.
- CAP-2 (must): Lossless Vial import/export, including exact keyboard UID, unknown fields, and existing feature definitions.
- CAP-3 (must): Offline editing of macros, tap dance, combos, key overrides, encoder mappings and settings when supported by the imported file. Do not fabricate device capabilities.
- CAP-4 (must): Readable PNG reference sheets showing real Estonian keystrokes, modifier/hold behavior and transparent-layer inheritance; larger small text, not merely higher pixel resolution.
- CAP-5 (must): Reliable browser operation, local persistence, undo/redo, validation and clear errors.

## Design and platform
Keep the existing dark blue, color-coded keyboard concept; improve hierarchy, workspace usability and accessibility. Browser-only, offline, no required server or build step for use.

## Constraints and non-goals
- CONSTRAINT-1: No keyboard detection, WebHID, flashing, or transmitting to hardware.
- CONSTRAINT-2: Only Estonian layout; no locale switcher.
- CONSTRAINT-3: Preserve original file and unrelated repository modifications, including /home/kris/projects/kyria/host/layer-names.txt.
- CONSTRAINT-4: No claims of device-specific parity where a .vil lacks capability metadata; clearly state limits.
- CONSTRAINT-5: Keep document editing and UI separate from transport/capability discovery so future keyboard connection and eventual Vial replacement are possible. Owner clarification 2026-10-25; no hardware implementation authorized now.
- CONSTRAINT-6: After implementation and successful testing, publish in the existing public repository https://github.com/fwhskr/kyria-v4-setup so others can use it. Owner authorization 2026-10-25. Include browser usage instructions and scope/compatibility limitations; no separate repository or deployment requested.

## Questions
- Q-1: Packaging. Default: standalone HTML. Answer: choose best method; browser operation without issues is the priority (2026-10-25).
- Q-2: Feature scope. Default: full offline editing. Answer: full offline editing (2026-10-25).

## Verified compatibility inputs
Read-only research against Vial GUI main aef8222a2d0429a183b2ed692d5f9efcfd383f08 (2026-10-25): https://github.com/vial-kb/vial-gui/blob/main/src/main/python/protocol/keyboard_comm.py and https://github.com/vial-kb/vial-gui/blob/main/src/main/python/keycodes/keycodes.py.
- Preserve numeric UID 10669769700359951850 lexically; JavaScript Number rounds it. Preserve all other unknown data losslessly too.
- Canonical Estonian ISO less/greater key is KC_NONUS_BSLASH (KC_NUBS alias), not KC_NONUS_BACKSLASH.
- Vial requires layout, encoder_layout, layout_options. Preserve imported values; never silently reset layout options.
- Original geometry draws 50 keys but the file contains 60 editable matrix cells, including module buttons in rows 4/9. Expose those cells honestly without inventing physical geometry.
- Source geometry/capability context: /home/kris/projects/kyria/backups/live-vial-definition.json; original app remains default keymap authority unless an explicit import is performed. No device reads authorized or needed.
- Optional file features: macro action lists; tap_dance 5-tuples; combo 5-tuples; key_override and alt_repeat_key objects; encoder_layout per-layer CW/CCW pairs; integer settings keyed by qsid. Preserve counts and unsupported data; no synthesized device capabilities.
