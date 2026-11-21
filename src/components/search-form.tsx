"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "./analytics";
import { bookingWindowIssue, MIN_NOTICE_HOURS } from "@/lib/pricing";
// iPhone Safari shows an empty date field as blank, so show a hint until a
// date is chosen.
function DateField({
  name,
  label,
  initial,
}: {
  name: string;
  label: string;
  initial?: string;
}) {
  const [filled, setFilled] = useState(!!initial);
  // Times inside the booking notice cannot be picked. Set after hydration so the server and
  // browser render the same markup.
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const now = new Date();
    now.setMinutes(
      now.getMinutes() - now.getTimezoneOffset() + MIN_NOTICE_HOURS * 60,
    );
    if (ref.current) ref.current.min = now.toISOString().slice(0, 16);
  }, []);
  return (
    <div className={filled ? "date-field has-value" : "date-field"}>
      <input
        ref={ref}
        aria-label={label}
        type="datetime-local"
        name={name}
        defaultValue={initial}
        required
        onInput={(e) => setFilled(!!e.currentTarget.value)}
        onChange={(e) => setFilled(!!e.currentTarget.value)}
      />
      {/* Text comes from CSS so small phones can show a shorter hint. */}
      <span className="date-hint" aria-hidden="true" />
    </div>
  );
}
export function SearchForm({
  initial = {},
}: {
  initial?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="search-form design-search"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const start = String(f.get("pickup")),
          end = String(f.get("returnAt"));
        if (
          !Number.isFinite(new Date(start).getTime()) ||
          !Number.isFinite(new Date(end).getTime()) ||
          new Date(end) <= new Date(start)
        ) {
          setError("Return must be after pickup.");
          return;
        }
        const issue = bookingWindowIssue(new Date(start), new Date(end));
        if (issue) {
          setError(issue);
          return;
        }
        setError("");
        const params = new URLSearchParams({
          pickup: start,
          returnAt: end,
          location: String(f.get("location")),
        });
        const category = String(f.get("category"));
        if (category) params.set("category", category);
        trackEvent("search", {
          category: category || "any",
          location: String(f.get("location")),
        });
        startTransition(() =>
          router.push(`/fleet?${params.toString()}#browse`),
        );
      }}
    >
      <label>
        <img src="/images/figma/home-imgLayer2.svg" alt="" />
        <div>
          <span>Pick-up Location</span>
          <select
            name="location"
            defaultValue={initial.location || ""}
            required
          >
            <option value="" disabled>
              Select location
            </option>
            <option>Accra · Airport pickup</option>
            <option>Accra · City pickup</option>
          </select>
        </div>
      </label>
      <label>
        <img src="/images/figma/home-imgLayer1.svg" alt="" />
        <div>
          <span>Pick-up Date</span>
          <DateField
            name="pickup"
            label="Pick-up date and time"
            initial={initial.pickup}
          />
        </div>
      </label>
      <label>
        <img src="/images/figma/home-imgLayer1.svg" alt="" />
        <div>
          <span>Return Date</span>
          <DateField
            name="returnAt"
            label="Return date and time"
            initial={initial.returnAt}
          />
        </div>
      </label>
      <label>
        <img src="/images/figma/home-imgLayer3.svg" alt="" />
        <div>
          <span>Car Type</span>
          <select name="category" defaultValue={initial.category || ""}>
            <option value="">Any Type</option>
            <option value="Saloon">Saloon</option>
            <option value="SUV">SUV</option>
            <option value="Pickup">Pickup</option>
            <option value="Executive">Executive</option>
          </select>
        </div>
      </label>
      <button className="button" type="submit" disabled={pending}>
        <img src="/images/figma/home-imgGroup.svg" alt="" />
        {pending ? "Finding cars…" : "Search Cars"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
