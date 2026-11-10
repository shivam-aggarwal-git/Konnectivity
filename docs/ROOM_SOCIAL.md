# Plans, polls, clips, location pins and room calls

Open **Plans & calls** from the room header after joining. Everything uses the existing theme and host-approved room membership.

## Plans and polls

Any seated, unmuted member can create a plan with an IST date/time, venue and INR budget per person. Members can change an RSVP or suggest a venue/time/activity. Budget-based ideas are illustrative, not venue searches, verified prices, bookings, or AI recommendations. Polls have 2–6 unique options, live counts and one replaceable vote per room identity. Creators and hosts can close their items. Plans, RSVPs, suggestions and poll results are saved in `data/room-social.json`.

Room identities follow Konnectivity's existing nickname/session model, not verified personal accounts. Brief reconnects keep an identity; restarting or rejoining after the reconnect grace period creates a new one. These polls are for friends making decisions, not fraud-resistant elections. No real-world identity guarantee is implied.

## Sharing videos and locations

Use the video button in chat for an MP4 or WebM clip up to 50 MB. Playback uses the browser's native controls and is local to that viewer. Existing synchronized YouTube playback is unchanged. Codecs depend on browser/device support. Video uploads are bounded to two concurrent requests; storage defaults to 1 GB (`CHAT_VIDEO_MAX_MB`). Protected range requests allow seeking. Video files and their index live under `data/chat-videos/` and `data/chat-videos.json`. Chat messages, including clip references and pins, retain the existing live-session-only chat lifetime; files remain stored until an operator removes them. There is no automatic video deletion UI yet.

Use the pin button to enter a meeting point's coordinates or ask the browser for a one-time device location. Preview the coordinates and press **Attach pin**, then **Send**. No location is sent by simply opening the picker or granting permission. There is no continuous tracking. Opening a pin loads an external Google Maps page. Pins are visible to everyone admitted to that room.

## Calls and security boundary

Calls use a native WebRTC peer-to-peer mesh capped at six simultaneous room members; no external Jitsi/MiroTalk room is created. Joining is explicit, with voice-only and camera options. Each browser opens its own camera/mic permission prompt. Screen sharing uses the browser's own picker, shares video only, and may be unsupported on mobile browsers. Leaving, losing the room connection, being kicked, or unmounting the room stops local capture and closes peer connections. Closing the plans dialog does not hang up; the visible call dock lets the user return or leave. Remote audio has a tap-to-play fallback for browser autoplay restrictions. Use headphones to avoid speaker feedback with room music.

Only seated connected members can join. Pending guests and outsiders are rejected; both sender and recipient must have opted into the call in the same room before the server relays any SDP/ICE signaling. Sender identity is assigned by the server, not supplied by clients. Membership removal revokes signaling and instructs remaining clients to close that peer's connection. Call state and signals are ephemeral; the application does not record calls.

WebRTC encrypts media with DTLS-SRTP directly between browsers, including when using a TURN relay. The application/signaling server remains trusted: it delivers JavaScript and exchanges certificate fingerprints; there is no independent identity verification or safety-number UI. This is not a claim of protection against a malicious app server or compromised endpoint. Direct calls can reveal peers' public IP addresses to each other. Set `CALL_RELAY_ONLY=true` with working TURN to require relay-only ICE. HTTPS is required outside localhost. Self-only permissions policy permits camera, mic, geolocation and display capture; cross-origin access remains blocked.

### TURN deployment

For reliable calling across carrier NAT, VPNs and restrictive Wi-Fi, run a coturn-compatible TURN service (or use an existing one supporting shared-secret credentials):

- `CALL_TURN_URL`: comma-separated `turn:`/`turns:` endpoints.
- `CALL_TURN_SECRET`: the TURN server's shared auth secret, stored only in the server environment.
- `CALL_STUN_URL`: optional STUN URI; default is `stun:stun.l.google.com:19302`.
- `CALL_RELAY_ONLY`: optional `true` to forbid direct ICE candidates.

The server issues HMAC-SHA1 TURN credentials valid for one hour only after room-call admission. Browser callers receive temporary credentials, never the shared secret. Long calls need to rejoin when new ICE authentication is needed after expiry. Docker Compose passes these variables through. TURN is separate infrastructure; Konnectivity's HTTP Cloudflare tunnel does not relay WebRTC media. A stable HTTPS origin is preferable for persistent browser permissions.

Without TURN, calls can succeed on compatible networks but are not guaranteed across the internet. The UI shows this limitation. Never configure relay-only mode without TURN.

## Verification

`node scripts/test-room-social.mjs` creates disposable state and exercises room isolation, pending/muted access, live plans/RSVP/polls, creator/host controls, encrypted-call signaling admission and removal, ephemeral TURN credentials, pin validation, video upload signatures/limits, range responses, cross-room video denial, and revoked tokens. Included in `npm run test:integration` alongside existing playback, sync, chat-image, library and moderation tests.

Actual camera/microphone interoperability, mobile screen sharing, TURN traversal, and multi-device media quality require real-browser/device testing. Passing signaling tests is not evidence that an actual media call was completed.

References: https://www.rfc-editor.org/rfc/rfc8827.html · https://webrtc.org/getting-started/peer-connections · https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation

## Call and playback update

