
<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.55.3 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**At the beginning of each conversation in this project, run `backlog instructions overview` before answering or taking action. Re-read it only if you have not read it yet in the current conversation.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

## Testing rules (bounded verification)

- Inner loop: run only the test that covers the changed behavior, using the exact selector for that area (nested AGENTS.md files carry per-project or per-area commands). Never run the full suite during iteration.
- After edits: lint or typecheck edited files only.
- Done = targeted test green + cheapest affected static check green. Never claim success without having run them; do not publish their output.
- Full suite belongs to CI, an explicit owner request, or named high-risk paths (shared, core or protocol code). It is never part of the edit loop.
- Stop conditions: same error twice = change approach; 3 fix attempts on one failure signature = stop, save partial work, report the blocker. Never rerun an unchanged failure. Never rerun after fmt or fix-only changes. A capped or stopped run is failed verification, not done.
- Do not edit tests or CI config to make them pass. System-mutating, end-to-end and installer tests run only in containers or VMs.
- Timeboxes: anything runnable in 1 minute or less is the default check. If a check needs more than 10 minutes, it is a CI job, not an agent job.

## What this project is
Kyria keyboard setup, firmware and host helpers, plus an offline Estonian browser editor in /home/kris/projects/kyria/keymap-studio. The editor exports Vial maps and readable PNG references; it never connects to hardware.

## Terminology
- Vial export: a .vil file imported later using actual Vial; not a firmware flash.

## Repository
https://github.com/fwhskr/kyria-v4-setup.git
