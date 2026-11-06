# User guide

## Start and share a room

Set the server admin password on `/setup`, then use the home page to create a room. Choose a nickname and share the room link. Invite-only rooms use admission controls; retain the creator’s browser storage to keep host ownership. `?host=1` alone does not grant ownership without the saved owner token.

All admitted listeners can use shared playback controls. Play/pause, timeline dragging, ±10 seconds and volume update the room. Actual loudness can differ between speakers. Phones may require a tap to permit audio, especially after changing media type.

## Search, queue and video

Use the always-visible search field or magnifier. Choose **All**, **Local library** or **YouTube** to filter the source. Local library searches uploaded songs without contacting YouTube. Use the **× Clear search** button to delete the query, including while results are loading. Click a search result or **Play now** to start it immediately; **+** adds it to the queue. Online search playback automatically opens the corresponding YouTube embed. A selected upload may show album artwork rather than an official music video. Local library results stay audio.

The watch control can also accept a direct YouTube video link. Spotify links are resolved to matching YouTube tracks; this is not Spotify account playback. YouTube can reject an embed or downloader request. Server cookies do not sign another person into Premium.

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
