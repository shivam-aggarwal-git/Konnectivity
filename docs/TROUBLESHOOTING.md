# Troubleshooting

| Symptom | Checks |
| --- | --- |
| Port already used | Choose another `PORT` in the shell; keep a separate checkout |
| Build cannot download font | Permit build-time access to Google Fonts or retry on a working network |
| Upload failed | Check allowed format, 100 MB per-file limit, free disk, ffmpeg and reverse proxy body limits |
| Online audio cannot resolve | Check Python 3, ffmpeg, Deno, yt-dlp version and YouTube restrictions; optional cookies/proxy settings are in admin |
| Video refuses to play | Some uploads cannot be embedded; try another result; ads and sign-in requirements come from YouTube |
| Phone is silent | Tap the playback/enable-audio prompt once; check shared volume and physical device volume |
| Room says waiting | A listener is buffering; wait for coordinated recovery; after about 20 seconds others continue |
| Drift after switching tabs | Return to the tab, allow clock recalibration; background suspension and headphones can affect accuracy |
| Share link stopped working | Restarted quick tunnels get a new address; obtain it from Share |
| Missing library after restart | Check the same writable DATA_DIR or Docker bind mount is in use |
| AI DJ does not respond | Verify provider endpoint, credentials, enabled toggle and a supported model; plain rooms work without AI |

Collect redacted server logs and reproduction steps for bug reports. Do not include `.env`, cookies, `data/`, room tokens or personal screenshots. For sync bugs, include both browsers, their OS, whether local audio or YouTube, and whether one device was in the background. Network/output estimates are shown in Sound settings; no manual delay slider is required.

## 10.06 navigation and saved state

- **Cannot find permissions, co-hosts or device sync:** open Settings → Room management. Personal profile details are under the circular avatar.
- **Playlist window used to disappear:** 10.06 retains the saved playlist and confirms the action. Use Playlists to reopen its songs. A watch-only URL imports one video; use `list=` for individual playlist entries.
- **Lyrics do not follow the song:** line timing requires a timestamped provider result. Plain or unavailable lyrics cannot be precisely synchronized. Manual scrolling temporarily suspends auto-scroll.
- **New room did not restore my profile:** check Save my settings across rooms, the server data directory and the browser/device identity. A different origin or cleared storage can create a different identity.
- **Profile GIF fills the screen:** use the profile upload action and refresh to the 10.06 build. Selected files preview in a bounded avatar before Save.
- **Old controls after deployment:** refresh the open room after restarting with the new build. Verify the tunnel/reverse proxy reaches that server.
