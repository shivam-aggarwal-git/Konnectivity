# Groups and server administration

Open the local showcase at `http://localhost:3000/`, then select **Open Konnectivity**. The **Groups** page is at `/groups`, and the password-protected **SuperAdmin Console** is at `/admin`. For initial server setup, visit `/setup` on the host computer. SuperAdmin sessions expire after eight hours or when the server restarts. Sign out to revoke the current session.

| Role | Responsibilities |
| --- | --- |
| Listener | Join with a private invitation or request a random match. Use playback, media, and call controls allowed by the group admin. |
| Group admin | Own the group, approve or remove listeners, set room permissions, and manage that group's YouTube cookies. |
| SuperAdmin | Manage room inventory, delete rooms, delegate unclaimed groups, and configure branding, TURN, Proxy Pool, storage, and AI DJ. |

## Create, join, or reopen a group

Choose **Create a group**, optionally name it, and enter the room with a display name. The creator's browser keeps the group admin key. Use **Share** inside the room to send a private invitation.

If you enable **Allow random matching** in room settings, visitors can request to join while a group admin is online. They see the room after approval. The group can receive requests before YouTube is set up. Disable matching to remove the group from the pool.

Room settings and media references persist on the host. If a Cloudflare quick tunnel rotates, open the room on the host and send a fresh invitation. To recover group admin access across hostnames, use the private recovery link from **Settings → Room management → YouTube integration** and replace the hostname. Anyone holding that link can administer the group. Keep it separate from the guest invitation.

## Set up YouTube

As the group admin, open **Settings → Room management → YouTube integration → Upload cookies.txt**. The setup prompt provides the same control. Use a Netscape-format export limited to YouTube rather than a full browser export. The upload is a live account session, so keep it private and upload it only to an instance you trust.

The in-app help links to the [Chrome Web Store extension](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) and the [yt-dlp YouTube export guide](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies). New groups need this setup for YouTube playback and link imports. Local media, room calls, and chat are available during setup.

## Manage the server

In **Room management**, search by room name or code. Select individual checkboxes before choosing **Delete selected**. The console shows the selection and asks for the confirmation phrase. **Delete all rooms** covers the entire room inventory, including rooms outside the current search.

Use **Branding** to upload separate PNG, JPEG or WebP files for the logo and favicon, up to 4 MB each. **Restore default** resets the selected asset. In **Server settings**, TURN configures the optional call relay. Proxy Pool configures downloader routing. These are instance settings managed by the SuperAdmin.

See [deployment and backups](../DEPLOY.md), [configuration](CONFIGURATION.md), and [troubleshooting](TROUBLESHOOTING.md).
