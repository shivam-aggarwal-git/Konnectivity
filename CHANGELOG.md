# Changelog

## Unreleased

- Stream uploaded tracks without requiring a complete file download on each device. Show a dismissible preparation notice with the requester’s name.
- Attribute playback controls in Room Activity and give hosts live device status and recent playback reports.
- Add a room audio activation button, foreground resync, and a confirmation when navigating Back.
- Let listeners rename themselves in People. Add chat read receipts and voice notes up to three minutes.

## 10.05

- Revoke SuperAdmin sessions at logout, rotate them at login, and expire them after eight hours.
- Tighten browser request validation and production CSP, room reconnection, and upload permissions.
- Shorten TURN credentials and rate-limit issuance and renewal. Harden signaling and restart ICE with fresh relay credentials.
- Make datastore writes atomic and restrict Compose container privileges.
- Refresh screenshots, installation instructions, and security documentation.

## 10.04

- Add room photo albums, direct uploads, and a swipe viewer with keyboard and button navigation. Room admins can allow private image and chat video sharing with selected members.

- Split the product showcase, Groups page, and SuperAdmin Console.
- Add persistent groups, creator ownership, and opt-in random matching with approval. Matching works while an admin is online, including before YouTube setup.
- Isolate group cookies and media access. Add a visible upload button, Netscape export guidance, and support for HttpOnly cookie rows.
- Add room metrics, room search and selection, confirmed bulk deletion, and server-wide logo and favicon uploads.
- Add a room guide and updated screenshots, documentation, and installers.

## 10.03 — stable

Immediate Range-based upload playback without full-file predownload or shared readiness holds. Calls retain natural video orientation, camera switching and a timed minimized call banner. Home and guarded Back preserve the active room call; explicit host departure ends it. Private configuration remains server-only and excluded from release archives.

## 10.03-working

Direct room calling, host hangup teardown, shared mute/camera status, mobile remote-track refresh, early signaling queue, atomic replay, admin permission controls, protected call configuration and mobile playback recovery. Personal runtime data and credentials are excluded.

## 10.02 — 2026-11-07

- Pearl default with adaptive light/dark logos and updated documentation screenshots.
- Shared preview/save appearance, pinned dialog actions, direct Share/People/Plans/Polls and notification bell.
- Live poll charts, close/delete controls, plan/poll activity notifications and room-scoped song comments.
- Audio-first uploads and YouTube, MP4 video conversion, replay/fullscreen/visibility controls and normalized filename deduplication.
- Different suggestion sets from the suggestion refresh action; menus close after successful Save/Submit.
- Stop both audio/crossfade slots when the room clears current media, prepares another track or disconnects.
- Verified download CA roots, queue-preserving recovery, private media access and room-only encrypted WebRTC calls.
- A departing host ends the room and invalidates its invitation. Private uploads stay in the local library.
- 10.02 guided installers, source privacy checks and retained 10.01 compatibility documentation.


## Personal space and automatic installation

- Opt-in playlist references survive new room codes, with shared edits and a room-local opt-out.
- Host-enabled personal appearance and settings survive new rooms and tunnel URLs; inherited backgrounds retain animation without exposing unrelated images.
- Added guided macOS/Linux and Windows installers, a macOS double-click launcher, checked media tool setup and standalone downloader fallback without separate Python.
- Added desktop smoke checks and documentation; runtime profiles and media remain outside public releases.

## Playlist arrangement and background framing

- Queue multiple saved playlists in one action, with confirmed song totals and a 2,000-song batch limit.
- Expand saved playlists and queue; drag with touch/mouse edge scrolling, use arrow keys, or move directly to a numbered position.
- Added persistent shared image/GIF framing, Fill/Fit, zoom, focal point, optional blur and reset.
- Added local panel Show/Hide above mobile tabs and detail hiding in the expanded player.
- Corrected clipped Save controls and show confirmed Saved state.

## Lyrica, admission popups and mobile controls

- Replaced LRCLIB lookups with the configurable Lyrica HTTP API; exact provider sequences exclude LRCLIB. Bounded requests, coalescing, cached misses and Hindi/Latin line filtering keep lyrics independent of audio.
- New join requests automatically open an approval popup. Approval is enabled by default, with a one-time migration and a persistent host toggle.
- Added a responsive People panel with direct mute and confirmed removal actions; hosts can reconnect after a same-network removal.
- Narrow headers wrap correctly; phone text fields avoid focus zoom, primary actions use 44px targets, and chat/dialogs follow the keyboard viewport.

## Playlist import and immersive view

- Labelled local clock with AM/PM and date.
- YouTube playlist import saves up to 100 available entries as a new shared playlist; rename/delete controls are visible.
- Shared artwork visibility toggle in Appearance and the full player.
- Playlist metadata imports use the standard macOS system CA bundle where available, keeping certificate verification enabled.


## Mobile controls, chat notices and player atmosphere

- Aligned mobile toolbar with equal-height controls and compact Video/Audio labels.
- Added counted incoming-chat banners, previews, direct chat opening and read-state handling.
- Full player now renders the shared GIF/photo/artwork background and mood lights.


## Mobile player and iPhone images

- Correct tab title: Konnectivity : A Little Closer.
- Dedicated fullscreen layout without centred-dialog transforms; visible media-bar chevrons and mobile swipe gestures.
- Device-local clock in the header and expanded player.
- Private HEIC/HEIF-to-JPEG conversion in a bounded child process; animated GIFs remain unchanged.
- Lyrics restricted to Hindi/English scripts, with supported-result fallback and clear unavailable state.


## Cover recovery and expanded player

- Branding and Home open a full player; a down-chevron collapses it without restarting playback.
- Finite artwork fallbacks replace failed covers with a thumbnail or animated placeholder.
- Added an authenticated, bounded, fixed-upstream YouTube thumbnail fallback for the player and song-artwork background.


## Shared photo backgrounds

- Upload a private room photo or automatically use the current song artwork as the background.
- Synchronized, saved background selection and adjustable darkness for readable controls.
- Reuse room-protected image uploads; reject cross-room image selection and preserve existing privacy limits.


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
