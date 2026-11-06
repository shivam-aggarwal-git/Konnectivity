# Deployment, backup and updates

## Local server

```sh
npm ci
npm run launch -- --local
```

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

Stop the server for a consistent private backup. Back up `data/` (including uploads, playlists, room state, admin settings and image chat), your local `.env` and any external credential file to protected storage. `cache/` can be regenerated. Never attach a runtime backup to a public release.

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
