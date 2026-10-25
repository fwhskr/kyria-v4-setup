---
id: TASK-4
title: Contract tests for lossless Vial and Estonian editing
status: Done
assignee:
  - '@small'
created_date: '2026-10-25T18:00:00Z'
updated_date: '2026-10-25T19:00:00Z'
labels: []
dependencies: []
documentation:
  - docs/product/brief.md
  - docs/architecture/studio.md
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Created by Nova 2026-10-25 — independently specify CAP-1..5 core regressions while code lanes implement firm APIs.

Parallel plan:
- Files: keymap-studio/tests/, Makefile (studio-test target only)
- Shared: core/data files (TASK-1,TASK-2) read-only
- Contract: architecture VERIFY-1..6, node --test keymap-studio/tests/*.test.js; no dependencies/npm
- Critical: no
- Wave: 1
Verification: tests fail meaningfully before implementation and pass against final core; syntax checks; independent echo validates tests and implementation. Full unrelated firmware regression not required. Do not weaken expected behavior to match implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fixtures and tests protect exact UID and Vial-byte roundtrips, malformed input, unknown/raw fields, absent required fields and hostile strings
- [x] #2 Tests cover immutable operations, atomic batch errors, history bounds, storage validation and all feature schemas
- [x] #3 Tests independently check Estonian levels/dead keys and canonical keycode/legend behavior; studio-test runs in existing Node without installation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement exclusively assigned files against studio LLA contracts; run bounded self-checks, commit stable inputs; primary integrates and applies required verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created by Nova 2026-10-25 — claimed for approved offline editor; separate native implementation lane.

Created by Nova 2026-10-25 — READY architecture at 9591904 adds isKnown/forCharacter, layoutOptions encode/decode, settings width/bit checks; primary will coordinate supplemental assertions after initial contract suite returns.

Native worker ses_e8bc67fb0ffeoz1d3DMN5HzFIg active; branch studio/tests, worktree /tmp/opencode/kyria-studio-tests.

Created by Nova 2026-10-25 — audited tests initial4d4f5dc, only tests and studio-test target changed; expected initial MODULE_NOT_FOUND red and syntax checks pass. Same worker continued for final contract additions/macro safety. Verified type discriminant, KS.board, qsid/settingQsids. Upstream descriptor width is optional with default1; retain real boundary tests. Final integrated behavior and echo still pending.

Created by Nova 2026-10-25 — initial integrated c6a4e68 run251 tests:238PASS11FAIL2 optional-owner-file skips. Parser depth/error-offset defects confirmed direct repro, awaiting codec echo before repair. Tests worker continued for source-backed dotlessı oracle and Python ensure_ascii expectations, not weakened assertions. Current native worker same ses_e8bc67fb0ffeoz1d3DMN5HzFIg.

Created by Nova 2026-10-25 — tests177f679 completed, source-backed oracle fixes and deterministic unknown-qsid fixture audited. Scratch exact production src c6a4e68:251 tests244PASS6JSON parser failures1 optional external-owner-file skip. No assertion weakened; default owner fixture unchanged. Final merge/retest pending verification results.

Created by Nova 2026-10-25 — final committed tests177f679 merged into verification integration with JSON fix8142fbb; make studio-test on764c32b54007a5a06d07fa86e04abf7a172a4b4d250PASS0FAIL1optional external-file skip. Independent integrated echo active; no final criteria checked before gate/landing.

Created by Nova 2026-10-25 — independent echo PASS frozen764c32b5:250PASS0FAIL1optional env-gated external export; oracle corrections independently confirmed xkb/Python. Tests saved and landed locally74a1bc99; final public push after UI completion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered dependency-free Node contract suite and source-backed fixture oracles. Independent echo verified integrated core and tests; final landed2803ead studio-test:251 tests,250 pass,0 fail,1 optional external-file skip. Required owner fixture and backup roundtrips executed; no assertions weakened.
<!-- SECTION:FINAL_SUMMARY:END -->
