# Changelog

## 0.1.0 — 2026-09-11

First runnable release of this independent engineering lab.

- Bounded SSE history and monotonic cursors scoped to a stream lifetime.
- Missing-event replay and explicit snapshots for expired, invalid or old-stream cursors.
- Duplicate/gap validation and cleanup for disconnected or slow consumers.
- 14 unit/integration tests and 15 browser checks across Chromium, Firefox and WebKit.
- English and Portuguese documentation, recorded demo, SVG diagrams and CI.

## Run

Use Node 22.13+ (Node 22 or 24 recommended). Download the source or clone the repository, then run `npm start`. Runtime npm dependencies are not required. Browser testing instructions are in the README.

## Scope

Single-process in-memory counter and history; a restart resets server state. Snapshot recovery does not replay expired side effects. No authentication or production load validation.

This is a local teaching implementation. No open-source license has been assigned; see NOTICE.
