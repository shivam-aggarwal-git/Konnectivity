"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Radio, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function CreateRoom({defaultInviteOnly=true}:{defaultInviteOnly?:boolean}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [discoverable, setDiscoverable] = useState(false);
  const [matching, setMatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [inviteOnly, setInviteOnly] = useState(defaultInviteOnly);
  const inviteOnlyId = useId();

  async function start() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, inviteOnly, discoverable }),
      });
      const body = await res.json().catch(() => null);
      // A refusal still returns JSON, and without this check the missing code
      // was pushed to the router as the string "undefined".
      if (!res.ok || !body?.code) {
        setError(body?.error || "Could not create a room. Is the server still running?");
        setLoading(false);
        return;
      }
      // Persist the durable owner token so this browser reclaims host on return.
      if (body.ownerToken) localStorage.setItem(`sw_owner_${body.code}`, body.ownerToken);
      router.push(`/r/${body.code}?host=1`);
    } catch {
      setError("Could not create a room. Is the server still running?");
      setLoading(false);
    }
  }

  async function joinRandom() {
    setMatching(true);
    setError("");
    try {
      const res = await fetch("/api/rooms/random", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.code) throw new Error(body.error || "Could not find an open group.");
      router.push(`/r/${body.code}?request=1`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not find an open group.");
    } finally {
      setMatching(false);
    }
  }

  // Guests arriving with a code spoken aloud had no way in before this — the
  // page only told them to go find a link.
  async function join() {
    const c = code.trim().toUpperCase();
    if (c.length !== 6 || joining || loading || matching) return;
    if (localStorage.getItem(`sw_owner_${c}`)) { router.push(`/r/${c}?host=1`); return; }
    setJoining(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms?code=${encodeURIComponent(c)}`);
      if (!res.ok) {
        setError(res.status === 401 ? "Open the complete invitation link from your group admin to join a private group." : `No room called ${c}. Check the code and try again.`);
        setJoining(false);
        return;
      }
      router.push(`/r/${c}`);
    } catch {
      setError("Could not reach the server.");
      setJoining(false);
    }
  }

  return (
    <div className="kn-group-choices grid w-full gap-5 text-left md:grid-cols-2">
      <section className="flex min-w-0 flex-col items-start gap-4 rounded-3xl border border-current/15 bg-white/45 p-5 sm:p-7">
        <h2 className="font-display text-xl font-bold"><Radio size={22} aria-hidden/> Create a group</h2>
        <p className="text-sm text-muted">You become the group admin and decide who can join.</p>
        <label className="w-full max-w-xs text-left text-sm text-muted">
          Group name <span className="text-xs">(optional)</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={15}
            className="mt-1 h-11 w-full rounded-full border border-current/20 px-4 text-ink" placeholder="Name your group" />
        </label>
        <Button
          variant="accent"
          size="lg"
          onClick={start}
          disabled={loading || matching || joining}
          className="h-12 gap-2 px-7 text-sm"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
          {loading ? "Creating group…" : "Create a group"}
        </Button>

        <label
          htmlFor={inviteOnlyId}
          className="flex w-full max-w-xs items-center justify-between gap-3 text-xs text-muted"
        >
          <span>
            Approve new listeners
            <span className="block text-[11px] text-muted/70">
              You approve each person before they can join
            </span>
          </span>
          <Switch id={inviteOnlyId} disabled={discoverable} checked={discoverable || inviteOnly} onCheckedChange={setInviteOnly} />
        </label>

        <label className="flex w-full max-w-xs items-start gap-3 text-left text-xs text-muted">
          <input type="checkbox" checked={discoverable} onChange={e => setDiscoverable(e.target.checked)} />
          <span>Let visitors find my group through random matching. I still approve every join request.</span>
        </label>

      </section>
      <section className="flex min-w-0 flex-col items-start gap-4 rounded-3xl border border-current/15 bg-white/45 p-5 sm:p-7">
        <h2 className="font-display text-xl font-bold"><Shuffle size={22} aria-hidden/> Join a group</h2>
        <p className="text-sm text-muted">Try a random match, enter a room code, or open a private invitation. Random matches need approval from an online group admin.</p>
        <Button type="button" variant="outline" onClick={joinRandom} disabled={matching || loading || joining} className="h-11 gap-2">
          {matching ? <Loader2 className="size-4 animate-spin" /> : <Shuffle className="size-4" />}
          {matching ? "Finding a group…" : "Find a random group"}
        </Button>
        <div className="flex w-full max-w-xs items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && join()}
            maxLength={6}
            placeholder="ROOM CODE"
            aria-label="Room code"
            spellCheck={false}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-full border border-current/20 bg-white/50 px-4 text-center font-mono text-sm tracking-[0.3em] text-ink placeholder:tracking-[0.18em] placeholder:text-muted/60 focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          />
          <Button
            variant="outline"
            onClick={join}
            disabled={joining || loading || matching || code.trim().length < 6}
            className="h-11 shrink-0 gap-1.5 px-4"
          >
            {joining ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            Join
          </Button>
        </div>

      </section>
      {error && (
        <p className="rounded-xl border border-current/15 bg-white/50 p-3 text-sm text-ink md:col-span-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
