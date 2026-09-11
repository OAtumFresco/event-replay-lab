# Verification

The project has **14 unit/integration tests** and **15 browser checks** (5 journeys across Chromium, Firefox and WebKit). The GitHub workflow runs Node 22 and 24 for the unit/integration suite and Node 24 on Ubuntu for browser checks. The latest Actions run is the authoritative result.

## Run the suites

```sh
npm run check
npm test
npm ci
npx playwright install chromium firefox webkit
npm run test:browser
```

On Linux, use `npx playwright install --with-deps chromium firefox webkit` to include required system libraries. The Node-only suite needs no npm packages. Browser tests use a pinned Playwright development dependency and the committed lockfile.

Each browser test starts an isolated loopback server on an ephemeral port. Tests never connect to a product deployment, reuse user browser profiles or need credentials. They cover missing-event replay, expired-history snapshot replacement, automatic reconnect after server restart, independent subscriber cursors and a narrow viewport.

No scenario is marked skipped and automatic retries are disabled.

## Reproduce the demonstration

```sh
npm run demo:record
```

This launches a separate Chromium session and records a real UI journey under `demo-results/`. Assertions establish success; brief pauses only make the recording readable. The README GIF and release MP4 were converted from this recording without replacing application states. The source run, commit and recording checksum are recorded in [demo-recording.json](demo-recording.json).

A manually dispatched workflow also records the demo. CI retains test reports, failure traces and recordings in the `browser-evidence` artifact for 14 days. The selected release recording remains attached to `v0.1.0`. Routine push runs execute the tests without recording a new demo.

## Manual browser checks

- Connect and observe the initial snapshot at sequence zero.
- Disconnect the subscriber, add three events, then reconnect. The frame list must show exactly the three missing increment events.
- Disconnect again and add 25 events. On reconnect, one `history-expired` snapshot must replace the old projection with the current server value.
- Restart the server while subscribed. Its new stream ID must cause a `stream-changed` snapshot, and its in-memory counter starts again at zero.
- Repeat with two browser tabs. Each subscriber maintains its own cursor.

The initial manual run on 2026-09-11 verified three-event replay, snapshot replacement after 25 missed events, and automatic recovery with a new stream ID after server restart in the Codex in-app browser.
