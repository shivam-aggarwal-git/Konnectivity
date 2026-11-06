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

Use Chat to send text or attach JPEG, PNG, GIF or WebP images (up to **8 MB**). Images are stored on the server and scoped to the room’s upload token; do not use chat as a private encrypted messenger. Reactions appear beside the player without covering its main controls.

## Automatic sync

No manual latency input is required. Devices calibrate against the server, correct drift and recalibrate on reconnect or tab return. The Sound settings dialog shows automatic status and measured latency where available. If a listener buffers, the room waits briefly and schedules a common restart. After about 20 seconds a blocked device no longer holds everyone; it catches up after recovery. A manual pause remains paused.

The app cannot remove network outages, YouTube ads or unreported Bluetooth latency. Keep the tab active when possible. See [troubleshooting](TROUBLESHOOTING.md).
