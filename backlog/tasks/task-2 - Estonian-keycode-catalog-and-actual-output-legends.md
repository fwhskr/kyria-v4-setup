---
id: TASK-2
title: Estonian keycode catalog and actual-output legends
status: To Do
assignee:
  - '@general'
created_date: '2026-10-25T18:00:00Z'
labels: []
dependencies: []
documentation:
  - docs/product/brief.md
  - docs/architecture/studio.md
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Created by Nova 2026-10-25 — CAP-1/4: make actual Estonian characters easy to assign and learn rather than exposing only US key names.

Parallel plan:
- Files: keymap-studio/src/core/keycodes.js, keymap-studio/src/core/legend.js, keymap-studio/src/data/estonian.js, keymap-studio/src/data/keycode-catalog.js
- Shared: document shapes from architecture (architect); codec owned by TASK-1
- Contract: API-KC, API-LEG, KS.estonian.output, classic KyriaStudio namespace; canonical KC_NONUS_BSLASH, encoder dir0 CW/dir1 CCW
- Critical: no
- Wave: 1
Verification: bounded Node parse/format/output checks and affected node --check; independent echo against exact commit, full regression not required. Compare Estonian table with existing xkb-generated firmware table, preserve imported raw codes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Normal, Shift, AltGr and Shift+AltGr outputs match the existing Estonian xkb table including dead accents
- [ ] #2 Composed modifiers, mod-tap, layer-tap, layer functions, macros and tap dance parse and render real outputs; invalid typed names are rejected without changing imported unknown codes
- [ ] #3 Legends expose hold behavior, inheritance, macro approximations and unknown fallback honestly
<!-- AC:END -->
