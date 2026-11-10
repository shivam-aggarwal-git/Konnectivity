"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "login", password }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not sign in.");
      setPassword("");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="kn-admin kn-admin-login">
      <div className="kn-admin-login-inner">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="sw-glass grid gap-4 p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
          <Lock className="size-3.5" /> Admin
        </div>
        <h1 className="font-display text-3xl font-bold">
          Sign in to admin
        </h1>

        <div>
          <Label htmlFor="admin-password" className="mb-1.5 block">Password</Label>
          <Input
            id="admin-password"
            autoComplete="current-password"
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-sm border border-[color-mix(in_oklab,var(--destructive)_35%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] px-4 py-3 text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}

        <Button variant="accent" size="lg" onClick={login} disabled={busy} className="kn-admin-primary gap-1.5">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-xs text-muted">
          Lost the password? Delete <code className="text-accent-2">data/admin.json</code>{" "}
          on the server and reload to run setup again.
        </p>
      </div>
      </div>
    </main>
  );
}
