# Deployment, backup and updates

Documentation version: **10.04**

## Local server or native VPS install

```sh
curl -fsSL https://raw.githubusercontent.com/shivam-aggarwal-git/Konnectivity/10.04/install.sh | bash
```

The installer prepares the app and supported runtime dependencies automatically and opens localhost on a desktop. On a headless VPS, the localhost address is printed instead; use `ssh -L 3000:127.0.0.1:3000 user@your-vps` and claim `/setup` in your own browser. This foreground installer does not configure DNS, firewall rules or a system service; use the Docker option below for managed restarts. See [setup](docs/SETUP.md) for supported platforms and developer commands.

Claim `/setup`, create a room, then choose how friends connect. LAN links only work on the same network. The default launcher (`npm run launch`) offers a Cloudflare quick tunnel after admin setup; it requires Internet access and the optional cloudflared package. A quick tunnel is temporary and does not provide uptime guarantees.

## Docker server

```sh
cp .env.example .env
# Set PUBLIC_URL=https://your-domain.example and review optional settings.
mkdir -p data cache
sudo chown -R 1000:1000 data cache
docker compose up -d --build
docker compose logs -f
docker compose ps
```

Docker runs as a non-root user and publishes port 3000 on loopback only and persists `./data` and `./cache`. Complete admin setup locally before public exposure. For a remote VPS use `ssh -L 3000:127.0.0.1:3000 user@your-vps`, then open `http://localhost:3000/setup`. Use a reverse proxy with HTTPS and WebSocket upgrades for a stable domain; route `/socket.io/`, `/audio/`, `/upload` and `/chat-media` to the same custom server. Configure a 100 MB request-body limit for music uploads. Do not buffer long uploads unnecessarily. Configure firewall/VPN access to suit your audience.

The current persistence design expects one process and a writable local filesystem. Do not run multiple independent replicas against the same JSON store.

## Backups

Stop the server for a consistent private backup. Back up `data/` (including `personal-space.json`, uploaded songs, playlists, room state, admin settings and background/image files), your local `.env` and any external credential file to protected storage. `cache/` can be regenerated. Never attach a runtime backup to a public release.

For a **code-only** archive from a clean source checkout:

```sh
npm run check:release
# After initializing and reviewing your repository:
git archive --format=tar.gz --output=../konnectivity-source.tar.gz HEAD
```

`git archive` includes tracked files: review what is tracked before using it. `.gitignore` does not untrack an accidentally committed file.

## Updating

Back up private data, stop the app, update the source from the Konnectivity repository you trust, then:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm start
```

For Docker, after updating source: `docker compose up -d --build`. Preserve the existing data mount. There is no automatic source updater pointed at the upstream project in this fork. The separate yt-dlp updater remains configurable.

Check health with:

```sh
curl --fail http://localhost:3000/api/health
```

On failure, stop the new version, restore the previous code/build and restart with the same data path only if compatible. Keep a pre-upgrade data backup for migrations. Never build in the live app’s checkout while it serves users.

## Upgrade from 10.01

Stop the app and back up your private data directory outside Git. For a Git installation, use `git fetch origin`, `git switch --track origin/10.04` (or `git switch 10.04` if present), then `git pull --ff-only origin 10.04`. Start with `bash start.sh --local` or `Start-Konnectivity.bat`. The launcher rebuilds changed sources. Keep your existing ignored data, cache and environment files; never commit them. Archive installations should extract 10.04 into a new folder, then privately transfer their data/cache/configuration before starting. The guided installer launches an existing installation without overwriting its private files.

Audio is the default for all media. MP4, MOV, MKV and WebM uploads are limited to 100 MB and converted locally; movie-length large files are outside this release’s upload limit. Switch to Video in the room to watch.


### Stable 10.04

Clone with `git clone --branch 10.04 https://github.com/shivam-aggarwal-git/Konnectivity.git`. This branch includes only application code, reviewed branding, sanitized documentation and deployment templates. Configure your own credentials after installation. Never reuse or publish a running instance's data directory.
