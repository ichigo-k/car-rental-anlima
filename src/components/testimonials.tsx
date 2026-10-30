"use client";
import { useRef } from "react";
const reviews = [
  [
    "Ama Mensah",
    "Leisure Traveller",
    "Booking a car for my trip was straightforward. I could compare my options and find a vehicle that suited my plans.",
  ],
  [
    "Daniel Owusu",
    "Business Traveller",
    "The booking process was easy to follow, and having the vehicle details available helped me make my decision.",
  ],
  [
    "Nana Asare",
    "Personal Travel",
    "I appreciated being able to explore different vehicle options before deciding which car would work best for my journey.",
  ],
];
export function Testimonials() {
  const track = useRef<HTMLDivElement>(null);
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
          Explore rental experiences and discover how clear vehicle details help
          customers find the right car for their journey.
        </p>
      </div>
      <div className="testimonial-track" ref={track}>
        {[...reviews, reviews[0]].map(([name, role, text], index) => (
          <figure key={`${name}-${index}`}>
            <img
              src="/images/figma/cars-imgFrame177.svg"
              alt="5 stars"
              width="80"
              height="12"
            />
            <blockquote>“{text}”</blockquote>
            <figcaption>
              <span>
                {name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
              <div>
                {name}
                <small>{role}</small>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
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
    </section>
  );
}
