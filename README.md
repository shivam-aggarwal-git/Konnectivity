# Konnectivity

**Your friends. Your music. One shared room.**

Konnectivity is a self-hosted music and video listening app with a shared queue, synchronized controls, saved playlists and chat. Run one server and invite friends through a room link.

> **License:** This is a modified distribution of [Syncwave](https://github.com/SAKMZ/syncwave), under **PolyForm Noncommercial 1.0.0**. It is source-available, not OSI open source. The inherited noncommercial restriction cannot be removed by renaming the project. See [LICENSE](LICENSE), [NOTICE](NOTICE) and [release guidance](docs/RELEASING.md).

![Konnectivity listening room](docs/screenshots/room-desktop.jpg)

## Features

- Shared play/pause, timeline seeking, ±10 seconds, volume and Play now.
- Automatic room clock calibration, drift correction, buffering coordination and reconnect recovery.
- YouTube search and automatic video playback from search; direct YouTube links and supported Spotify link imports.
- Local uploads including MP3, FLAC and WAV, with duplicate detection and durable storage.
- Create, rename, save and reuse playlists.
- Text and image chat, reactions, presence, voting and optional AI DJ.
- Responsive layout, mobile volume controls, persistent search and installable PWA.
- Password-protected server settings, optional downloader cookies and proxy configuration.

No songs, cookies, API keys, passwords, existing rooms or user chat are included. You supply your own content and any optional credentials.

## Quick start

Requires **Node.js 20 or newer**, npm and Python 3. The optional packages supply ffmpeg, Deno and Cloudflare tunnel support on supported platforms. If unavailable, install ffmpeg and Deno separately; see [setup](docs/SETUP.md).

```sh
git clone https://github.com/shivam-aggarwal-git/Konnectivity.git
cd Konnectivity
npm ci
npm run launch -- --local
```

Open **http://localhost:3000/setup**, set an admin password, then create a room. `--local` avoids a public tunnel. It still permits access from your network; firewall rules control exposure.

Already using port 3000? On macOS/Linux:

```sh
PORT=3001 npm run launch -- --local
```

For a public invitation, finish local admin setup, stop the local launcher, then run:

```sh
npm run launch
```

The launcher starts an HTTPS Cloudflare quick tunnel after setup. Anyone with the link can reach the server. Its address changes on restart. Use the room’s **Share** button for the current invitation. Keep the host running while listening.

## Development and checks

```sh
npm run dev                 # custom Next.js + Socket.IO development server
npm run typecheck
npm test                    # deterministic client clock/drift tests
npm run test:integration    # isolated shared controls, upload, playlist, media and sync tests
npm run build
npm start                   # production, after a build; no public tunnel
npm run check:release       # checks source tree for private/runtime content
```

Use the custom server commands above rather than `next start`: realtime rooms and upload/audio routes need `server.mjs`. Integration tests create temporary fixtures, require ffmpeg and bind loopback sockets; they do not use your personal library.

## Docker

```sh
cp .env.example .env
# Edit PUBLIC_URL and optional settings for your deployment.
docker compose up -d --build
docker compose logs -f
docker compose down
```

Complete `/setup` locally before exposing the server. Docker does not create a public tunnel. `data/` and `cache/` are persistent bind mounts. Never commit them.

## Screenshots

Screenshots use an isolated demo instance and generated demonstration audio, not a personal library.

| Desktop room | Mobile room |
| --- | --- |
| ![Desktop](docs/screenshots/room-desktop.jpg) | ![Mobile](docs/screenshots/room-mobile.jpg) |

![Saved playlists](docs/screenshots/playlists.jpg)

<details>
<summary>More screenshots: library, uploads, search, image chat and automatic sync</summary>

### Saved music library
![Music library](docs/screenshots/library.jpg)

### Upload songs or folders
![Uploads](docs/screenshots/uploads.jpg)

### Persistent search
![Search](docs/screenshots/search.jpg)

### Mobile image chat
![Image chat](docs/screenshots/image-chat.jpg)

### Automatic synchronization
![Automatic sync](docs/screenshots/automatic-sync.jpg)

</details>

[Browse the complete screenshot gallery](docs/SCREENSHOTS.md)

## Documentation

- [Setup and commands](docs/SETUP.md)
- [Using rooms, uploads, playlists and chat](docs/USER_GUIDE.md)
- [Configuration](docs/CONFIGURATION.md)
- [Architecture and synchronization](docs/ARCHITECTURE.md)
- [Deployment, backup and upgrades](DEPLOY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Release and licensing checklist](docs/RELEASING.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md)

YouTube embeds use each listener’s own browser session. A server-side cookie does not transfer Premium to friends. Autoplay, ads, embedding restrictions and unreported headphone delay can limit synchronization. Use only content you have permission to upload or access.
