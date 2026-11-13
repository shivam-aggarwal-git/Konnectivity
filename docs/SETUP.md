# Setup and commands

## Automatic desktop setup

Download/extract the repository ZIP. On macOS double-click **Start-Konnectivity.command**; on Windows double-click **Start-Konnectivity.bat**; on Linux run `bash start.sh --local`. The launcher obtains a private Node 22 if needed, runs `npm ci --include=optional`, validates ffmpeg and Deno, installs a checksum-verified standalone yt-dlp if the bundled downloader cannot run, builds and opens the browser. Nothing is installed system-wide. Node and downloader binaries come from their official releases; dependencies come from npm. On macOS the OS may ask you to allow the downloaded launcher to open.

The guided local installers are `install.sh` and `install.ps1`; commands are in the README. They default to `~/Konnectivity` / your Windows user folder. Existing installations are started, never overwritten. `KONNECTIVITY_INSTALL_DIR` changes the macOS/Linux destination; PowerShell accepts `-InstallDir` when running a saved copy of the installer.

Supported automatic targets: modern macOS on Apple Silicon/Intel, Windows 10+ on x64/ARM64, and common Linux x64/ARM64 distributions compatible with the official Node build and npm media binaries. Minimal Alpine and unusual architectures may need the Docker image or manual system packages. The bootstrap needs curl or wget and tar on macOS/Linux; Windows uses built-in PowerShell/.NET. Network restrictions, unavailable upstream downloads and OS security prompts can still require user action. A fresh server must be claimed with your own admin password in the opened `/setup` screen.

## Developer requirements

For manual development use Node 22+ and npm. Python 3 is only needed if choosing the Python-based yt-dlp binary rather than the automatic standalone alternative. Docker installs its own system media dependencies. The web build currently uses DM Sans and Outfit fonts, so Internet access is required.

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

## Check desktop dependencies

```sh
bash start.sh --local --check
# Or, after Node is installed:
node scripts/launch.mjs --local --check
```

`--check` installs/verifies tools and exits before a web build or server startup. `--no-open` suppresses automatic browser opening for headless testing. Windows `start.bat --local --check` has the same behavior. Missing optional media tools are repaired automatically; a failed tool check stops startup with a specific message instead of launching broken playback.

## Personal space across rooms

In a playlist, check **Keep this playlist across rooms**. Its name, order and song references are stored in `data/personal-space.json`; no audio file is downloaded by saving it. Other rooms on the same server reuse it, and shared edits update the saved version. Uncheck it to stop including it in future rooms, keeping existing room copies. Deleting a persistent playlist removes its references throughout this instance; uploaded song files are unaffected.

In **Appearance**, the host can check **Keep appearance & room settings across rooms**. This retains theme, motion, visualizer, lights, artwork visibility, photo/GIF reference, framing, volume, shuffle/repeat and join-approval preference. Either admitted listener’s later appearance changes are saved. Global admin settings and credentials already live separately in `data/`; they are never sent as part of a room profile. Chats, participants, host tokens and playback position are not copied into a new room.

Changing a Cloudflare hostname does not move or erase the server’s `data/` directory. A genuinely different server/disk needs your private data backup restored. Changing hostnames also changes browser storage origin, so the host may need to sign in again and listeners need a fresh invitation. Background files stay in `data/chat-images/`; only the inherited background gets access in the new room, not unrelated chat images.
