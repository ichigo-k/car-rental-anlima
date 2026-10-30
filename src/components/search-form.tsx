"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
        if (new Date(start) <= new Date()) {
          setError("Choose a future pickup date.");
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
          <input
            aria-label="Pick-up date and time"
            type="datetime-local"
            name="pickup"
            defaultValue={initial.pickup}
            required
          />
        </div>
      </label>
      <label>
        <img src="/images/figma/home-imgLayer1.svg" alt="" />
        <div>
          <span>Return Date</span>
          <input
            aria-label="Return date and time"
            type="datetime-local"
            name="returnAt"
            defaultValue={initial.returnAt}
            required
          />
        </div>
      </label>
      <label>
        <img src="/images/figma/home-imgLayer3.svg" alt="" />
        <div>
          <span>Car Type</span>
          <select name="category" defaultValue={initial.category || ""}>
            <option value="">Any Type</option>
            <option value="Sedan">Sedan</option>
            <option value="SUV">SUV</option>
            <option value="Luxury">Luxury</option>
            <option value="Hatchback">Hatchback</option>
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
