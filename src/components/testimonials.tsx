"use client";
import { useRef } from "react";
import type { PublicReview } from "@/lib/reviews";
// Approved customer reviews chosen by staff (Reviews in the dashboard).
// Nothing is shown until there is at least one.
export function Testimonials({ reviews }: { reviews: PublicReview[] }) {
  const track = useRef<HTMLDivElement>(null);
  if (!reviews.length) return null;
  function move(direction: number) {
    if (!track.current) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    track.current.scrollBy({
      left: direction * (track.current.clientWidth / 3 + 30),
      behavior: reduced ? "instant" : "smooth",
    });
  }
  return (
    <section className="design-testimonials">
      <div className="design-section-heading">
        <p className="eyebrow">CUSTOMER EXPERIENCES</p>
        <h2>What Our Customers Say</h2>
        <p>
          Discover what customers appreciate about their car rental experience,
          <br />
          from finding the right vehicle to getting ready for the road.
        </p>
      </div>
      <div className="testimonial-track" ref={track}>
        {reviews.map((r) => (
          <figure key={r.id}>
            <span
              className="testimonial-stars"
              role="img"
              aria-label={`${r.rating} out of 5 stars`}
            >
              {"★".repeat(r.rating)}
              <span aria-hidden="true">{"★".repeat(5 - r.rating)}</span>
            </span>
            <blockquote>“{r.text}”</blockquote>
            <figcaption>
              <span>
                {r.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div>
                {r.name}
                <small>Rented a {r.car}</small>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {reviews.length > 3 && (
        <div className="testimonial-controls">
          <button onClick={() => move(-1)} aria-label="Previous review">
            <img
              src="/images/figma/cars-imgFrame181.svg"
              alt=""
              width="38"
              height="38"
            />
          </button>
          <button onClick={() => move(1)} aria-label="Next review">
            <img
              src="/images/figma/cars-imgFrame180.svg"
              alt=""
              width="38"
              height="38"
            />
          </button>
        </div>
      )}
    </section>
  );
}
