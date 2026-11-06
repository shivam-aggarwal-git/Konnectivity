# Validation record

Validated on 6 November 2026 with Node 26 on macOS. This is a local validation record; the included GitHub Actions workflow has not been run on a hosted repository yet.

- Production Next.js build completed, including its TypeScript validation.
- Client synchronization tests passed: jitter-resistant calibration, delayed/asymmetric packets, recalibration, shared hold/deadline calculations and automatic 0.4/2/3/5-second drift correction.
- Integration suites passed with isolated temporary storage and generated audio: shared controls, audio range delivery, upload errors, WAV/MP3/FLAC processing, durable library, playlist operations, duplicate prevention, large playlists, protected image chat and synchronized video controls.
- Automatic synchronization integration passed: search-to-video selection, a five-second readiness stall, RTT-based shared resumption, manual pause, stale readiness rejection, disconnect, late join and bounded timeout recovery.
- Desktop and 390 × 844 mobile browser views were inspected. Playlist controls, persistent search, neutral branding and mobile volume were visible. Eight fresh screenshots are included, including uploads, library, search, image chat and automatic synchronization.
- Release tree scan passed: no runtime storage, music files, cookie exports, personal filesystem paths, tunnel addresses or recognized credential patterns. Screenshots contain fictional names and generated demo track metadata.
- Upstream LICENSE retained byte for byte. No inherited Git history or configured publication remote is included.

The preview was stopped after verification. This is not an independent security audit, a Docker build test or a physical phone/headphone latency certification. A fresh Internet-connected install still depends on package registries, font downloads and any selected media providers.

## Moonlight interface review

Production build and client synchronization checks passed after the interface redesign. All three theme buttons, local preference persistence, motion toggle and visualizer choices were checked in the browser. Lottie SVG output loaded from the local animation JSON. The 390 × 844 layout had no horizontal document overflow, and native audio continued playing during appearance checks. Updated room and appearance screenshots use only demonstration data. The ambient visualizer is decorative, not an audio spectrum measurement. No physical phone performance certification is claimed.

## Security and interaction update — 7 November 2026

- Next.js 16.4.5 production build and TypeScript validation passed in an isolated staging copy.
- `npm audit --omit=dev` reported zero known vulnerabilities for the resolved dependency tree at validation time.
- First-time setup rejects remote and forwarded requests even with a forged localhost Host header.
- The security regression suite passed: invitation access, origin rejection, protected media/search/room creation, waiting-guest chat isolation, malformed messages, request-body limits, login rate limits and filesystem permissions.
- All synchronization, media, library and shared-control suites passed, including a five-second buffering stall and generated WAV/MP3/FLAC uploads.
- Real production routes passed login, room creation and authenticated YouTube search checks. Songs, albums, album tracks and artists were smoke-tested against the current search service after the dependency migration.
- Browser checks confirmed Share and Search outside-click dismissal, removable recents, suggested songs, audio default and persistent lighting settings.
- Docker configuration was hardened but no Docker image build or independent penetration test was performed. Optional paid AI-provider calls were not exercised.
