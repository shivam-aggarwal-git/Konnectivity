# User guide

## Start and share a room

Set the server admin password on `/setup`, then use the home page to create a room. Choose a nickname and share the room link. Invite-only rooms use admission controls; retain the creator’s browser storage to keep host ownership. `?host=1` alone does not grant ownership without the saved owner token.

All admitted listeners can use shared playback controls. Play/pause, timeline dragging, ±10 seconds and volume update the room. Actual loudness can differ between speakers. Phones may require a tap to permit audio, especially after changing media type.

## Search, queue and video

Use the always-visible search field or magnifier. Choose **All**, **Local library** or **YouTube** to filter the source. Local library searches uploaded songs without contacting YouTube. Use the **× Clear search** button to delete the query, including while results are loading. Click a search result or **Play now** to start it immediately; **+** adds it to the queue. Playback starts in audio mode. Switch to Video to open the corresponding YouTube video at the shared position. A selected upload may show album artwork rather than an official music video. Local library results stay audio.

You can also paste a direct YouTube link into search. Spotify links are resolved to matching YouTube tracks; this is not Spotify account playback. YouTube can reject an embed or downloader request. Server cookies do not sign another person into Premium.

## Upload your library

Open **Library → Upload**, select multiple supported audio files and keep the tab open during import. Files are stored on the host server, not on each listener’s device. MP3, FLAC, WAV and other ffmpeg-readable allowed formats are accepted, up to **100 MB per file**. Duplicate content is skipped. Failed files can be selected again.

Uploaded songs are persistent and separate from temporary online audio cache. Everyone in a room can see the shared server library. Only upload content you may share with the listeners.

## Saved playlists

Open **Library → Playlists**, enter a name and click **Create playlist**. Use **♡ Save** beside a song in search, library or the queue to add it to an existing playlist. Rename a selected playlist from its controls. Saved playlists can be reused to queue songs on later visits. They live on the server and need a data backup to survive disk loss.

## Chat and reactions

Use **Expand** in the Chat header for a larger conversation view. Scroll the message history independently; the message box stays at the bottom. New messages follow automatically when you are near the bottom, while scrolling up lets you read older messages without jumping. Use **Collapse** or Escape to return to the room.

Use Chat to send text or attach JPEG, PNG, GIF or WebP images (up to **8 MB**). Images are stored on the server and scoped to the room’s upload token; do not use chat as a private encrypted messenger. Reactions appear beside the player without covering its main controls.

## Automatic sync

No manual latency input is required. Devices calibrate against the server, correct drift and recalibrate on reconnect or tab return. The Sound settings dialog shows automatic status and measured latency where available. Brief seeking and foreground recovery have a grace period to avoid pause loops. A background listener cannot hold the room while its browser is suspended; it catches up when it returns. If a foreground listener continues buffering, the room waits briefly and schedules a common restart. After about 20 seconds a blocked device no longer holds everyone; it catches up after recovery. A manual pause remains paused.

The app cannot remove network outages, YouTube ads or unreported Bluetooth latency. Keep the tab active when possible. See [troubleshooting](TROUBLESHOOTING.md).


## Themes and atmosphere

Open **Appearance** (palette icon on a phone) to switch between **Moonlight**, **Rosewood** and **Candlelight**. Moonlight is the default. Choices are saved on your device across rooms. Each listener can choose their own look.

Choose **Heart orbit**, **Soft waves** or **Off** for the ambient visualizer. These are decorative animations, not an audio spectrum analyzer. They do not process or change playback. **Gentle motion** disables continuous decorative movement, and system reduced-motion preferences are respected. The local Lottie artwork pauses when music is paused or the tab is hidden.

## Private invitations and search

Use **Share** to copy the full invitation. A room code alone does not unlock a private server. Hosts sign in at `/admin/login` to create rooms. Enable approval to admit each guest explicitly. The music library is shared with approved friends on this instance.

Open Search to see suggestions and recent queries. Use the small **×** beside a recent query to remove it from this device. The larger **×** clears the current input. Filter with **Local library**, **YouTube**, or **All**.

## Audio, video and room lights

Rooms start in Audio mode. **Switch to Video** uses the current YouTube song and position; **Switch to Audio** returns to audio. A local file has no automatic YouTube video. In Appearance, choose **Room lights → Off / Soft glow / Song pulse**. Song pulse follows the shared playback timeline rather than claiming beat detection. Gentle motion and reduced-motion preferences are respected. Popups dismiss on outside click or Escape.

## Vivid atmosphere and Home

The **Home** button and the **Konnectivity** logo/tagline return to Now Playing, close lyrics, and restore Up Next without restarting the song or leaving the room.

Appearance now offers six themes: Moonlight, Rosewood, Candlelight, Aurora, Afterglow, and Ocean. **Color glow** gives the room visible washes of color; **Song pulse** changes their intensity on the shared playback timeline while music plays. Floating fireflies add ambient motion. Turn Room lights off or disable Gentle motion when you prefer a quieter view. These effects are decorative, not beat detection, and do not process your audio.

