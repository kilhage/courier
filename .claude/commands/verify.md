---
description: Run the Courier verification loop and explain any failures
---

Run the full verification loop for this repo and report the result.

1. Make sure nothing else is serving port 4173 from a different folder (`lsof -ti tcp:4173`). The Playwright
   config reuses an existing server, so a stale one silently tests the wrong tree.
2. Run `npm run verify`. It prints a pass count per group and exits non-zero on any failure.
3. If everything passes, say so with the group table and stop.
4. If something fails, diagnose before changing code:
   - Read the failing test title. The prefix in brackets is the group, and the checklist or spec id is in the title.
   - Decide whether the **test level** or the **game** is wrong (see "Common test pitfalls" in CLAUDE.md).
   - Fix the root cause, not the symptom. Never weaken a test to make it pass.
5. Re-run `npm run verify` and report the before/after table.
6. If the score improved and the user wants to keep the previous build, offer
   `npm run snapshot -- iter-NN "label"` (freezes the CURRENT root into `iterations/` first).

Details: CLAUDE.md, docs/VERIFICATION.md.
