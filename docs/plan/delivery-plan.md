# Keymap Studio delivery plan

Source: /home/kris/projects/kyria/docs/product/brief.md; architecture contracts in /home/kris/projects/kyria/docs/architecture/studio.md.

## Wave 1 — contract-first, disjoint ownership
| Task | Specialist | Exclusive files under /home/kris/projects/kyria | Dependencies | Gate |
| --- | --- | --- | --- | --- |
| TASK-1 | engineer | keymap-studio/src/core/{json,vil,workspace,history}.js; keymap-studio/src/data/{board-kyria,default-vil}.js | firm architecture APIs only | bounded behavior/static; echo |
| TASK-2 | general | keymap-studio/src/core/{keycodes,legend}.js; keymap-studio/src/data/{estonian,keycode-catalog}.js | firm architecture APIs only | bounded behavior/static; echo |
| TASK-3 | artist | keymap-studio/index.html, DESIGN.md, README.md, styles/, src/app/ | firm APIs for implementation; final browser check needs TASK-1/2 code | artist functional + visual Chromium/Firefox direct-file checks |
| TASK-4 | small | keymap-studio/tests/; Makefile studio-test target only | firm APIs for authoring; passing run needs TASK-1/2 | node contract tests; echo |

All four lanes are wave 1. No two writers share a worktree or owned file. Architect owns architecture documents; Nova owns canonical brief, plan and CLI-only board updates. Root README discoverability is a final primary documentation edit after public-use app instructions exist.

Critical path: TASK-1 lossless core → stable integrated revision → browser/PNG verification → publication. TASK-2, TASK-3 and TASK-4 overlap it. Land code and tests in dependency-compatible order, rerun tests on integrated inputs, then artist verifies actual integrated UI. Fixes return to original file owner, never a simultaneous writer.

Fast tests: node --check for edited scripts; focused node:test selectors inside each iteration; final make studio-test for the isolated studio subsystem (not the unrelated firmware suite). Core/test gate uses independent echo on exact committed inputs. Test failures are repaired at the contract/root, never assertions weakened to fit code.

Publication: existing owner-authorized origin https://github.com/fwhskr/kyria-v4-setup after successful checks. Preserve unrelated dirty /home/kris/projects/kyria/host/layer-names.txt. No keyboard operations, system configuration, firmware, host-helper or CI edits.

Self-check: four meaningful independent lanes, exact file owners, no implementation dependency disguised as a planning barrier, critical core starts immediately, all CAP-1..5 covered. Final integration needs both core lanes and UI; publication follows verification, not board status alone.
