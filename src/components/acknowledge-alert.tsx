"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
// Marks a geofence alert as seen by staff.
export function AcknowledgeAlert({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="button small secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/admin/geofences/events/${id}`, { method: "POST" });
        router.refresh();
      }}
    >
      Acknowledge
    </button>
  );
}
