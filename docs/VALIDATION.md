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
