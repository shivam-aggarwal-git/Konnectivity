# Security

Do not publish vulnerabilities together with working credentials, room tokens or a public exploit against an active instance. Use the publishing repository’s private security reporting feature, if enabled, or a maintainer-designated private contact. This source snapshot has no configured security email or guaranteed response SLA.

## Operating safely

- Claim a fresh instance at `/setup` before exposing it to untrusted networks. The desktop tunnel waits for this; an external reverse proxy does not.
- Use HTTPS and an admin password. Restrict access with firewall rules, a VPN or reverse proxy authentication when appropriate.
- Full room links contain private invitation tokens. Treat them as passwords. Participants can control playback and access the shared library; do not treat rooms as isolated tenant accounts.
- `data/` contains admin credentials, tokens, settings, uploaded music and chat media. Protect it and its backups as private data.
- Downloader cookies are optional credentials. Keep them server-side and out of source control; revoke them through the source account if exposed.
- Never mount a personal production data directory into a test or demonstration instance.
- Host sign-in is rate limited. Room creation requires host authentication; media and search require approved membership. Cross-origin connections are rejected and malformed socket requests are contained.
- Uploaded music defaults to a 10 GB quota; chat images default to 512 MB, with file-size and concurrency limits. Adjust `UPLOAD_LIBRARY_MAX_MB` and `CHAT_MEDIA_MAX_MB` deliberately.
- The server binds to loopback by default. Set `PUBLIC_URL` to the exact HTTPS origin behind your reverse proxy; do not expose the raw app port. Complete first setup locally (SSH port forwarding on a VPS) before publishing.
- Update dependencies and review advisories before deployment. No independent security audit is claimed.

The release scanner detects a limited set of risky files and credential patterns. It cannot certify that a repository or Git history is secret-free.

## Scope and limitations

This is a single-process, trusted-friends server, not a multi-tenant public streaming platform. Anyone with an invitation can request entry; enable host approval for tighter control. The administrator and anyone with server filesystem access can read downloader cookies. HTTPS, OS patching, protected backups and a firewall remain operator responsibilities. Browser extensions and compromised client devices are outside this app's protections. No guarantee of being “bulletproof” or independently penetration-tested is made.

Run `npm audit --omit=dev`, `npm test`, and `npm run test:integration` before deployment. The integration security suite uses synthetic credentials and disposable data. Overrides for transitive dependencies are covered by search and build smoke tests; review them when updating.
