---
id: TASK-4
title: Contract tests for lossless Vial and Estonian editing
status: To Do
assignee:
  - '@small'
created_date: '2026-10-25T18:00:00Z'
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
