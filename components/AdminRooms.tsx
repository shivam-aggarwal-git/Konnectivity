"use client";

import Link from "next/link";
import { CheckCheck, ChevronDown, DoorOpen, Plus, Search, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export type AdminRoomSummary = {
  code: string;
  name: string;
  listeners: number;
  inviteOnly: boolean;
  hasRoomAdmin: boolean;
  roomScoped: boolean;
  claimPending: boolean;
  discoverable: boolean;
  matching: boolean;
};

export default function AdminRooms({ rooms }: { rooms: AdminRoomSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [approval, setApproval] = useState(true);
  const [assignLater, setAssignLater] = useState(false);
  const [owned, setOwned] = useState<string[]>([]);
  useEffect(() => {
    setOwned(rooms.filter(room => localStorage.getItem(`sw_owner_${room.code}`)).map(room => room.code));
  }, [rooms]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState<{ all: boolean; rooms: AdminRoomSummary[] }>();
  const selectedRooms = rooms.filter(room => selected.includes(room.code));
  const phrase = bulk?.all ? "DELETE ALL" : "DELETE SELECTED";
  const [bulkConfirm, setBulkConfirm] = useState("");
  const filtered = rooms.filter(room => `${room.name} ${room.code}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pageSize = 8;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  async function deleteBulk() {
    if (!bulk || bulkConfirm !== phrase || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/room-admin/rooms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: bulkConfirm, codes: bulk.rooms.map(room => room.code) }),
      });
      const result = await response.json();
      setBulk(undefined);
      setSelected([]);
      setBulkConfirm("");
      setManage(undefined);
      setConfirm(undefined);
      setLink(undefined);
      setStatus(response.ok ? `Deleted ${result.deleted} rooms.` : result.error);
      router.refresh();
    } catch {
      setStatus("Could not confirm deletion. Refresh the room list before trying again.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  const [confirm, setConfirm] = useState<string>();
  const [manage, setManage] = useState<string>();
  const [link, setLink] = useState<{ code: string; url: string }>();

  async function roomAction(code: string, action: "room" | "delegate", method: "POST" | "DELETE") {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/room-admin/${code}/${action}`, { method });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setLink(result.link ? { code, url: result.link } : undefined);
      setConfirm(undefined);
      setStatus(action === "room" ? "Room deleted." : result.link ? "Room admin link generated." : "Unused setup invitation canceled.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Room action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), inviteOnly: approval, assignLater }),
      });
      const room = await response.json();
      if (!response.ok) throw new Error(room.error || "Could not create the room.");
      if (room.ownerToken) {
        localStorage.setItem(`sw_owner_${room.code}`, room.ownerToken);
        setOwned(previous => [...previous, room.code]);
      }
      setName("");
      setQuery("");
      setPage(0);
      setStatus(`Created ${room.name}.`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create the room.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="admin-rooms" className="sw-glass kn-admin-panel">
      <div className="kn-admin-section-heading">
        <div className="kn-admin-section-icon"><DoorOpen size={21} /></div>
        <div>
          <h2>Listening rooms <span className="kn-admin-count">{rooms.length}</span></h2>
          <p>Create private groups, assign their admins, and manage the room list.</p>
        </div>
      </div>
      <form onSubmit={create} className="kn-admin-create">
        <label className="kn-admin-field">Room name
          <Input value={name} maxLength={80} placeholder="Optional room name" onChange={event => setName(event.target.value)} />
        </label>
        <label className="kn-admin-checkbox">
          <input type="checkbox" checked={approval} onChange={event => setApproval(event.target.checked)} />
          Require approval for new listeners
        </label>
        <Button className="kn-admin-primary" disabled={busy}><Plus size={17} />{busy ? "Working…" : "Create room"}</Button>
          <label className="kn-admin-checkbox kn-admin-handoff">
          <input type="checkbox" checked={assignLater} onChange={event => setAssignLater(event.target.checked)} />
          Create for someone else and assign their admin later
        </label>
      </form>
      <div className="kn-admin-list-toolbar">
        <label className="kn-admin-search">
          <Search size={17} aria-hidden="true" />
          <Input type="search" aria-label="Find a room" placeholder="Search room name or code" value={query}
            onChange={event => { setQuery(event.target.value); setPage(0); }} />
        </label>
        <div className="kn-admin-actions">
          {filtered.length > 0 && <Button type="button" variant="outline" disabled={busy || Boolean(bulk)} aria-pressed={filtered.every(room => selected.includes(room.code))} onClick={() => {
            const allSelected = filtered.every(room => selected.includes(room.code));
            setSelected(previous => allSelected ? previous.filter(code => !filtered.some(room => room.code === code)) : [...new Set([...previous, ...filtered.map(room => room.code)])]);
          }}><CheckCheck size={16}/>{filtered.every(room => selected.includes(room.code)) ? "Clear selection" : query.trim() ? "Select all results" : "Select all"}</Button>}
          {selectedRooms.length > 0 && <>

            <Button variant="outline" className="kn-admin-danger-outline" disabled={busy} onClick={() => {
              setBulk({ all: false, rooms: selectedRooms });
              setBulkConfirm("");
            }}><Trash2 size={16} /> Delete selected ({selectedRooms.length})</Button>
          </>}
          {rooms.length > 0 && <Button variant="outline" className="kn-admin-danger-outline" disabled={busy} onClick={() => {
          setBulk({ all: true, rooms });
          setBulkConfirm("");
        }}><Trash2 size={16} /> Delete all rooms</Button>}
        </div>
      </div>
      {bulk && (
        <form className="kn-admin-delete" onSubmit={event => { event.preventDefault(); void deleteBulk(); }}>
          <h3>Delete {bulk.all ? "all" : "the selected"} {bulk.rooms.length} {bulk.rooms.length === 1 ? "room" : "rooms"}?</h3>
          <p>{bulk.all
            ? "This includes personal rooms and private groups, even if a search hides them."
            : "Only the rooms listed below will be deleted."} Active sessions end, invitations stop working, and room YouTube cookies are removed.</p>
          {!bulk.all && <ul className="kn-admin-delete-list">
            {bulk.rooms.map(room => <li key={room.code}>{room.name} ({room.code})</li>)}
          </ul>}
          <label className="kn-admin-field">Type {phrase} to confirm
            <Input autoComplete="off" value={bulkConfirm} onChange={event => setBulkConfirm(event.target.value)} />
          </label>
          <div className="kn-admin-actions">
            <Button type="submit" variant="danger" disabled={busy || bulkConfirm !== phrase}>{bulk.all ? "Permanently delete all rooms" : "Permanently delete selected rooms"}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setBulk(undefined); setBulkConfirm(""); }}>Cancel</Button>
          </div>
        </form>
      )}
      {status && <p role="status" className="kn-admin-status">{status}</p>}
      {!visible.length && <p className="kn-admin-empty">{rooms.length ? "No rooms match your search." : "No rooms yet. Create a room to get started."}</p>}
      <ul className="kn-admin-room-list">
        {visible.map(room => (
          <li key={room.code} className="kn-admin-room">
            <div className="kn-admin-room-row">
              <input type="checkbox" className="kn-admin-room-select" aria-label={`Select ${room.name} (${room.code}) for deletion`}
                checked={selected.includes(room.code)} disabled={busy || Boolean(bulk)} onChange={event => {
                  const checked = event.target.checked;
                  setSelected(previous => checked ? [...previous, room.code] : previous.filter(code => code !== room.code));
                }} />
              <div className="kn-admin-room-details">
                <h3>{room.name}</h3>
                <div className="kn-admin-room-meta">
                  <code>{room.code}</code>
                  <span><Users size={14} /> {room.listeners} listening</span>
                  <span>{room.inviteOnly ? "Approval required" : "Invitation required"}</span>
                  {room.discoverable && <span>{room.matching ? "Random matching available" : "Random matching enabled · unavailable"}</span>}
                </div>
              </div>
              <div className="kn-admin-actions">
                {(!room.roomScoped || owned.includes(room.code)) && <Button asChild variant="outline"><Link href={`/r/${room.code}?host=1`}>Open room</Link></Button>}
                <Button type="button" variant="secondary" aria-expanded={manage === room.code}
                  onClick={() => { setManage(manage === room.code ? undefined : room.code); setConfirm(undefined); }}>
                  Manage <ChevronDown size={16} />
                </Button>
              </div>
            </div>
            {manage === room.code && (
              <div className="kn-admin-room-manage space-y-3">
                <p className="text-sm text-muted">{room.roomScoped
                  ? room.hasRoomAdmin ? "Group admin assigned" : "Waiting for a group admin"
                  : "Existing personal room"}</p>
                <div className="flex flex-wrap gap-2">
                  {room.roomScoped && !room.hasRoomAdmin && <Button disabled={busy} variant="outline" onClick={() => void roomAction(room.code, "delegate", "POST")}>
                    {room.claimPending ? "Replace unused setup link" : "Create admin setup link"}
                  </Button>}
                  {room.claimPending && <Button disabled={busy} variant="outline" onClick={() => void roomAction(room.code, "delegate", "DELETE")}>Cancel setup link</Button>}
                  <Button disabled={busy} variant="danger" onClick={() => setConfirm(room.code)}>Delete room</Button>
                </div>
                {link?.code === room.code && (
                  <label className="block text-sm">Single-use admin setup link
                    <Input readOnly value={link.url} onFocus={event => event.target.select()} />
                    <span className="text-muted">Share only with the person managing this room.</span>
                  </label>
                )}
                {confirm === room.code && (
                  <div className="kn-admin-delete space-y-2">
                    <p>Delete “{room.name}”? This ends the room, invalidates its invitation, and removes its room cookie. Stored media becomes inaccessible through the room.</p>
                    <div className="kn-admin-actions">
                      <Button disabled={busy} variant="danger" onClick={() => void roomAction(room.code, "room", "DELETE")}>Permanently delete room</Button>
                      <Button disabled={busy} variant="outline" onClick={() => setConfirm(undefined)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {filtered.length > 0 && <div className="kn-admin-pagination">
        <p>{currentPage * pageSize + 1}–{currentPage * pageSize + visible.length} of {filtered.length} rooms</p>
        {filtered.length > pageSize && <div className="kn-admin-actions">
          <Button variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button>
          <Button variant="outline" disabled={(currentPage + 1) * pageSize >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</Button>
        </div>}
      </div>}
    </section>
  );
}
