"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CancelBooking({
  reference,
  paid,
}: {
  reference: string;
  paid: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/bookings/${encodeURIComponent(reference)}/cancel`,
        { method: "POST" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not cancel this booking.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="cancel-booking">
      {!confirming ? (
        <button
          type="button"
          className="link-button"
          onClick={() => setConfirming(true)}
        >
          {paid ? "Request cancellation" : "Cancel reservation"}
        </button>
      ) : (
        <>
          <p>
            {paid
              ? "We will review your request under ANLIMA’s cancellation policy and contact you about any refund."
              : "This releases the car. You can book again any time."}
          </p>
          <button
            type="button"
            className="button small secondary"
            disabled={busy}
            onClick={cancel}
          >
            {paid ? "Send request" : "Yes, cancel"}
          </button>
          <button
            type="button"
            className="link-button"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            Keep booking
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
