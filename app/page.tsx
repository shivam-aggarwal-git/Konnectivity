import Link from "next/link";
import {
  Activity,
  Bot,
  Github,
  Heart,
  ListMusic,
  Lock,
  MessageSquare,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {personalSpace} from "@/lib/personal-space.mjs";
import CreateRoom from "@/components/CreateRoom";
import SiteFooter from "@/components/SiteFooter";
import Logo from "@/components/Logo";
import { isSetupComplete } from "@/lib/auth.mjs";
import { REPO_URL } from "@/lib/brand";
const DOCUMENTATION_VERSION = "10.03-working";

export const dynamic = "force-dynamic";

/**
 * The public face of an instance.
 *
 * It has two jobs and they pull in opposite directions: explain what this is to
 * someone who arrived from a link and has never heard of it, and get someone
 * who already knows into a room in one click. So the room controls sit above
 * the fold and everything explanatory is below them — nobody who came here to
 * start a room has to read a word.
 *
 * Every surface, radius, glow and duration here comes from the design system.
 * There is no page-specific CSS.
 */

const FEATURES = [
 {icon:Radio,title:"Music, perfectly together",body:"Search YouTube, upload your own songs, build a shared queue and keep playback in sync."},
 {icon:Activity,title:"Your shared screen",body:"Watch YouTube and uploaded videos together, with shared playback controls."},
 {icon:Users,title:"A call inside your room",body:"Voice, video and screen sharing for approved room members. Call media is encrypted using WebRTC."},
 {icon:MessageSquare,title:"More than a message",body:"Chat, share a location or video, and send floating messages with hearts and custom animations."},
 {icon:ListMusic,title:"Make plans. Decide together.",body:"Plan a celebration, suggest a venue, set a budget in rupees and vote in room polls."},
 {icon:Sparkles,title:"A space you both shape",body:"Explore eleven themes, personal backgrounds, ambient lights and visualizers. Save your appearance for everyone."},
];

const STEPS = [
  { n: "01", title: "Start a room", body: "One click. No account, no sign-up, nothing to install for anyone joining." },
  { n: "02", title: "Share the link", body: "Or the six-character code. Guests open it and they’re in — phone, laptop, anything with a browser." },
  { n: "03", title: "Press play once", body: "Listen, watch and connect. Everyone can shape the room; the host manages admission." },
];

export default function Home() {
  const claimed = isSetupComplete();

  return (
    <>
      <SiteHeader />

      <main className="relative">
        {/* ------------------------------------------------------------ hero */}
        <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-16 pb-20 text-center sm:pt-24">
          {/* An unclaimed server is claimable by whoever reaches it first, so say
              so rather than letting it look finished. */}
          {!claimed && (
            <Link
              href="/setup"
              className="mb-8 flex max-w-lg items-center gap-2.5 rounded-md border border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-soft px-4 py-3 text-left text-sm transition-colors duration-200 ease-[var(--ease)] hover:bg-[color-mix(in_oklab,var(--accent)_22%,transparent)]"
            >
              <Lock className="size-4 shrink-0 text-accent-2" />
              <span>
                <span className="font-semibold text-ink">This server isn&rsquo;t set up yet.</span>{" "}
                <span className="text-muted">
                  Set an admin password to secure it — and to get a shareable link.
                </span>
              </span>
            </Link>
          )}

          <div className="sw-rise mb-7 flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur">
            <span className="sw-eq" aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </span>
            <span className="text-xs font-semibold tracking-[0.28em] text-ink/80">
              YOUR PRIVATE SHARED SPACE
            </span>
          </div>

          <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
            One Beat.
            <br />
            <span className="sw-gradient-text">Two Hearts.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base text-ink/60 sm:text-lg">
            Listen, watch, talk and plan together. One private room for your favourite people, with shared music, videos, encrypted calls and a little atmosphere.
          </p>

          <div className="mt-9 w-full max-w-md">
            <CreateRoom defaultInviteOnly={personalSpace.enabled ? (personalSpace.settings.inviteOnly ?? true) : true} />
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
            <li>No accounts</li>
            <li aria-hidden>·</li>
            <li>No Premium requirement</li>
            <li aria-hidden>·</li>
            <li>Invite-only rooms</li>
          </ul>
        </section>

        <section className="kn-home-moments" aria-label="Together in one room"><div><Heart/><strong>One room. Your people.</strong><p>A playlist for the evening. A film with friends. A plan everyone agrees on.</p></div><div className="kn-home-orbit"><Logo size="lg" className="kn-home-brand-logo"/><span>♫</span><span>♡</span><span>✦</span></div><div><ShieldCheck/><strong>Private from the first invite</strong><p>You approve who joins. When the host leaves, the room and its invitation end.</p></div></section>
        {/* -------------------------------------------------------- features */}
        <section className="border-t border-white/6 px-6 py-24" aria-labelledby="features">
          <div className="mx-auto max-w-6xl">
            <h2 id="features" className="sw-label scroll-mt-24">
              <Sparkles className="size-3.5" aria-hidden />
              What you get
            </h2>
            <p className="mt-4 max-w-2xl font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Everything you need to spend{" "}
              <span className="sw-gradient-text">time together.</span>
            </p>

            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="sw-card sw-card-hover p-6">
                  <span className="mb-5 grid size-10 place-items-center rounded-sm bg-accent-soft text-accent-2">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <h3 className="font-display text-base font-bold">{title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ----------------------------------------------------------- steps */}
        <section className="border-t border-white/6 px-6 py-24" aria-labelledby="how">
          <div className="mx-auto max-w-6xl">
            <h2 id="how" className="sw-label scroll-mt-24">
              <Activity className="size-3.5" aria-hidden />
              How it goes
            </h2>
            <p className="mt-4 max-w-2xl font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Three steps, and none of them is &ldquo;make an account&rdquo;.
            </p>

            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ n, title, body }) => (
                <li key={n} className="sw-card p-6">
                  <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent-2">
                    {n}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* -------------------------------------------------------- open src */}
        <section className="border-t border-white/6 px-6 py-24" aria-labelledby="open-source">
          <div className="sw-panel mx-auto flex max-w-6xl flex-col gap-8 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 id="open-source" className="sw-label scroll-mt-24">
                <Heart className="size-3.5" aria-hidden />
                Source available
              </h2>
              <p className="mt-4 font-display text-3xl leading-tight font-bold tracking-tight">
                Run your own, in about a minute.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Double-click a launcher, or one Docker command. It fetches its own Node if
                the machine hasn&rsquo;t got one, prints a public HTTPS link you can send to
                anyone, and stores everything in two folders you can back up or delete. Free
                to self-host for personal use.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href={REPO_URL || "#open-source"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[image:var(--accent-gradient)] px-[22px] py-[11px] text-[11px] font-bold tracking-[0.2em] text-white uppercase transition-[transform,box-shadow] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--glow-accent)] active:translate-y-0 active:scale-[0.97]"
                >
                  <Github className="size-3.5" aria-hidden />
                  {REPO_URL ? "View source" : "Self-host Konnectivity"}
                </a>
                <a
                  href={REPO_URL ? `${REPO_URL}/blob/main/DEPLOY.md` : "/admin"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-ink px-[22px] py-[11px] text-[11px] font-bold tracking-[0.2em] text-ink uppercase transition-[background-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:bg-white/8 active:translate-y-0 active:scale-[0.97]"
                >
                  {REPO_URL ? "Self-host guide" : "Server settings"}
                </a>
              </div>
            </div>

            <div className="w-full max-w-sm shrink-0">
              <div className="sw-card p-5">
                <p className="sw-label mb-3">Docker</p>
                <pre className="overflow-x-auto rounded-sm bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-ink-soft">
                  <code>{"cp .env.example .env\ndocker compose up -d --build"}</code>
                </pre>
                <p className="mt-3 text-[11px] leading-relaxed text-muted">
                  Data lives in <code className="font-mono text-ink-soft">./data</code> and{" "}
                  <code className="font-mono text-ink-soft">./cache</code>. Nothing else on
                  the machine is touched.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * The product bar.
 *
 * Three groups, in the order they matter: who this is, where to read about it,
 * and the two things nothing else on the page offers — the source and this
 * server's own settings. The section links are plain anchors, so the header
 * costs no JavaScript and still works before hydration.
 *
 * The version is read from package.json rather than typed here, because a
 * number maintained by hand is a number that ends up wrong.
 */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <Link
          href="/"
          aria-label="Konnectivity home"
          className="group flex items-center gap-2.5 rounded-sm"
        >
          <Logo size="sm" className="transition-shadow duration-200 ease-[var(--ease)] group-hover:shadow-[var(--glow-accent)]" />
          <span className="flex items-baseline gap-2">
            <span className="font-display text-sm font-extrabold tracking-[0.24em]">
              Konnectivity
            </span>
            <span className="rounded-full border border-white/10 px-1.5 py-px font-mono text-[10px] text-muted max-sm:hidden">
              v{DOCUMENTATION_VERSION}
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1" aria-label="Primary">
          <span className="mr-2 hidden items-center gap-1 md:flex">
            {[
              ["#features", "Features"],
              ["#how", "How it works"],
              ["#open-source", "Self-host"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-2 text-xs text-muted transition-colors duration-200 ease-[var(--ease)] hover:bg-white/8 hover:text-ink"
              >
                {label}
              </a>
            ))}
          </span>

          <Link
            href="/admin"
            className="rounded-full px-3 py-2 text-xs text-muted transition-colors duration-200 ease-[var(--ease)] hover:bg-white/8 hover:text-ink max-sm:hidden"
          >
            Server settings
          </Link>
          <a
            href={REPO_URL || "#open-source"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs text-ink transition-[background-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:bg-white/8"
          >
            <Github className="size-3.5" aria-hidden />
            <span className="max-sm:sr-only">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
