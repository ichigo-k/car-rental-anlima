"use client";
import { useTransition } from "react";
export default function AdminError({ retry }: { retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <section className="admin-panel admin-error">
      <p className="eyebrow">WORKSPACE UNAVAILABLE</p>
      <h1>We couldn’t load this view.</h1>
      <p>
        Please try again. If you submitted a change, check the record before
        submitting it again.
      </p>
      <button
        className="button"
        disabled={pending}
        onClick={() => startTransition(() => retry())}
      >
        {pending ? "Trying again…" : "Try again"}
      </button>
    </section>
  );
}
