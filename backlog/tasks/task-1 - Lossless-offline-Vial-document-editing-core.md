---
id: TASK-1
title: Lossless offline Vial document editing core
status: In Progress
assignee:
  - '@engineer'
created_date: '2026-10-25T18:00:00Z'
updated_date: '2026-10-25T18:10:00Z'
labels: []
dependencies: []
documentation:
  - docs/product/brief.md
  - docs/architecture/studio.md
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Created by Nova 2026-10-25 — CAP-2/3/5 need safe Vial editing without device transport. Implement API-JSON, API-VIL, API-WS from architecture, preserving exact numeric UID and unknown data. Expose all original matrix cells, immutable operations and history.

Parallel plan:
- Files: keymap-studio/src/core/json.js, keymap-studio/src/core/vil.js, keymap-studio/src/core/workspace.js, keymap-studio/src/core/history.js, keymap-studio/src/data/board-kyria.js, keymap-studio/src/data/default-vil.js
- Shared: architecture.md and docs/architecture/studio.md (architect); core keycodes consumed from TASK-2
- Contract: firm architecture API-JSON, API-VIL, API-WS and SCHEMA-DOC/WS; classic KyriaStudio namespace, no DOM/network
- Critical: yes
- Wave: 1
Verification: bounded node behavior/static checks; independent echo against exact committed inputs; targeted core tests, full regression not required. Preserve original default and imports; no device commands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Unedited Vial import/export preserves exact UID and unknown fields; malformed JSON, incompatible matrix and missing required Vial fields produce errors
- [ ] #2 Every supported edit operation is atomic, immutable and count preserving, with working undo/redo and storage recovery
- [ ] #3 Original keymap is bundled without UID rounding; all 60 cells and original geometry remain accessible
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement exclusively assigned files against studio LLA contracts; run bounded self-checks, commit stable inputs; primary integrates and applies required verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created by Nova 2026-10-25 — claimed for approved offline editor; separate native implementation lane.

Created by Nova 2026-10-25 — architecture READY at 9591904 now landed. Addendum: KS.QMK_SETTINGS data from Vial qmk_settings.json, settings widths/bits, vil.layoutOptions.decode/encode high-to-low packing. Core contract unchanged otherwise; missing encoder/options load with issues and block export (E_VIAL_REQUIRED).

Native worker ses_e8bc6801fffef8YGUadiBYxKBl active; branch studio/codec, worktree /tmp/opencode/kyria-studio-codec.

Created by Nova 2026-10-25 — architect confirmed text macros send US-position ASCII. New text actions accept only 0x08,09,0A,1B,20-7E; imported unsafe text preserved with W_MACRO_TEXT_UNSAFE, warning not export blocker. This supplemental validation will be reconciled after initial lane return.
<!-- SECTION:NOTES:END -->
