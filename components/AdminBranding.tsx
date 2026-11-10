"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

function BrandingAsset({ asset, label }: { asset: "logo" | "favicon"; label: string }) {
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const endpoint = "/api/branding/" + asset;

  async function update(file?: File) {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(endpoint, file ? { method: "PUT", body: file } : { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error === "body_too_large" ? "Image must be 4 MB or smaller."
          : result.error || "The image could not be saved.");
      }
      const timestamp = Date.now();
      setRevision(timestamp);
      if (asset === "favicon") {
        document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
          const url = new URL(link.href);
          if (url.pathname !== endpoint) return;
          url.searchParams.set("v", String(timestamp));
          link.href = url.href;
        });
      }
      setStatus(file ? label + " saved." : "Default " + label.toLowerCase() + " restored.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-current/15 p-4">
      <label htmlFor={"branding-" + asset} className="font-semibold">{label}</label>
      <img className="size-16 rounded-lg object-contain" src={endpoint + "?v=" + revision} alt={label + " preview"} />
      <input id={"branding-" + asset} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void update(file);
        }} />
      <Button type="button" variant="outline" className="w-fit" disabled={busy} onClick={() => void update()}>
        Restore default
      </Button>
      <p role="status" className="text-sm">{busy ? "Saving…" : status}</p>
    </div>
  );
}

export default function AdminBranding() {
  return (
    <section id="admin-branding" className="sw-glass kn-admin-panel space-y-3">
      <h2 className="text-lg font-semibold">Branding</h2>
      <p>Set the logo and browser icon for every room. Choose a PNG, JPEG or WebP up to 4 MB.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <BrandingAsset asset="logo" label="Logo" />
        <BrandingAsset asset="favicon" label="Favicon" />
      </div>
    </section>
  );
}
