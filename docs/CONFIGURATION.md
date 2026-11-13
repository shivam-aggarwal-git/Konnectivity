# Configuration

Copy `.env.example` to `.env` for optional local settings. Do not commit the resulting file. Server settings entered at `/admin` persist in `data/settings.json`; secrets remain server-side. Environment configuration can override related settings.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port; export in shell for launcher |
| `PUBLIC_URL` | unset | Share link origin; set to your deployed domain, leave unset for automatic launcher tunnel |
| `DATA_DIR` | `./data` | Durable rooms, playlists, settings, admin credentials, uploads and image chat |
| `CACHE_DIR` | `./cache` | Resolved online audio cache |
| `CACHE_MAX_MB` | `4096` | Cache size cap; `0` disables size cap; old tracks still age out |
| `YTDLP_COOKIES_FILE` | blank | Optional path to your own cookies file |
| `YTDLP_AUTO_UPDATE` | `true` | yt-dlp update checks |
| `YTDLP_UPDATE_DAYS` | `7` | Scheduled updater interval |
| `MAX_PARALLEL_DOWNLOADS` | `3` | Concurrent download limit |
| `ROOM_CREATE_LIMIT` | `20` | New rooms per IP/hour; `0` disables limit |
| `LINK_IMPORT_LIMIT` | `30` | Link imports per IP/hour; `0` disables limit |
| `YTDLP_PROXY` | blank | Fixed proxy |
| `YTDLP_PROXY_LIST` | blank | Comma-separated fallback proxies |
| `WEBSHARE_API_KEY` | blank | Optional managed proxy pool |
| `AI_DJ_ENABLED` | `false` | Optional AI DJ |
| `LLM_PROVIDER` | `ollama` | `ollama`, `google`, `openai` or `anthropic` |
| `LLM_MODEL` | `llama3.1` | Provider model name; choose a model your provider currently supports |
| `LLM_API_KEY` | blank | Provider credential, if required |
| `LLM_BASE_URL` | `http://localhost:11434` | Local/OpenAI-compatible endpoint |
| `SYNC_BUFFER_TIMEOUT_MS` | `20000` | Maximum coordinated buffer hold; leave default for normal use |
| `NEXT_PUBLIC_REPOSITORY_URL` | blank | Optional published source repository link; rebuild after changing |

YouTube cookies and proxies are optional and not included. Configure only your own credentials. A downloader cookie is not a browser login and does not transfer Premium to guests. Provider configuration and model availability are controlled by the provider; AI DJ is off by default.

`PUBLIC_URL` also influences Socket.IO origin handling. Use the actual public URL for a reverse-proxy deployment. For the launcher’s changing quick tunnel, leave it unset rather than pinning localhost.

### Lyrics and room approval

Konnectivity uses [Lyrica](https://github.com/Wilooper/Lyrica) through its HTTP API. Thanks to Wilooper and the Lyrica contributors. Set `LYRICA_URL` to a self-hosted Lyrica v1.5 base URL (for example `http://lyrica:8000`) or use the default public demo. Only song title and artist are sent; cookies and music files are never sent. The demo may sleep, rate-limit or be unavailable. Lyrics are optional and do not block audio playback. Provider sequences explicitly exclude LRCLIB. Timed results are normalized from milliseconds; Hindi/Latin script filtering is retained, with an alternate-provider attempt when needed. This is not a translation service.

New rooms require host approval by default. Existing rooms are upgraded once to require approval for future joins. Hosts can turn **Approve new joins** off in **People**; that choice persists. New requests open a popup, including above the expanded player. Dismissing it leaves the request waiting; use the waiting button to reopen. Approval does not expose room chat or media before acceptance.

Open **Settings → Room management → Hosts, listeners & requests** to mute chat or remove a listener. Removal asks for confirmation inside the panel, disconnects that listener and blocks their IP temporarily (30 minutes). Other listeners sharing that IP may also be unable to rejoin during that period. Hosts can still reconnect. A host cannot remove themselves or another host. Restarting clears temporary blocks.

On phones, sheets fit the available visual viewport as the keyboard opens. Text fields use a 16px font to avoid iPhone focus zoom, and primary People/approval controls have 44px touch targets. Add the app to your home screen for its standalone app view.

## 10.06 saved preferences and limits

Settings → Save my settings across rooms is opt-in. Group preferences are keyed to the stable device identity on this server; legacy instance preferences remain supported. Profile and group-avatar references, mood, appearance, saved playlists and library metadata can be restored without copying chat or access credentials. Preserve both browser identity and the private server data directory.

Profile/GIF uploads support 20 MB; ordinary chat photos retain their 8 MB limit. Chat video supports 50 MB and recorded voice notes 8 MB. Audio/video library uploads support 100 MB per file. Edited group names use a 15-character limit. The notification audio assets bundled with the release are original generated UI tones.
