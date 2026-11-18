"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ReviewActions({
  id,
  status,
  featured,
  first,
  last,
}: {
  id: string;
  status: string;
  featured: boolean;
  first: boolean;
  last: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(action: string) {
    setBusy(true);
    setError("");
    const r = await fetch(`/api/admin/reviews/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!r.ok)
      return setError(
        (await r.json().catch(() => ({}))).error || "Could not update.",
      );
    router.refresh();
  }
  const button = (action: string, label: string, primary = false) => (
    <button
      key={action}
      type="button"
      className={primary ? "button small" : "text-link"}
      disabled={busy}
      onClick={() => void act(action)}
    >
      {label}
    </button>
  );
  return (
    <div className="review-actions">
      {status !== "APPROVED" && button("APPROVE", "Approve", true)}
      {status === "APPROVED" &&
        !featured &&
        button("FEATURE", "Show on website", true)}
      {featured && !first && button("MOVE_UP", "↑ Move up")}
      {featured && !last && button("MOVE_DOWN", "↓ Move down")}
      {featured && button("UNFEATURE", "Remove from website")}
      {status !== "HIDDEN" && button("HIDE", "Hide")}
      {error && <small className="error">{error}</small>}
    </div>
  );
}
