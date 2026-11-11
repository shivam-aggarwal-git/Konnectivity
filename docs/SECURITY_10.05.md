# Security and deployment in 10.05

Before upgrading, stop the application and back up the private data directory. Install from the 10.05 branch and restart the server. Sign in to SuperAdmin again after the upgrade.

- SuperAdmin sessions use random credentials with an eight-hour lifetime. Signing in rotates the current session, and signing out revokes it. Sessions also end when the server restarts.
- Production pages use a nonce-based Content Security Policy. Browser writes must originate from the same app origin. Admin responses use private caching controls.
- A returning room member needs their existing room credential to reclaim a reconnecting seat. Photo and chat video reads in the browser use the room cookie. Existing audio and casting URLs may still use a room credential in the query string.
- TURN credentials last five minutes. The app limits issuance and renewal and checks both peers are in the same call. Relay-only mode filters out direct ICE candidates when enabled.
- Datastore writes replace files atomically. The Docker Compose configuration binds the published port to loopback, drops Linux capabilities, and disables privilege escalation.

A public deployment needs HTTPS and a reverse proxy that overwrites forwarded headers. Configure the public URL to match the externally visible origin. Relay allocation quotas, UDP firewall rules, and provider bandwidth enforcement belong to the TURN deployment. See [deployment instructions](../DEPLOY.md) and [server configuration](CONFIGURATION.md).

The integration suite exercises session expiry and revocation, CSRF rejection, room membership, private media, TURN renewal limits, and signaling authorization on disposable fixtures. Live relay and proxy behavior depend on the deployed infrastructure.
