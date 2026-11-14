import Link from "next/link";
import SwitchRoom from "@/components/SwitchRoom";
import FeedbackToast from "@/components/FeedbackToast";
import CreateRoom from "@/components/CreateRoom";
import Logo from "@/components/Logo";
import { isSetupComplete } from "@/lib/auth.mjs";
import { personalSpace } from "@/lib/personal-space.mjs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Konnectivity · Groups" };

export default function GroupsPage() {
  return (
    <main className="studio-groups kn-groups kn-groups-app relative mx-auto min-h-dvh max-w-5xl px-5 pb-14 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-current/15 py-4">
        <Link href="/" className="flex items-center gap-2 font-display font-bold"><Logo /> Konnectivity</Link>
        <Link href="/admin" className="rounded-full border border-current/20 px-4 py-2 text-sm">SuperAdmin</Link>
      </header>
      <div className="kn-groups-heading my-8 sm:my-12">
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Your people. Your soundtrack.</h1>
        <p className="mt-3 text-muted">Create a private listening party, join your friends, or discover a new room.</p>
      </div>
      <FeedbackToast/>
      {isSetupComplete() ? <CreateRoom defaultInviteOnly={personalSpace.enabled ? (personalSpace.settings.inviteOnly ?? true) : true} />
        : <p>This server needs initial setup. <Link href="/setup" className="underline">Open server setup</Link></p>}
      {isSetupComplete() && <SwitchRoom inline/>}
    </main>
  );
}
