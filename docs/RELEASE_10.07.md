# Konnectivity 10.07 — Listen, watch and play together

## Multiplayer games

Open Games beside Mood and Chat to choose X & O, Four in a row, Last match, Dice duel, Rock paper scissors or Memory pairs. Each game explains its rules. Invite a listener; accepting the notification opens and joins the game. Turn messages, restart and spectator protection are shared across the room.

Minimize opens a movable floating window. Drag its handle, reopen the board, hide the window locally, or quit with confirmation. Quitting releases your seat and forfeits an active round. Music continues.

## Finding settings and rooms

Settings search tolerates misspellings and searches nested appearance, synchronization, cookie, host and room controls. Results respect the viewer’s role. The desktop sidebar has a persistent slide-toggle for an icon rail.

Groups uses a dark mobile-first layout. Settings → Switch room lists rooms whose hosts opted into discovery and are online; random switching uses the same eligible pool. Private rooms remain private and existing admission rules apply.

Hosts can use Share → Refresh room invite. Previous invitation tokens stop admitting new visitors; connected listeners and other rooms are preserved. A tunnel belongs to the whole server and cannot be refreshed for only one room.

## Video and music

Native YouTube play/pause and volume/mute changes propagate to the room transport; app controls also drive the embed. Programmatic synchronization events are filtered to avoid feedback loops. Native captions, quality, seeking and fullscreen remain available when provided by YouTube. Shorts leave native controls accessible below the gesture area.

Konnectivity Watch next cards load videos inside the app. An embedded playlist supports native Next, and video changes inside the iframe are adopted into room playback. YouTube’s own outbound end-card links cannot be intercepted by the web app. See [YouTube’s IFrame API](https://developers.google.com/youtube/iframe_api_reference).

Video playback silently preloads server-resolved audio in its persistent audio element for switching to Music. Preparation does not pause the video. Download availability still depends on credentials and the recording. Cookie uploads retry failed playback; personal-cookie checks and cache identities remain separate from host credentials.

Empty-search suggestions use the chosen/current recording or recent listening instead of generic rotating playlists. Related results prioritize the seed artist, and fallback artist searches reject unrelated artists.

## Reliability and privacy

Includes shared local-library restoration, inline lyrics retry, chat mentions, co-host controls, persistent preferences, action feedback, SVG rasterization, and runtime GIPHY configuration fixes. Mobile wrapper sources no longer contain a temporary server hostname; users supply their server URL.

## Validation

Production build and TypeScript checks; full isolated integration suite; regression tests for private cookie access, invitations and game quitting, Shorts lanes, all six game engines, SVG conversion and active-content rejection, native transport/volume state handling, shared catalogs, roles, persistence and security. Mobile chooser/help/floating window/search and desktop sidebar were inspected in a browser. Screenshots use fictional demonstration data.
