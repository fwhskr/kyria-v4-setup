---
id: TASK-1
title: Lossless offline Vial document editing core
status: To Do
assignee:
  - '@engineer'
created_date: '2026-10-25T18:00:00Z'
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
