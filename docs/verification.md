# Verification

Run `npm run check` and `npm test`. No npm packages, credentials or external services are required. HTTP tests bind to an ephemeral loopback port; an environment that forbids listening sockets cannot run those integration tests.

Automated checks exercise the real HTTP server as well as the state model. Browser persistence, service worker installation and visual layout are checked manually; they are not claimed as automated browser coverage. CI targets Node 22 and 24 on Ubuntu. Inspect the latest Actions run for its actual result.

## Manual browser checks

- Connect and observe the initial snapshot at sequence zero.
- Disconnect the subscriber, add three events, then reconnect. The frame list must show exactly the three missing increment events.
- Disconnect again and add 25 events. On reconnect, one `history-expired` snapshot must replace the old projection with the current server value.
- Restart the server while subscribed. Its new stream ID must cause a `stream-changed` snapshot, and its in-memory counter starts again at zero.
- Repeat with two browser tabs. Each subscriber maintains its own cursor.

The initial manual run on 2026-09-11 verified three-event replay, snapshot replacement after 25 missed events, and automatic recovery with a new stream ID after server restart in the Codex in-app browser.
