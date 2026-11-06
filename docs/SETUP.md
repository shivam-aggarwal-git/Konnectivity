# Setup and commands

## Requirements

Use Node.js 22+ and npm, plus Python 3 for yt-dlp. `npm ci` installs locked dependencies; optional packages provide ffmpeg, Deno and cloudflared where supported. `npm run launch` reports missing tools. Python 3 must be available to the downloader. A build needs Internet access to fetch the Sora font.

Examples for missing system tools:

```sh
# macOS with Homebrew
brew install node python ffmpeg deno

# Debian/Ubuntu (install a supported Node 22+ release separately)
sudo apt-get update
sudo apt-get install python3 ffmpeg ca-certificates
# Install Deno through its official distribution if the npm optional package failed.
```

On Windows, install Node 22+ and Python 3, then run `npm ci` in PowerShell. Optional fallback: `winget install Gyan.FFmpeg` for ffmpeg. The supplied `start.bat` and `start.sh` are convenience launchers that can bootstrap Node; review scripts before running them.

## Install from source

Download/extract this release or clone the Konnectivity repository after the maintainer publishes it. In the extracted directory:

```sh
npm ci
npm run launch -- --local
```

The launcher installs missing dependencies, builds when needed, starts the custom server and opens the browser. Visit `/setup` first. To stop it, press Ctrl+C.

To run alongside an existing app, use another port and the separate checkout:

```sh
# macOS/Linux
PORT=3001 npm run launch -- --local
```

```powershell
# PowerShell
$env:PORT = "3001"
npm run launch -- --local
```

## Development versus production

```sh
npm run dev                    # development + hot reload
npm run typecheck              # TypeScript checks
npm test                       # pure synchronization tests
npm run test:integration       # isolated loopback integration suites
npm run build                  # production build
npm start                      # production server, no automatic tunnel
npm run launch -- --local      # build/start convenience, LAN access
npm run launch                 # build/start plus public quick tunnel
npm run launch -- --rebuild --local
npm run check:release
```

Do not build over the same `.next` directory while its production server is running. Stop it first, or build in a separate checkout. A fresh runtime creates its own `data/` and `cache/`; neither is supplied in this release.

## Optional environment file

```sh
cp .env.example .env
```

Next.js loads `.env` for app configuration, but the launcher reads `PORT` from its process environment before preparing Next. Export `PORT` in your shell when using the launcher on an alternate port. `NEXT_PUBLIC_REPOSITORY_URL` is optional and is read at build time; set it to the real Konnectivity repository URL once published.
