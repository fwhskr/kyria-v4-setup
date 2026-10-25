---
id: TASK-3
title: Browser editor and readable learning PNG exports
status: In Progress
assignee:
  - '@artist'
created_date: '2026-10-25T18:00:00Z'
updated_date: '2026-10-25T18:57:00Z'
labels: []
dependencies: []
documentation:
  - docs/product/brief.md
  - docs/architecture/studio.md
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Created by Nova 2026-10-25 — CAP-1/3/4/5: replace difficult Estonian assignment and unreadable PNG reference with a practical offline browser editor.

Parallel plan:
- Files: keymap-studio/index.html, keymap-studio/DESIGN.md, keymap-studio/README.md, keymap-studio/styles/, keymap-studio/src/app/
- Shared: core/data contracts from TASK-1 and TASK-2; consume only, final integration waits for their code
- Contract: UI-1..UI-9, API-WS ops, API-KC/LEG, no build/server/network, file:// classic scripts
- Critical: no
- Wave: 1
Verification: artist functional and visual self-checks in installed Chromium and Firefox, direct-file import/edit/export/reload/PNG; inspect PNG at useful screen size, minimum text/keywidth ratio0.19; no echo substitute. Show offline limitations and errors. Separate UI/document model from any future transport; no device code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Open directly in browser and use Estonian character-first key assignment, layers, composer, undo/redo and persistent local edits with clear errors
- [ ] #2 Edit present macros, tap dances, combos, overrides, alt repeat, encoder mappings, layout options and settings; unknown/raw entries stay read-only and preserved
- [ ] #3 Export .vil and readable current/all-layer PNG showing actual Estonian outputs, legible holds/modifiers and supplementary matrix/encoder mappings
- [ ] #4 Functional and visual checks pass with no network dependency; README explains browser use, Vial import and limits for public users
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement exclusively assigned files against studio LLA contracts; run bounded self-checks, commit stable inputs; primary integrates and applies required verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created by Nova 2026-10-25 — claimed for approved offline editor; separate native implementation lane.

Created by Nova 2026-10-25 — READY architecture at 9591904 prioritizes Estonian character-first picker/search and readable typing-learning PNG. Root README entry already written by Nova, no artist ownership there needed. Source code/doc APIs isolate future transport; publication in existing origin authorized after verification.

Native artist ses_e8bd2c3f3ffeIkJJIjITof52zY active in design phase; branch studio/ui, worktree /tmp/opencode/kyria-studio-ui. Continue same session for implementation when design returns.

Native artist ses_e8bd2c3f3ffeIkJJIjITof52zY continued for TASK-3 implementation. Design ee7416f accepted; final design under keymap-studio. UI owns no root README. Artist located cached Playwright Chromium+Firefox; use own functional+visual checks after integrated core.

Created by Nova 2026-10-25 — audited artist UI2af7b9f17ownedfiles/no unintended paths. Initial artist Chromium+Firefox54/54functional each,57/56visual with764c32b copied core; final same session continued to merge landed main and run directly from committed UI worktree. Native ses_e8bd2c3f3ffeIkJJIjITof52zY active; final screenshot/PNG parent audit and public push pending.
<!-- SECTION:NOTES:END -->
