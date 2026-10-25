---
id: TASK-2
title: Estonian keycode catalog and actual-output legends
status: In Progress
assignee:
  - '@general'
created_date: '2026-10-25T18:00:00Z'
updated_date: '2026-10-25T18:53:00Z'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement exclusively assigned files against studio LLA contracts; run bounded self-checks, commit stable inputs; primary integrates and applies required verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created by Nova 2026-10-25 — claimed for approved offline editor; separate native implementation lane.

Created by Nova 2026-10-25 — READY architecture addendum at 9591904: keycodes.isKnown and forCharacter direct/reverse/dead-sequence lookup; character-first UX priority. Encoder0 CW1 CCW. Unknown imported names warn, user typos refused.

Native worker ses_e8bc67fdaffebxmpeaf4JzVeMH active; branch studio/keys, worktree /tmp/opencode/kyria-studio-keys.

Created by Nova 2026-10-25 — architect confirmed text macro ~n types ñ on standard Estonian dead-key layout. US LUT -> Estonian output -> compose; nonASCII/control unsafe imported macro should show approximate ?; no hardcoded macro index.

Created by Nova 2026-10-25 — audited389f0b5 four owned files, clean and no diff whitespace errors. Integrated with codec/tests in c6a4e6842afbc444e09f67f7cec927542f01fb27 on studio/integration (not canonical). Echo ses_e8bb015ebffe4pvAYVdi407BxL active isolated exact revision for keycode/legend behavior. Real xkb dotlessı at HID0x0c ShiftAltGr must not be changed to firmware uppercase displayI.

Created by Nova 2026-10-25 — key echo at c6a4e68 PASS97probes; final corrected tests recheck active same echo ses_e8bb015ebffe4pvAYVdi407BxL on4594bbe. Narrow release-critical compatibility question identified during artifact audit: source comments claim RSA/SAGR/RCS/RCG wrappers accepted, tests author earlier reported no RSA in Vial. Researcher ses_e8bd4da49ffe0PI0txoA41BKHW active exact-upstream function registry check; no speculative change before evidence.

Created by Nova 2026-10-25 — final frozen4594bbe echo115/115PASS0skip, syntax4filesPASS, semantic code identical prior97probe revision (catalog comments only). Narrow upstream wrapper registry compatibility research remains release gate; no task Done until reconciled and final publication.
<!-- SECTION:NOTES:END -->
