import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/auth.mjs";
import { isAuthed } from "@/lib/guard";
import { listRoomSummaries } from "@/lib/rooms.mjs";
import AdminRooms from "@/components/AdminRooms";
import AdminConsole from "@/components/AdminConsole";

export const dynamic = "force-dynamic";

export const metadata = { title: "Konnectivity · SuperAdmin Console" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!isSetupComplete()) redirect("/setup");
  if (!(await isAuthed())) redirect("/admin/login");
  const { view: requestedView } = await searchParams;
  const view = requestedView === "branding" || requestedView === "server" ? requestedView : "rooms";
  const rooms = listRoomSummaries();
  const stats = {
    rooms: rooms.length,
    listeners: rooms.reduce((total, room) => total + room.listeners, 0),
    matching: rooms.filter(room => room.matching).length,
  };
  return <AdminConsole view={view} stats={stats}>{view === "rooms" && <AdminRooms rooms={rooms} />}</AdminConsole>;
}
