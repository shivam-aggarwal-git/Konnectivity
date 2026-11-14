"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import {notify} from "./FeedbackToast";
import CookieExportHelp from "./CookieExportHelp";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

export default function RoomCookies({ code, recovery = false, onboarding = false }: { code: string; recovery?: boolean; onboarding?: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ present: boolean; usesServerCookie: boolean }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [accessLink, setAccessLink] = useState("");

  async function request(method: string, body?: File) {
    const key = localStorage.getItem(`sw_owner_${code}`);
    const response = await fetch(`/api/room-admin/${code}/cookies`, {
      method, body, headers: key ? { "x-room-admin-key": key } : {},
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setStatus(result);
  }

  useEffect(() => {
    void request("GET").catch(error => setError(error.message));
  }, [code]);

  async function change(method: string, file?: File) {
    setBusy(true);
    setError("");
    try { await request(method, file); notify(method === "DELETE" ? "YouTube cookies deleted." : "YouTube cookies added."); if(method === "POST")window.dispatchEvent(new Event("konnectivity:cookies-changed")); }
    catch (error) { setError(error instanceof Error ? error.message : "Cookie update failed."); }
    finally { setBusy(false); }
  }

  const form = (
    <div className="space-y-2">
      <p className="text-sm" role="status">
        {status?.present ? "Room cookie uploaded." : status?.usesServerCookie ? "Using the existing server cookie." : status ? "No room cookie uploaded." : error ? "Could not check cookie status." : "Checking cookie status…"}
      </p>
      <input ref={fileInput} hidden type="file" accept=".txt,text/plain" disabled={busy}
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void change("POST", file);
        }} />
      <Button type="button" variant="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
        <Upload className="size-4" aria-hidden />
        {busy ? "Working…" : status?.present ? "Replace cookies.txt" : "Upload cookies.txt"}
      </Button>
      <CookieExportHelp />
      {status?.present && <Button type="button" variant="outline" disabled={busy} onClick={() => void change("DELETE")}>Remove room cookie</Button>}
      {recovery && <Button type="button" variant="outline" onClick={() => {
        const key = localStorage.getItem(`sw_owner_${code}`);
        if (key) setAccessLink(`${location.origin}/r/${code}?host=1#room-admin=${encodeURIComponent(key)}`);
      }}>Show private admin recovery link</Button>}
      {accessLink && <label className="block text-sm">
        Keep this link private. If the tunnel changes, replace only the hostname.
        <input className="mt-1 w-full rounded border p-2" value={accessLink} readOnly onFocus={event => event.target.select()} />
      </label>}
      {error && <p role="alert" className="text-sm text-muted">{error}</p>}
    </div>
  );

  if (!onboarding) return form;
  return (
    <Dialog open={Boolean(status && !status.present && !dismissed)} onOpenChange={open => { if (!open) setDismissed(true); }}>
      <DialogContent className="kn-settings-dialog !max-w-md">
        <DialogTitle>Set up YouTube for your group</DialogTitle>
        <DialogDescription>
          Upload a YouTube cookies.txt file exported from your browser to enable playback. The file stays on this server and belongs to this group.
        </DialogDescription>
        {form}
        <Button type="button" variant="outline" disabled={busy} onClick={() => setDismissed(true)}>Set up later</Button>
      </DialogContent>
    </Dialog>
  );
}
