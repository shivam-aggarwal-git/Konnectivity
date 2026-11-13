# Konnectivity 10.06 User Guide: Rooms, Playlists and Shared Playback

[README](../README.md) · [Setup](SETUP.md) · [Screenshots](SCREENSHOTS.md)

## Open a listening room

Complete local server setup, open Groups, then create a group or use an invitation. Choose your display name. The creator’s saved owner credential establishes ownership; adding `?host=1` to a URL does not grant host access. Retain your browser storage and keep invitations private.

The header exposes People, Buzz for hosts, Share, Call, Notifications and Settings. Home and Leave Party sit beside the personal avatar. The group avatar is rounded-square; personal avatars are circular.

## Player and lyrics

The player keeps play/pause, replay, shuffle, repeat, the song timeline, lyrics, likes and volume accessible. On phones, Volume opens a vertical slider. Playback actions show short feedback messages. The buffered portion of the timeline describes this device, rather than guaranteeing that every listener has downloaded every song.

Shuffle randomizes the existing queue and can request a similar track when it runs out. Server-side preparation covers queued songs with a bounded download pool. Provider failures, permissions and network conditions can still interrupt playback.

Select Lyrics to show them inside the song panel with compact artwork. Timestamped lyrics highlight and auto-scroll with the shared position, including after seeking. Manual scrolling temporarily holds your reading position. A provider may supply plain lyrics, no result or an error; those cases cannot guarantee line-level synchronization.

Comments occupy a separate scrolling region below the track summary. Type `@` to select a listener inline, then post. A song must be selected before commenting. Message opens the playback-message composer; the resulting centered message can be hidden or dismissed locally. Clearing it for the room affects everyone.

## Search, uploads and media modes

Search supports supported online music, local library results and link imports. Clear empties the query; Clear all removes recent searches on this browser. Opening an empty search refreshes its suggestions. Search history is device-local.

Use Library → Upload to choose supported media. Audio/video files can be up to 100 MB each. Uploaded MP4/MOV/MKV/WebM selections are converted for browser playback. Choosing uploaded video from search can open Video mode. Uploading a photo opens Photos; uploaded video is accessible in Videos. Photo uploads through the shared library use the room’s existing image-sharing flow.

Videos, Photos and Library use the same collection window. Upload success keeps the relevant collection visible instead of silently closing it. Use the track’s Play action for immediate playback or Queue to append it.

## Saved playlists

Open Playlists from the phone tab bar, desktop navigation or collection window. Choose a saved playlist to inspect its songs. Play an individual song, use Queue all, or select multiple playlists for a batch. Arrange songs with the available move/drag controls. Create, rename and delete actions act on the selected playlist.

Import a public or accessible YouTube playlist URL containing `list=` to save up to 100 available entries. A YouTube Music watch URL with only `v=` identifies one video, even when its title says “playlist” or “mix”; it is saved as one track. Spotify imports resolve metadata to matching playable tracks, not Spotify audio.

Creation/import selects the saved playlist and shows a short confirmation. The window stays open so you can inspect or play it. Some groups require their own YouTube cookies before online imports. Import errors explain setup or provider failures when available.

## Settings and room management

Open Settings from the header. Personal profile details remain under the circular profile avatar.

| Path | Controls |
| --- | --- |
| Settings → Appearance | Themes, backgrounds, artwork visibility, motion, visualizers and lights; preview and save shared changes. |
| Settings → Room management → Group name & avatar | Group image and name; new names have a 15-character limit. |
| Settings → Room management → Room mood | Edit the room’s mood, including emoji, or return to automatic mood. |
| Settings → Room management → Device synchronization | A host can detach this device; shared synchronization permission controls are also available. |
| Settings → Room management → Hosts, listeners & requests | Admit, mute, remove, rename or promote listeners as permitted. Multiple hosts can remain active. |
| Settings → Room management → Listener permissions | Configure listener playback, queue, media, comments, reactions, calls and other capabilities. |
| Settings → Room management → YouTube integration | Authorized owner manages this group’s cookies. |
| Settings → Sound & playback | Review synchronization and device playback information. |
| Settings → AI DJ | Review availability and access existing authorized platform configuration. The DJ remains optional. |

Nested screens provide Back navigation. Permission checks still apply; ordinary listeners cannot promote themselves or change host-only controls. AI-provider keys remain platform-admin configuration.

## Profile and saved preferences

Click your personal avatar to see your avatar and profile actions. Edit the display name, status or image. A selected photo/GIF previews immediately before saving. Save confirms the update; Clear removes the selected photo; Cancel discards the edit. Profiles are cropped to avatar dimensions rather than displayed as full-size GIFs.

Profile images and GIF uploads support 20 MB. Ordinary chat photos support 8 MB. JPEG, PNG, WebP and supported HEIC/HEIF images can be used; HEIC/HEIF is converted to a browser-readable still image.

A host can enable Save my settings across rooms. On the same server and stable device identity, new groups can restore appearance, mood, profile, group avatar, saved playlists and library references. Another device does not inherit that private profile automatically. Preserve browser storage and back up the server’s private data directory. Changing a public hostname can change browser storage origin; it does not move server data or transfer login credentials. Messages, active participants and playback position are not copied into a new room.

## Chat, GIFs and voice notes

Use the composer to send text or emoji; basic emoticons such as `:)`, `:P` and `<3` are converted on send. The plus menu exposes attachments. Media recipients is an icon immediately before Buzz in the chat header when private sharing is permitted. Choose Everyone or selected members before attaching media; host permissions apply.

GIF search uses the app’s search styling. Selected GIFs send as media without a source-link caption. Voice notes have play/pause, a progress display and a waveform-style timeline; the bars are a UI visualization, not an audio analysis. Voice notes support compatible recorded MP4/M4A, WebM or Ogg audio up to 8 MB. Chat videos support MP4/WebM up to 50 MB and play locally in the conversation.

Chat provides Buzz and Call entry points without removing the global header actions. Activity has its own Close control. General chat and song comments remain separate. The server operator can read stored messages and media.

## Polls, plans and calls

Polls & Plans is a separate tab with expansion and Close controls. Polls have 2–6 options; use an option’s trash icon to remove it while retaining the two-option minimum. Plans use IST dates/times, INR budgets and a venue or map link. Share my location asks your browser for permission and inserts a map link; you can paste a location instead.

Leaving the panel for Now or Home keeps the draft on this browser. Reopen the form to continue; Clear draft removes that form’s fields. Drafts are local convenience state, not a submitted poll or plan. Submitted items support votes, RSVP changes and appropriate creator/host controls.

Call entry points open the existing room call flow. Microphone/camera/screen permissions require your action. HTTPS is required outside localhost; a configured TURN relay may be necessary across some networks. See [social features](ROOM_SOCIAL.md) for trust and media details.

## Leave a party

Leave Party opens a confirmation with Stay and Leave. Hosts can hand off to an available listener. Another active host keeps the room going; the last host leaving ends the live session. Room/group persistence and saved media are separate from the active session. Browser refresh and tab-close use the browser’s available leave-warning behavior, which mobile operating systems may bypass.
