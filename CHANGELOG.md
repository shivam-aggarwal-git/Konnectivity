# Changelog

## Shared room appearance

- Either listener can change the room theme, lighting, visualizer and motion setting for everyone.
- Appearance persists with the room and is included for late joins and reconnects.
- Invalid values are rejected, rooms remain isolated, and reduced-motion accessibility remains device-specific.


## Vivid rooms and navigation

- Contained activity empty states to prevent overlap with the chat header.
- Added Home navigation to the toolbar and logo/tagline, retaining playback.
- Added Aurora, Afterglow and Ocean themes, with a responsive six-theme picker.
- Brighter color washes, shared-timeline pulses and floating fireflies; motion preferences remain respected.


## Private access, search and atmosphere

- Protected room creation, token invitations and approved-member access to music and search.
- Fixed pending guest chat leakage, malformed socket crashes and unrestricted cross-origin connections.
- Added login/event limits, private credential permissions, upload quotas and non-root Docker defaults.
- Updated runtime dependencies to patched versions; Node 22 or newer is required.
- Outside-click popup dismissal, removable search recents and suggested songs.
- Audio default with an explicit same-song video switch, and gentle synchronized timeline lights.


## Atmosphere and interface

- Moonlight default, Rosewood and Candlelight themes with device-local preferences.
- Locally hosted Lottie heart artwork, ambient wave visualizer and motion controls.
- Hidden-page and reduced-motion handling without changing the audio pipeline.
- Clearer queue rows, simplified player card and responsive appearance controls.

## Background playback recovery

- Background listeners release buffering holds instead of pausing the room.
- Debounce transient readiness failures and allow a foreground recovery window.
- Avoid forced seeks on every tab return and repeated seeks during buffering.
- Use native desktop audio; recover interrupted iOS audio on return where the browser permits.

## Konnectivity source snapshot

Based on Syncwave 1.3.0, with the upstream license and required notice retained.

- Shared transport, volume, timeline scrubbing and ±10 second seeking.
- Durable local song library and playlist creation, rename and reuse.
- Search Play now automatically selects YouTube video mode for online results.
- Room-scoped image chat and shared YouTube watch controls.
- Automatic clock calibration, drift correction, buffering hold and coordinated restart.
- Reconnect recovery, automatic browser output estimate and mobile volume controls.
- Neutral Konnectivity branding, clean first-run state, documentation and release checks.

This package excludes personal runtime data and prior Git history. See NOTICE for provenance.