Appearance changes are synchronized within each room: either participant can change the theme, lights, visualizer and motion setting. New and reconnecting listeners receive the saved room appearance. Device accessibility preferences such as reduced motion still take priority.

## Shared photo backgrounds

Open **Appearance → Room background**. Choose **Upload a photo** to use a picture together (JPEG, PNG, WebP or GIF, up to 8 MB), or select **Song artwork** to follow the current song’s thumbnail automatically. Use **Darken background** to keep text readable. **Theme only** switches the image off; **Our photo** returns to the uploaded photo.

Either participant can change the background and darkness for the room. The choice is saved and synchronized to new and reconnecting listeners. Photos use private room-protected image storage on your own server, share the configured image-storage quota, and are not automatically posted to chat. Switching to Theme only does not delete the stored photo. If a local song has no artwork, the theme remains visible.

## Expand and collapse the player

Click the **Konnectivity logo or tagline** (or Home) to open the full player. Use the **down-chevron** at the top left to collapse back to the room and keep music playing in the bottom bar. Opening and closing this view never replaces the audio elements.

If the high-resolution cover or thumbnail fails, the player tries a fixed YouTube thumbnail through the authenticated server. If no image is available, the animated placeholder replaces it. Local songs without artwork use the placeholder. The thumbnail endpoint only contacts YouTube’s fixed image host, accepts valid video IDs and does not forward your YouTube cookies.

## iPhone photos, GIFs and mobile player gestures

- **HEIC/HEIF:** upload directly in chat or Room background. The server converts the primary still image to a browser-friendly JPEG. Uploads remain limited to 8 MB; exceptionally large or unsupported photos show a conversion error. Conversion runs separately from the playback process.
- **Animated GIFs:** choose Upload photo or GIF in Appearance. GIF bytes are preserved so animation stays intact. Both listeners share the selected background.
- **Mobile player:** tap the visible chevron above the bottom media controls, or swipe up on the bottom bar to expand. Swipe down on the artwork/header, or tap either down-chevron, to collapse. Timeline and volume sliders retain their normal gestures.
- **Clock:** the header and full player show the current time in your device’s local timezone.
- **Lyrics:** display is restricted to Latin/English and Hindi/Devanagari scripts. The app looks for a supported alternative rather than displaying Urdu or another script. It does not automatically translate lyrics; when no suitable version exists, it shows an availability message.

HEIC conversion uses [heic-decode](https://github.com/catdad-experiments/heic-decode) and the existing Sharp image library. The local validation used the [libheif public example](https://github.com/strukturag/libheif/tree/master/examples), not a personal photo; that fixture is not included in this source release.

## Chat notifications and player atmosphere

Incoming messages show an in-app notification with a numeric unread count and the latest sender when you are away from chat, including while the full player is open. Tap the banner to open chat and clear the count. Your own messages do not count as unread. Dismissing a banner hides it without marking the conversation read; another incoming message shows it again.

The expanded player now uses the same shared photo/GIF background, song artwork, theme colors and room lights as the room view. Choose a GIF in Appearance to animate the player background, and choose Color glow or Song pulse for the lights. Gentle motion and reduced-motion preferences still govern the decorative light effects. GIF images retain their own animation.

On phones, the Library, Playlists, Upload, Home and Video/Audio buttons use one aligned row. The shorter Video/Audio labels keep the mode control from wrapping to three lines.

## Import a YouTube playlist

Open **Playlists**, paste a YouTube or YouTube Music playlist link into **Import YouTube playlist**, then press **Import playlist**. A watch link with a `list` parameter works too. Up to 100 available songs are saved as a new shared playlist; playback and the queue stay unchanged. Larger lists report the import limit. Use the playlist’s Rename or Delete controls afterward; deleting a playlist keeps uploaded library files. Public/unlisted lists work, while private lists require access through the server’s configured account cookies. Auto-generated endless mixes are not imported.

**Hide artwork** is available in the full player and as **Appearance → Show artwork**. It is shared and saved with the room, leaving your GIF/photo background and mood lights visible. The labelled Local time clock includes AM/PM and the date, using each device’s local timezone.

## Approve joins and manage people

New rooms require host approval. Incoming listeners trigger a named popup: choose **Let in** or **Decline**. Closing the popup keeps the request waiting; reopen it from the waiting button. Use **People → Approve new joins** to control admission. Hosts can mute another listener’s chat or use **Remove → Remove now**. Removal disconnects them and temporarily blocks rejoining from their IP for 30 minutes; people sharing that IP may be affected, while hosts can reconnect.

![Join request on a phone](screenshots/mobile-join-request.png)
![Host participant controls on a phone](screenshots/mobile-host-controls.png)

Lyrics use Lyrica. They follow the shared song position when timed lyrics are available. Only Latin and Devanagari lyric lines are displayed; unsupported translations or credits are omitted. YouTube credentials are never forwarded to the lyrics service.
