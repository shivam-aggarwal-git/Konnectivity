# Contributing to Konnectivity

Thanks for helping improve Konnectivity. Read [LICENSE](LICENSE) and [NOTICE](NOTICE): this derivative retains Syncwave’s PolyForm Noncommercial license. Do not describe it as MIT, Apache or OSI open source. Follow the [code of conduct](CODE_OF_CONDUCT.md).

## Choose a base branch

| Branch | Role | Pull requests |
| --- | --- | --- |
| `main` | Development and upcoming features. | Default target for features, improvements, documentation and fixes. |
| `10.03` | Stable branch for installations and deployments. | Small stable fixes agreed with the maintainer; no unrelated features. |

Open an issue before a substantial feature or architectural change. For bugs include your OS, Node/browser versions, reproduction steps, expected/actual behavior and redacted logs. Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Fork, clone and create a branch

Fork the repository on GitHub. Replace `YOUR-USERNAME` with your account:

```sh
git clone https://github.com/YOUR-USERNAME/Konnectivity.git
cd Konnectivity
git remote add upstream https://github.com/shivam-aggarwal-git/Konnectivity.git
git fetch upstream --prune
git switch main
git merge --ff-only upstream/main
git switch -c feature/123-playlist-improvements
```

`origin` is your fork; `upstream` is the maintained project. Keep your local `main` and `10.03` branches free of your feature commits. Work on a separate topic branch.

## Branch naming

Use lowercase letters, numbers and hyphens in the description. Include an issue number when one exists; otherwise omit it.

| Prefix | Use | Example |
| --- | --- | --- |
| `feature/` | New functionality. | `feature/123-playlist-improvements` |
| `fix/` | Bug fixes for development. | `fix/124-mobile-volume` |
| `docs/` | Documentation changes. | `docs/installation-guide` |
| `test/` | Test coverage and fixtures. | `test/125-room-reconnect` |
| `chore/` | Tooling, dependencies and maintenance. | `chore/126-dependency-update` |
| `hotfix/` | Agreed fix based on stable `10.03`. | `hotfix/127-installer-download` |

## Install and validate locally

Use a separate checkout and port from any personal installation. With Node 22+:

```sh
npm ci --include=optional
node scripts/launch.mjs --local --check
PORT=3001 npm run dev
```

Without Node, `bash start.sh --local` on macOS/Linux or `Start-Konnectivity.bat` on Windows prepares the runtime automatically. Stop that server before starting development mode. See [setup](docs/SETUP.md) for platform commands. In Windows PowerShell, set `$env:PORT = '3001'` before `npm run dev`.

Keep preview state outside the source tree, for example `DATA_DIR=../konnectivity-preview-data CACHE_DIR=../konnectivity-preview-cache PORT=3001 npm run dev` on macOS/Linux. The release scanner rejects runtime folders in the release tree. Never point tests at personal `DATA_DIR` or `CACHE_DIR`; the integration runner creates disposable directories itself.

Run checks relevant to your change. Code changes should pass the standard validation:

```sh
npm test
npm run test:integration
npm run build
npm run typecheck
npm run check:release
```

Installer changes should also pass:

```sh
node scripts/test-installers.mjs
node scripts/test-desktop-tools.mjs
node scripts/test-launcher.mjs
```

Check shared behavior with two listeners when relevant. For UI changes, verify phone widths, keyboard access, scrolling and dialogs; include privacy-safe screenshots. Add meaningful regression coverage for synchronization, access controls and persistence changes.

## Pull the latest changes

Before opening or updating a PR, commit your work and fetch upstream. Merge the latest development changes into your topic branch:

```sh
git fetch upstream --prune
git switch feature/123-playlist-improvements
git merge upstream/main
# Resolve any conflicts, then rerun the relevant checks.
git push -u origin feature/123-playlist-improvements
```

To update your clean local development branch:

```sh
git switch main
git pull --ff-only upstream main
```

Do not run `git pull` blindly on an unrelated working branch. Do not force-push shared branches. If you choose to rebase your own PR branch, coordinate with anyone using it and use `git push --force-with-lease`, never a plain `--force`.

## Open a pull request

1. Push your topic branch to your fork, then open a PR against upstream `main`.
2. Use a clear title and explain the problem, resulting behavior, linked issue and validation. Keep the change focused.
3. Include screenshots for visual changes, synthetic fixtures for tests and documentation/changelog updates where applicable.
4. Use a draft PR while the work is incomplete. Mark it ready for review once the description and checks are current.
5. Address feedback in the same PR, push follow-up commits and request another review when ready.

Do not include cookies, personal audio, chat/background uploads, playlists from your personal instance, admin hashes, API keys, `.env` files, tunnel URLs or local absolute paths. Review the staged diff and screenshot content as well as running the scanner.

## Review and merge process

The maintainer, currently [@shivam-aggarwal-git](https://github.com/shivam-aggarwal-git), reviews contributions. [CODEOWNERS](.github/CODEOWNERS) requests maintainer review automatically for supported pull requests.

Reviewers check correctness, privacy/security, synchronization, persistence, mobile usability, compatibility and the accompanying tests/docs. Treat review comments as a discussion; explain disagreements and update the implementation or description as needed. Resolve threads after the concern is addressed.

The contribution policy is to obtain at least one maintainer approval and passing applicable CI before merge. A maintainer performs the merge, normally using **Squash and merge** so one focused PR becomes one commit. New changes after approval may need another review. Contributors should not merge their own PR without maintainer agreement. Delete the topic branch after merge.

These are the documented review expectations. CODEOWNERS requests reviews; it does not itself prevent a merge or a direct push. Enforcing approvals, status checks and dismissed stale reviews requires repository branch-protection/ruleset configuration by the maintainer.

## Stable fixes and backports

For an agreed stable fix, start from `10.03`:

```sh
git fetch upstream --prune
git switch -c hotfix/127-installer-download upstream/10.03
# Make the focused fix, commit and run the relevant checks.
git push -u origin hotfix/127-installer-download
```

Open that PR against **`10.03`** and explain why stable users need it. Use the same review and CI process. The maintainer should also bring the fix to `main`, or backport an existing `main` fix with `git cherry-pick -x COMMIT_SHA` on a hotfix branch. Link the original PR/commit and resolve compatibility differences explicitly. Do not merge an entire development branch into stable just to ship one fix.
