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
