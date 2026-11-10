"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";

export default function AdminRoomSettings() {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => setAuthorized(session?.authed === true))
      .catch(() => {});
  }, []);

  if (!authorized) return null;

  return (
    <section className="kn-permission-manager kn-admin-launch">
      <h3><Settings2 size={19} /> Platform administration</h3>
      <Link href="/admin" target="_blank" rel="noopener">Open SuperAdmin Console ↗</Link>
    </section>
  );
}
