# Project audit — 17 September 2026

## Scope

The audit covered the learner and administrator browser flows, session persistence, queue admission and shutdown, paid-provider checkpoints, cost reservations, media subprocesses, recording lifecycle, dependency reproducibility, CI, and production documentation.

## Resolved findings

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | A worker or interrupted cleanup could save/restore stale state after explicit deletion and recreate a deleted session. | Added local, Redis, and durable R2 deletion tombstones plus an atomic Redis write guard. |
| High | Redis entitlement reservation used a check-then-set sequence, allowing two sessions to reserve the same learner/campaign entitlement concurrently. | Replaced it with one atomic Lua reservation operation. |
| High | A lost browser response after successful `POST /generate` could make the client delete a session whose paid work had already started. | Made generation admission idempotent and added browser recovery for ambiguous responses. |
| Medium | Queue shutdown could dispatch another local job while the service was draining. | Added a closing state that blocks admission and dispatch before waiting for active work. |
| Medium | A previous recorder's delayed `onstop` callback could stop or clear a newly started recording. | Scoped each callback to its own recorder and stream and held the busy state until stop completion. |
| Medium | FFmpeg/ffprobe processes had no common hard timeout and could hold every media slot indefinitely. | Added a bounded process runner with hard timeouts, bounded stderr, single settlement, and guaranteed slot release. |
| Medium | Install/build behavior was not reproducible because lockfiles were absent and CI used `npm install`. | Added root and client lockfiles and moved local, Docker, and CI installs to `npm ci`. |
| Low | Production documentation and hidden UI copy described obsolete audio limits, three FLUX images, and a fixed loading countdown. | Updated the documentation and copy to match the implemented two-Qwen, four-FLUX, one-Pruna flow. |

## Verification

- All automated Node tests pass, including new concurrency, recovery, recorder, and media-timeout regressions.
- The production client build passes.
- Root and client production dependency audits report no known vulnerabilities.
- Changed server and browser JavaScript passes syntax checks.
- `git diff --check` reports no whitespace errors.

## Operational boundary

The supported production design remains one Render web-service instance with private R2 persistence. Browser login sessions and the bounded execution queue are process-local by design; scaling the web service to multiple instances would require a shared session store and distributed queue. A real provider end-to-end run is intentionally not part of the automated audit because it requires live credentials and incurs Replicate charges.
