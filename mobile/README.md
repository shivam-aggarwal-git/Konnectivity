# Konnectivity Android APK and iPhone IPA

Private Android and iOS clients for your self-hosted Konnectivity listening rooms. No App Store or Google Play listing is needed. These apps provide a native role chooser and run the existing room interface in Android WebView or iOS WKWebView. Music, video, chat, playlists and administration remain on your server.

## Install without development tools

### Android

1. Send `Konnectivity-10.06.1-android.apk` to your phone.
2. Open the APK in Files and allow that app to install it when Android asks.
3. Open Konnectivity and choose your role.

The APK is signed with a local Android development key. Keep the same signing key when rebuilding updates; changing it requires uninstalling the old app. Android 8.0 or later is required. Android Studio is only used to **build**, never needed to install or use the APK.

### iPhone

1. Transfer `Konnectivity-10.06.1-unsigned.ipa` to the iPhone.
2. Import it through your existing AltStore or SideStore installation and sign it with your Apple account.
3. Open Konnectivity and choose your role.

This is an **unsigned device IPA**, not an App Store upload or a simulator app. iOS does not install unsigned IPA files by tapping them in Files. Each person signs it through their own sideloading setup; no Apple account credentials are stored in this project. iOS 17 or later is required. With a free Apple account, periodic signing refresh is required. See [Apple’s Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account).

## Entry flow

| Role | What opens |
| --- | --- |
| Admin | Enter server URL → existing SuperAdmin login → console after authentication. |
| Host | Enter server URL → Groups → create or open a group and party using existing permissions. |
| Listener | Paste the complete `/r/ABC123` room invitation and enter a name → join automatically. Host approval still applies when enabled. |

Use the public **HTTPS** tunnel URL, not `localhost:3000`: localhost on a phone means the phone itself. The laptop server and tunnel must stay running. If a temporary tunnel URL changes, enter the new URL in the app; rebuilding is unnecessary. Existing room tokens in invitation fragments are preserved. Selecting a role never grants additional permissions.

The native shell requests microphone, camera or location permissions only when a room feature needs them. Media capture is allowed only for the server origin the user selected. Outside links open in the system browser. Each app keeps its own website session and does not copy the desktop browser’s login.

## Playback limits

Both shells allow inline video and media playback without an additional WebView tap. iOS declares background audio support. This improves playback continuity but does not guarantee that WebView/YouTube playback survives device locks, OS suspension, network interruption, or every provider restriction. These are WebView clients using the existing player, not a replacement native audio engine. Hardware installation and background-playback testing are still needed on your phones.

## Rebuild the packages

The repository contains source and reproducible scripts. Binaries, SDK paths, signing keys and build caches are ignored by Git.

```sh
./mobile/scripts/build-android.sh
./mobile/scripts/build-ios.sh
```

Android requires JDK, Android SDK platform 35, and network access for Gradle dependencies. The checked-in Gradle wrapper downloads its own Gradle. iOS requires macOS and the Apple iPhoneOS SDK/toolchain from Xcode. The iOS script compiles an arm64 device app and packages `Payload/Konnectivity.app` without signing, so a simulator runtime is unnecessary. An Xcode project is also included for development and optional device signing.

Output is written to `mobile/artifacts/`. Do not commit Android signing keys or Apple certificates. The role chooser’s default server URL is editable on-device; it is only a convenience, not an authentication secret.


## Emoji Mart and personal YouTube accounts

Chat, message reactions, floating room reactions, and song comments use the same full Emoji Mart picker, including categories, search and skin tones. The picker catalog is bundled with the server UI, so both installed apps receive it without a store update. [Emoji Mart source and MIT license](https://github.com/missive/emoji-mart).

Under **Settings → My YouTube account**, an approved listener can optionally upload their own Netscape-format YouTube cookies. That listener’s server-resolved media uses a separate account and cache. Removing the file switches back to host cookies. Other listeners cannot fetch the file through the app. Files are stored privately on the trusted server, not kept solely on the phone. The host’s shared preparation still uses the host configuration.

Uploaded cookie files do not sign a YouTube iframe into an account. Embedded playback uses the phone WebView’s own YouTube session. Cookie uploads cannot grant embed permission or remove provider restrictions.


Focus mode keeps lyrics in the player without restoring the song artwork or cover. The latest server also includes optional personal cookie settings and matching People, Queue and notification badges; all are used by both mobile packages.
