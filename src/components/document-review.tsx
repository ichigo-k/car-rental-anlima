"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Staff approve a customer document, or reject it with a reason the customer
// is emailed.
export function DocumentReview({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(body: object) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/documents/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not save the decision.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="document-review">
      <button
        type="button"
        className="button small"
        disabled={busy}
        onClick={() => decide({ status: "APPROVED" })}
      >
        Approve
      </button>
      <button
        type="button"
        className="button small secondary"
        disabled={busy}
        onClick={() => {
          const reason = window.prompt(
            "Why can't this document be accepted? The customer will see this.",
            "The photo is blurred; please upload a clearer copy.",
          );
          if (reason) void decide({ status: "REJECTED", reason });
        }}
      >
        Reject
      </button>
      {error && <small className="error">{error}</small>}
    </span>
  );
}
