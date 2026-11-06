# Security

Do not publish vulnerabilities together with working credentials, room tokens or a public exploit against an active instance. Use the publishing repository’s private security reporting feature, if enabled, or a maintainer-designated private contact. This source snapshot has no configured security email or guaranteed response SLA.

## Operating safely

- Claim a fresh instance at `/setup` before exposing it to untrusted networks. The desktop tunnel waits for this; an external reverse proxy does not.
- Use HTTPS and an admin password. Restrict access with firewall rules, a VPN or reverse proxy authentication when appropriate.
- Room links are invitations. Participants can control playback and access the shared library; do not treat rooms as isolated tenant accounts.
- `data/` contains admin credentials, tokens, settings, uploaded music and chat media. Protect it and its backups as private data.
- Downloader cookies are optional credentials. Keep them server-side and out of source control; revoke them through the source account if exposed.
- Never mount a personal production data directory into a test or demonstration instance.
- Update dependencies and review advisories before deployment. No independent security audit is claimed.

The release scanner detects a limited set of risky files and credential patterns. It cannot certify that a repository or Git history is secret-free.
