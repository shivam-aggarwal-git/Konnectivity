# Konnectivity 10.06 Release Notes

Release branch: [`10.06`](https://github.com/shivam-aggarwal-git/Konnectivity/tree/10.06). Package version: `10.6.0`. Documentation updated: 13 November 2026.

## Mobile listening rooms

The release organizes Settings into predictable nested screens, keeps personal profile actions under the avatar, and exposes group identity, mood, co-host controls, permissions and YouTube integration in Room management. Appearance and notification rows use consistent typography. The header includes Home and a confirmed Leave Party action; the mobile tab bar adds Playlists.

## Playback, lyrics and playlists

Lyrics open inline with compact artwork and scroll against provider timestamps. Song comments use typed mentions and a bounded scrolling thread. Replay, shuffle and repeat produce brief feedback; volume opens a vertical control on phones. Similar-song autoplay can continue an empty shuffled queue, and queued audio is prepared with bounded download concurrency.

Playlist creation/import keeps the chosen playlist visible and confirms success. A watch-only YouTube URL saves one video; playlist entries require a playlist identifier. Media collection navigation includes video and photo views, and uploaded video selections can request Video mode.

## Profiles and social features

Selected profile GIFs preview before saving, remain bounded as avatars and support the 20 MB profile/GIF limit. Chat retains emoji, emoticon, GIF, voice-note and media-recipient actions. Activity has a close control. Polls and plans can expand, retain local drafts during navigation, clear drafts and remove individual poll options. Plans can insert a permission-based location link.

## Saved preferences

Opt-in preferences restore appearance, mood, profile, group avatar, saved playlists and library references for the same server/device identity. Other devices do not inherit the private profile. Session messages, active participants and credentials are not copied. Group names are limited to 15 characters when edited.

## Installation and upgrade

1. Back up the existing private data/configuration outside Git.
2. Obtain the `10.06` branch or archive in a source checkout.
3. Run `npm ci`, then `npm run build` and `npm start`, or use a documented launcher.
4. Keep the same private data directory when updating an existing installation.
5. Refresh existing clients after the server switches to the new build.

See [Deployment](../DEPLOY.md), [Setup](SETUP.md) and [Validation](VALIDATION.md). Do not build over a running production `.next` directory; build separately and restart with a verified artifact.

## Compatibility and limits

The custom server and Node 22+ remain required. Provider access, browser permissions, autoplay and hardware latency still affect playback. Timestamped lyrics and online recommendations depend on external availability. AI DJ remains optional; its credential configuration remains an authorized platform-admin function.

## Attribution

The release retains Syncwave attribution, the inherited LICENSE and NOTICE, and third-party notices. Bundled notification tones in this source distribution are generated UI tones, not personal recordings.

### Mobile usability follow-up

- Collapsible song comments retain drafts; the Comments action restores the thread.
- Search results close independently and stay between persistent room navigation and the player.
- Attachment actions scroll within the available viewport, including when the keyboard changes its height.
- Notifications can be cleared on the current device; new notifications continue arriving.
- Profile action icons and labels share one baseline. Mood labels and reactions remain reachable with artwork hidden.
- YouTube embeds set an origin-only referrer policy before loading to address error 153 without exposing invitation query strings. Provider embedding restrictions still apply.
- Playback readiness shows the contiguous media buffered ahead instead of treating a percentage as a guarantee of uninterrupted playback. Physical iPhone foreground/background stalls still require device verification.
- The room guide now covers comments, tags, lyrics, reactions, notifications, drafts and nested settings.

### Player controls and continuous listening

Added movable reactions that remain usable in Focus mode and avoid overlapping controls, icon-only collapsible comments with lyrics restoration, video lyrics, Broadcast naming, playlist multi-select, independent continuous play, preference reset, five themes, five visualizers and five lighting presets. Standard YouTube links retain video metadata and Shorts expose queue navigation. Audio preloading continues while paused; unknown-length downloads now retain a bounded fallback. Spotify integration accurately describes public-link matching without requesting unsupported cookies.


### YouTube video playback and room controls

- YouTube videos use the YouTube player; only uploaded video files use the local file player.
- Playback starts with 1.5 seconds of buffered media, or the remaining duration near the end, instead of requiring ten seconds. The app retains media sources during preparation and primes both persistent audio slots on the first room interaction. The YouTube iframe is also reused across tracks rather than recreated, and receives playback commands while hidden. Browser and provider autoplay policies still apply, especially after background suspension.
- Queue actions are visible before adding a song and use the theme accent after confirmation. The mobile queue count sits above its tab with a contrasting foreground.
- SVG photos, profile pictures and room backgrounds are converted to PNG before storage. Active content and external resource references are rejected.
- The public homepage has a new responsive listening-room preview and clearer room entry.
- AI DJ settings include LM Studio and OpenCode, with editable base URLs. LM Studio uses its local OpenAI-compatible API. OpenCode uses its Console Chat Completions API and requires a compatible model and API key.
- The administrator room list supports selecting all filtered rooms across pages. Selection alone does not delete rooms; the existing confirmation remains required.
