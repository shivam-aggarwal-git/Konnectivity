import { Wordmark } from "@/components/Logo";
import { REPO_URL } from "@/lib/brand";
export default function SiteFooter() {
 return <footer className="relative border-t border-white/8 px-6 py-10"><div className="mx-auto max-w-6xl"><Wordmark /><p className="mt-3 text-xs text-muted">Self-hosted music and video rooms. Your server, your shared soundtrack.</p><nav className="mt-4 flex gap-5 text-xs text-muted" aria-label="Footer"><a href="/admin">Server settings</a>{REPO_URL && <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Source code</a>}</nav><p className="mt-6 text-xs text-muted">Konnectivity · Based on Syncwave. Distributed under PolyForm Noncommercial 1.0.0; see LICENSE and NOTICE.</p></div></footer>;
}
