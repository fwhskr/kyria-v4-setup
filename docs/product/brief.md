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

## Questions
- Q-1: Packaging. Default: standalone HTML. Answer: choose best method; browser operation without issues is the priority (2026-10-25).
- Q-2: Feature scope. Default: full offline editing. Answer: full offline editing (2026-10-25).
