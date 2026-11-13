# Konnectivity FAQ: Listening Together, Hosting and Playlists

[README](../README.md) · [User guide](USER_GUIDE.md) · [Troubleshooting](TROUBLESHOOTING.md)

## Is Konnectivity a self-hosted music player?

Yes. It is a shared listening-room application with synchronized controls, queues, playlists, video and chat. You run the custom Node server and supply your own content and optional service credentials.

## Do listeners need Spotify Premium?

Konnectivity does not stream Spotify audio. Supported Spotify links provide metadata that can be matched to playable sources. YouTube playback may require the group owner’s own cookies; those cookies do not sign listeners into YouTube or transfer Premium benefits.

## Does it work on mobile?

The interface supports phone-sized screens, a persistent media player and an installable PWA. Microphone access, background audio, casting and autoplay remain browser/device dependent. Desktop browser testing is not a guarantee of every physical phone’s behavior.

## Why did my playlist import as one song?

A URL with `watch?v=...` and no `list=` is one video. A long video may be titled “playlist” or “mix”; the importer does not split that recording into individual songs. Use the actual playlist link with a `list=` identifier for individual entries.

## Where are my saved playlists and Settings?

Playlists has a mobile tab and desktop entry point. Settings contains Appearance, Room management, Sound & playback and AI DJ information. Room management contains group identity, mood, hosts, permissions and YouTube integration. Your personal avatar contains profile details only.

## Can a room have two hosts?

Yes. An existing host can promote an active listener through Settings → Room management → Hosts, listeners & requests. Ordinary listeners cannot promote themselves. Another active host keeps the room running when one host leaves.

## Why are lyrics unavailable or unsynchronized?

Lyrics depend on the configured Lyrica service and its providers. Timestamped results can highlight and scroll with playback. Plain lyrics cannot provide precise line timing. Instrumental tracks, missing entries and provider outages can produce no result without stopping music.

## Will saved settings follow a new room code?

Enable Save my settings across rooms as a host. Preferences and saved references can follow the same stable device identity on the same server. Different browser origins, cleared storage or a different server may require setup again. Chats, active sessions and login credentials are not copied.

## Does the AI DJ have to be enabled?

No. The room works without it. Configure a supported provider through the existing authorized platform administration. Provider availability, prices and quotas are separate from Konnectivity.

## Is chat end-to-end encrypted?

No. The server operator can read stored chat and uploaded media. WebRTC calls use browser media encryption, but the signaling/application server remains trusted. See [Security](../SECURITY.md).

## Can I use Konnectivity commercially?

The repository retains the upstream PolyForm Noncommercial 1.0.0 license. Read [LICENSE](../LICENSE) and [NOTICE](../NOTICE) for the actual terms and attribution. This release does not grant additional commercial rights.

## What should I back up?

Privately back up `DATA_DIR`, deployment configuration and credentials. Online audio cache can be regenerated; durable uploads and room data require the data backup. Never add these directories or cookie exports to Git.
