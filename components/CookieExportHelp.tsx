export default function CookieExportHelp() {
  return (
    <details className="rounded-xl border border-current/15 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">How to get a YouTube cookies.txt file</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>On a computer, install <a className="underline" href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer">Get cookies.txt LOCALLY from the Chrome Web Store</a>. In the extension’s Chrome settings, enable <strong>Allow in Incognito</strong>.</li>
        <li>Open a new Incognito window with one tab. Sign in to YouTube, then go to <strong>youtube.com/robots.txt</strong> in the same tab.</li>
        <li>Open the extension and export the current site in <strong>Netscape</strong> format. Close the Incognito window after exporting.</li>
        <li>Return here, choose <strong>Upload cookies.txt</strong>, and select the downloaded file.</li>
      </ol>
      <p className="mt-3">The file contains a live sign-in session. Upload it only to a server you trust and keep it out of chats and screenshots.</p>
      <a className="mt-2 inline-block underline" href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies" target="_blank" rel="noopener noreferrer">YouTube export guide from yt-dlp</a>
    </details>
  );
}
