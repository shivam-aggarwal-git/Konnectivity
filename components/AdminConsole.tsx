"use client";

import CallSettings from "./CallSettings";
import AdminBranding from "./AdminBranding";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowLeft, LogOut, Cookie, Network, HardDrive, Users, Radio, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CookiesPanel from "@/components/CookiesPanel";
import ProxyPanel from "@/components/ProxyPanel";
import StoragePanel from "@/components/StoragePanel";
import AiDjSettings from "@/components/AiDjSettings";

const VIEWS = [
  { id: "rooms", label: "Room management", icon: Users },
  { id: "branding", label: "Branding", icon: Radio },
  { id: "server", label: "Server settings", icon: Network },
] as const;

export default function AdminConsole({ children, view, stats }: {
  children?: React.ReactNode;
  view: "rooms" | "branding" | "server";
  stats: { rooms: number; listeners: number; matching: number };
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="kn-admin">
      <div className="kn-admin-shell">
        <header className="kn-admin-header">
          <div className="kn-admin-topbar">
            <Link href="/" className="kn-admin-home"><ArrowLeft size={16} /> Konnectivity</Link>
            <Button variant="outline" onClick={logout}><LogOut size={16} /> Sign out</Button>
          </div>
          <div className="kn-admin-role"><ShieldCheck size={16} /> Superadmin</div>
          <h1>SuperAdmin Console</h1>
          <p>Manage listening rooms and configure this Konnectivity server.</p>
        </header>
        <dl className="kn-admin-metrics" aria-label="Current server activity">
          <div><dt><Users size={17} /> Total rooms</dt><dd>{stats.rooms}</dd></div>
          <div><dt><Radio size={17} /> Listeners online</dt><dd>{stats.listeners}</dd></div>
          <div><dt><Shuffle size={17} /> Available for matching</dt><dd>{stats.matching}</dd></div>
        </dl>
        <nav className="kn-admin-nav kn-admin-views" aria-label="Dashboard views">
          {VIEWS.map(({id, label, icon: Icon}) => (
            <Link key={id} href={id === "rooms" ? "/admin" : `/admin?view=${id}`}
              aria-current={view === id ? "page" : undefined}>
              <Icon size={17} /> {label}
            </Link>
          ))}
        </nav>
      {view === "rooms" && children}
      {view === "branding" && <AdminBranding />}
      {view === "server" && <>
        <nav className="kn-admin-nav" aria-label="Server settings sections">
          <a href="#admin-calls">TURN relay</a>
          <a href="#admin-youtube">YouTube access</a>
          <a href="#admin-proxies">Proxy Pool</a>
          <a href="#admin-storage">Storage</a>
          <a href="#admin-dj">AI DJ</a>
        </nav>
      <section id="admin-calls" className="sw-glass kn-admin-panel"><CallSettings/></section>
      <section id="admin-youtube" className="sw-glass kn-admin-panel">
        <div className="mb-4 flex items-center gap-2">
          <Cookie className="size-4 text-accent-2" />
          <h2 className="text-lg font-semibold text-ink">YouTube access</h2>
        </div>
        <CookiesPanel />
      </section>

      <section id="admin-proxies" className="sw-glass kn-admin-panel">
        <div className="mb-4 flex items-center gap-2">
          <Network className="size-4 text-accent-2" />
          <h2 className="text-lg font-semibold text-ink">Proxy Pool</h2>
          <span className="ml-auto text-[11px] text-muted">for cloud hosts</span>
        </div>
        <ProxyPanel />
      </section>

      <section id="admin-storage" className="sw-glass kn-admin-panel">
        <div className="mb-4 flex items-center gap-2">
          <HardDrive className="size-4 text-accent-2" />
          <h2 className="text-lg font-semibold text-ink">Storage</h2>
        </div>
        <StoragePanel />
      </section>

      <div id="admin-dj"><AiDjSettings /></div>
      </>}
      </div>
    </main>
  );
}
