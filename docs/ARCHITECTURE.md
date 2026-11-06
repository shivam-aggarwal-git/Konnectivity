# Architecture

`server.mjs` runs Next.js, Socket.IO and raw media endpoints on one HTTP server. Deploy the custom server as one process; a static export or generic `next start` does not supply realtime/media behavior.

| Area | Source |
| --- | --- |
| App routes, setup and admin APIs | `app/` |
| Room, search, library, video and chat interface | `components/` |
| Room state and realtime event handlers | `lib/rooms.mjs`, `lib/protocol.mjs` |
| Clock and drift helpers | `lib/client-sync.mjs` |
| Browser audio gain/output estimate | `hooks/useRoomGain.ts` |
| Local library and upload streaming | `lib/uploads.mjs` |
| Room-scoped image attachment route | `lib/chat-media.mjs` |
| Online audio resolution and cache | `lib/resolver.mjs`, `lib/ytdlp.mjs` |
| JSON persistence and admin authentication | `lib/store.mjs`, `lib/auth.mjs` |
| Optional AI DJ | `lib/dj.mjs` and related provider modules |

## Playback synchronization

The server owns a track token, playback intent, paused position and a server epoch start timestamp. Clients sample clock offset with monotonic timers and round-trip probes; low-RTT samples limit the effect of slow packets. Clients derive the target position continuously instead of advancing a local UI timer alone.

Audio correction uses small temporary playback-rate changes for modest drift, and seeks for larger drift. Video uses iframe API seeks. Browser-reported output latency is used where available for audio; it is an estimate, not a microphone measurement.

Readiness messages include the track sync key, so stale reports cannot pause a new song. A buffering participant holds the shared position. Once all are ready, a future common deadline allows commands to arrive before playback starts. A bounded timeout prevents one stuck device from blocking the room indefinitely. Disconnect removes its readiness wait; manual pause cancels automatic resumption.

## Persistence and trust boundaries

JSON namespaces in `DATA_DIR` store rooms, settings, admin authentication and indexes. Music uploads and chat image bytes live underneath it. `CACHE_DIR` contains evictable online audio, not the durable uploaded library. Back up `DATA_DIR` privately.

Room owner and upload tokens are capabilities. Admin authentication is a separate signed cookie backed by password hashing. Shared libraries/playlists are intended for a trusted friends-scale server, not tenant isolation. The app is not end-to-end encrypted. See SECURITY.md before Internet exposure.

## Tests

`npm test` covers clock sampling, hold/deadline calculations and drift correction. `npm run test:integration` launches socket/media suites with separate temporary directories and synthetic audio, then cleans them up. These tests do not depend on a live personal room or a real YouTube account. Real browser/phone and provider playback need manual smoke tests too.
