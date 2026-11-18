"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ReviewForm({
  reference,
  defaultName,
}: {
  reference: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open)
    return (
      <button
        type="button"
        className="button small secondary"
        onClick={() => setOpen(true)}
      >
        Rate your rental
      </button>
    );
  return (
    <form
      className="stack review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) return setError("Choose a star rating.");
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        const r = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference,
            rating,
            body: f.get("body"),
            displayName: f.get("displayName"),
          }),
        });
        setBusy(false);
        if (!r.ok)
          return setError(
            (await r.json().catch(() => ({}))).error ||
              "Could not send your review.",
          );
        router.refresh();
      }}
    >
      <fieldset className="star-input">
        <legend>Your rating</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-pressed={rating === n}
            className={n <= rating ? "on" : ""}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </fieldset>
      <label>
        Your review
        <textarea
          name="body"
          minLength={20}
          maxLength={1000}
          required
          placeholder="How was the car, pickup and service?"
        />
      </label>
      <label>
        Name shown with your review
        <input
          name="displayName"
          defaultValue={defaultName}
          minLength={2}
          maxLength={40}
          required
        />
      </label>
      <p className="field-hint">
        Reviews are checked by ANLIMA before they appear on the website.
      </p>
      <button className="button small" disabled={busy}>
        Send review
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
