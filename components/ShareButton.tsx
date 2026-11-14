"use client";

import { useEffect, useState, useRef } from "react";
import {notify} from "./FeedbackToast";
import { Link2, RefreshCw, Check, Globe, Wifi, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./ui/dialog";
import { cn } from "@/lib/cn";

/**
 * Share the room.
 *
 * The host almost always has the app open on localhost, so copying the address
 * bar would hand friends a link only the host can open. The server knows the
 * address the outside world can reach — a tunnel, a domain, whatever — and that
 * is what gets offered when it exists.
 */
export default function ShareButton({ code,onRefresh }: { code: string;onRefresh?:()=>Promise<string> }) {
  const wrapRef=useRef<HTMLDivElement>(null);
  const [refreshing,setRefreshing]=useState(false),[confirmRefresh,setConfirmRefresh]=useState(false);
  const [invite,setInvite]=useState("");
  const [open, setOpen] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    let alive = true;
    const load = () =>
      fetch("/api/share")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && setPublicUrl(d?.publicUrl || null))
        .catch(() => {});
    load();
    // The tunnel can come up after the room is already open.
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(()=>{if(!open)return;let alive=true;fetch(`/api/room-invite?code=${encodeURIComponent(code)}`).then(r=>r.ok?r.json():null).then(d=>{if(alive&&d?.invite)setInvite(d.invite);}).catch(()=>{});return()=>{alive=false;};},[open,code]);

  const isLocal = /^https?:\/\/(localhost|127\.|\[?::1)/i.test(origin);
  const base = publicUrl || origin;
  const link = base && invite ? `${base}/r/${code}?invite=${encodeURIComponent(invite)}` : "";
  // Reachable by people elsewhere, rather than only on this machine or LAN.
  const reachable = Boolean(publicUrl) || (!isLocal && /^https:/.test(origin));

  const copy = async () => {
    if(!link)return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      return;
    }
    setCopied("link");
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
        // The label is hidden below sm:, which would otherwise leave a button
        // with no accessible name on exactly the devices most people use.
        aria-label="Share this room"
        aria-expanded={open}
      >
        <Link2 className="size-3.5" />
        <span className="hidden sm:inline">Share</span>
      </Button>

      {open && (
        <Dialog open={open} onOpenChange={setOpen}><DialogContent className="kn-share-dialog"><DialogTitle>Share your room</DialogTitle><DialogDescription>Invite someone to listen, watch and connect.</DialogDescription>
            <div className="sw-label mb-3">
              {reachable ? <Globe className="size-3.5" /> : <Wifi className="size-3.5" />}
              {reachable ? "Private room invitation" : "Local network only"}
            </div>

            <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.04] p-2">
              <input
                readOnly
                value={link}
                placeholder="Preparing private invitation…"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent px-1 text-xs text-ink outline-none"
                aria-label="Room link"
              />
              <Button variant="accent" size="sm" onClick={copy}
                disabled={!link} className="shrink-0 gap-1.5">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <p className={cn("mt-3 text-xs", reachable ? "text-muted" : "text-[var(--warning)]")}>
              {reachable ? (
                <>
                  Send this to anyone — they don&rsquo;t need an account, and the room code is{" "}
                  <span className="font-mono font-semibold text-ink">{code}</span>.
                </>
              ) : (
                <>
                  This link only works on your network. Restart Konnectivity without{" "}
                  <code className="text-accent-2">--local</code> to get a public link you can send
                  to anyone.
                </>
              )}
            </p>

            {onRefresh&&<div className="kn-invite-refresh"><Button variant="outline" disabled={refreshing} onClick={()=>setConfirmRefresh(value=>!value)}><RefreshCw size={16}/>Refresh room invite</Button>{confirmRefresh&&<><p className="text-sm text-muted">The old invitation will stop accepting new joins. People already in this room stay connected. Other rooms and the server tunnel are unchanged.</p><Button disabled={refreshing} onClick={async()=>{setRefreshing(true);try{setInvite(await onRefresh());setConfirmRefresh(false);setCopied(null);notify('Room invitation refreshed. Copy and share the new link.');}catch(error){notify(error instanceof Error?error.message:'Could not refresh the invite.');}finally{setRefreshing(false);}}}>{refreshing?'Refreshing…':'Confirm refresh'}</Button></>}</div>}
            {reachable && publicUrl && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted">
                <QrCode className="mt-0.5 size-3 shrink-0" />
                Invitations belong to this room. A host can refresh the invite without interrupting anyone.
              </p>
            )}
          </DialogContent></Dialog>
      )}
    </div>
  );
}
