"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ResendNotification({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="text-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const r = await fetch(`/api/admin/notifications/${id}`, {
            method: "POST",
          });
          if (!r.ok)
            setError(
              (await r.json().catch(() => ({}))).error || "Could not resend.",
            );
          setBusy(false);
          router.refresh();
        }}
      >
        Resend
      </button>
      {error && <small className="error">{error}</small>}
    </>
  );
}