The interface uses professional English. Calls now have local camera/microphone preview, an incoming-call banner, accept/decline controls, unanswered-call expiry, a 30-second peer-connection deadline, and an explicit audio-unlock control for browsers that block autoplay. SDP/ICE operations are serialized; one peer initiates offers to avoid simultaneous negotiation. The user-supplied sounds are bundled under `public/sounds/`. The header sound toggle controls both call and chat notifications on this device. Browser gesture restrictions can still prevent unsolicited audio.

**Player message** sends up to 100 characters plus a selected emoji to everyone in the current room. The message and floating particles appear over the player scene for the selected 15-second, 30-second, or permanent duration. Sending is restricted to admitted, unmuted members and rate-limited. Reduced-motion preferences suppress floating particles.

Uploaded songs are fully downloaded into a private, in-memory Blob on each listener's browser before playback; this exceeds the requested 50% prebuffer. A progress indicator and retry control are shown. The room waits for listeners to be ready; local-file buffering is not released by the ordinary streaming timeout. The host can skip a stalled track, and disconnected participants are removed from the wait. This trades initial download time and device memory for playback that no longer depends on additional network reads. Buffers are revoked on track/token change and leaving the component, and are never put into shared HTTP or service-worker caches. Crossfade into an uploaded track is disabled so it cannot bypass the buffer barrier.

**Leave party** and ordinary browser-back navigation show a confirmation. Refresh/tab-close uses the browser's native leave warning. Browsers may restrict unload warnings or skip them during OS termination, crashes, or some mobile lifecycle events. The host can check **End and clear this room when I leave**. This deletes the room's identity/invitation, queue, playback, chat, plans and polls, and disconnects its members. Uploaded media and instance library files are preserved. On an unexpected host disconnect, the existing reconnect grace period applies; a returning host cancels the pending clear. If another host is still connected, the room remains open.

## Cloudflare TURN setup and 750 GB protection

For calling without router configuration, use Cloudflare Realtime TURN:

1. Create a TURN key in Cloudflare's Realtime TURN dashboard.
2. Create an API token with **Account Analytics** read permission for that account.
3. Put `CALL_CF_KEY_ID`, `CALL_CF_API_TOKEN`, `CALL_CF_ACCOUNT_ID`, and `CALL_CF_ANALYTICS_TOKEN` in `.env.local` in the project directory. Never put these in a `NEXT_PUBLIC_` variable or paste them into client code. The custom server loads this optional file at startup; Docker Compose also passes these variables through.
4. Restart the server. Without all necessary credentials/analytics access, Cloudflare relay calls are intentionally blocked. Direct calling remains available when no Cloudflare provider is configured.

The server checks the account's month-to-date TURN egress via Cloudflare GraphQL before issuing relay credentials and every 30 seconds during calls. The cutoff is fixed at **750,000,000,000 bytes (750 decimal GB)** per UTC calendar month. Once the provider reports that threshold, the server persists a monthly lock, rejects new calls, signals all active callers to stop, and requests revocation of their issued credentials. Analytics errors fail closed. Credentials live for five minutes and are renewed every two minutes.

**This is an application-side guard based on provider-reported usage, not a guaranteed provider billing cap.** Analytics can be delayed or sampled, requests can be in flight, and revoked/expired credentials may not instantly terminate existing relay allocations. Other applications using the account can consume bandwidth too. Usage between reports may exceed the threshold. Cloudflare's advertised free allowance is shared with SFU use; the current implementation monitors account TURN egress, not unrelated SFU traffic. Use a dedicated account/key and monitor the provider dashboard. A provider-enforced spending limit is needed for an absolute billing guarantee.

Cloudflare setup: https://developers.cloudflare.com/realtime/turn/generate-credentials/
Analytics: https://developers.cloudflare.com/realtime/turn/analytics/
Pricing: https://developers.cloudflare.com/realtime/sfu/pricing/

Running coturn on a Mac without router port forwarding cannot provide a generally reachable internet relay. It is not automatically enabled as a fallback. A local relay is useful only on a reachable LAN; the website's Cloudflare HTTP tunnel cannot tunnel TURN traffic.

## Navigation, visual themes and playback recovery

The phone header now has Back, Home, and a collapsible Room tools menu. Internal Back/Forward follows room-section history, while browser departure still uses the room leave confirmation. Horizontal swipes navigate Now, Queue and Chat; interactive controls are excluded from swipe handling. Five new shared themes are available: Midnight, Forest, Plum, Graphite and the light Pearl theme.

Player messages offer 15 seconds, 30 seconds, or Permanent. Permanent messages are saved with their room, sent to returning/new members, and remain until replaced or cleared. Timed messages are restored only for their remaining server-side lifetime. A single portal overlay renders above both normal and expanded/background-only player scenes. The Clear player message action removes it for the room. Motion preferences suppress floating particles.

The latest supplied SVG is the branding source. Optimized logo, PNG/PWA/touch icons, an ICO favicon and social-card assets are derived from it.

The downloader now applies a verified CA bundle consistently on macOS and supported Linux installations. Certificate validation is never disabled. An explicitly configured missing `SSL_CERT_FILE` is rejected. Audio preparation failures pause on the selected track and preserve the remaining queue; Retry does not add a false skipped-history entry. Skip advances only when a room member chooses it. The exact reported YouTube track was downloaded successfully after the CA fix.
