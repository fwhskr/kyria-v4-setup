---
id: TASK-1
title: Lossless offline Vial document editing core
status: In Progress
assignee:
  - '@engineer'
created_date: '2026-10-25T18:00:00Z'
updated_date: '2026-10-25T18:46:00Z'
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

Created by Nova 2026-10-25 — audited initial core e8659c55797f59e52205b30c0afcf20163d634f7, six owned files clean. Worker continued same ses_e8bc6801fffef8YGUadiBYxKBl for explicitly added qmk-settings.js ownership, final macro safety helpers, invalid-required-field export gate. Initial self-checks passed; echo not yet run; not landed.

Created by Nova 2026-10-25 — audited completed codec bceeeb8fe75da0ffabae839ec0328129ade2bbab, seven owned files clean, no unrelated changes. Integration branch studio/integration at /tmp/opencode/kyria-studio-integration includes codec only (not canonical landed). Independent echo ses_e8bb700eeffeksey68PUyMfJ1H active on exact codec revision for available behavior; new-keycode assignment awaits real TASK-2 code, never mock PASS. Delay max65024 verified by worker primary source.

Created by Nova 2026-10-25 — echo ses_e8bb700eeffeksey68PUyMfJ1H completed on frozen bceeeb8: available codec behavior PASS, catalog-dependent new assignments INCONCLUSIVE until integration. Echo noted parser depth/error positions as unpinned; primary retains stronger committed test expectations, engineer continued same session for six JSON failures only. Canonical dirty host/layer-names.txt remains owner change, not a keycode lane.

Created by Nova 2026-10-25 — engineer parser fix8142fbb audited json.js-only diff, clean worktree, targeted37/37 self-check. Final integrated frozen764c32b54007a5a06d07fa86e04abf7a172a4b4d primary make studio-test250PASS0FAIL1 optional owner-file skip. Echo ses_e8bb700eeffeksey68PUyMfJ1H continued for previously pending real-catalog assignments and repaired suite.

Created by Nova 2026-10-25 — integrated echo on frozen764c32b54007a5a06d07fa86e04abf7a172a4b4d PASS incl real-catalog edits and250/0 contract suite; exact source landed locally via merge74a1bc99e430fc44a2c4f5775f47cdd5b87f7bad. Publication awaits finished artist UI/browser/PNG gates as owner requested. No device work.
<!-- SECTION:NOTES:END -->
