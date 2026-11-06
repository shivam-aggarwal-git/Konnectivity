# Contributing

Read [LICENSE](LICENSE) and [NOTICE](NOTICE) before contributing. This derivative retains the upstream PolyForm Noncommercial license. Do not describe it as MIT, Apache or OSI open source.

## Local workflow

```sh
npm ci
PORT=3001 npm run dev
npm run typecheck
npm test
npm run test:integration
npm run build
npm run check:release
```

Use a separate port and directories when another instance is running. Never point tests at real `DATA_DIR` or `CACHE_DIR`; the integration runner allocates temporary directories itself. Test shared behavior with two browsers, and verify mobile layout and keyboard access when changing the UI.

Keep changes focused. Explain the problem, resulting behavior and validation in the pull request. Include privacy-safe screenshots for visual changes. Add meaningful regression coverage for changes to synchronization, access checks or persistence.

Do not commit cookies, personal audio, chat uploads, admin hashes, API keys, `.env` files, public tunnel addresses or local absolute paths. Use synthetic test fixtures. The release scanner is a useful check, not a guarantee against every kind of secret. Review the staged diff and image content too.

Use your hosting repository’s issue tracker for reproducible bugs and feature requests. Include OS, Node version, browser, steps, expected/actual behavior and redacted logs. Follow [SECURITY.md](SECURITY.md) for vulnerabilities.
