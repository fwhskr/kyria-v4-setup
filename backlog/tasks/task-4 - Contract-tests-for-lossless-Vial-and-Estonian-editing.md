---
id: TASK-4
title: Contract tests for lossless Vial and Estonian editing
status: In Progress
assignee:
  - '@small'
created_date: '2026-10-25T18:00:00Z'
updated_date: '2026-10-25T18:06:00Z'
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
- [ ] #1 Fixtures and tests protect exact UID and Vial-byte roundtrips, malformed input, unknown/raw fields, absent required fields and hostile strings
- [ ] #2 Tests cover immutable operations, atomic batch errors, history bounds, storage validation and all feature schemas
- [ ] #3 Tests independently check Estonian levels/dead keys and canonical keycode/legend behavior; studio-test runs in existing Node without installation
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
<!-- SECTION:NOTES:END -->
