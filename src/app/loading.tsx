import { Header } from "@/components/header";

/** Home page skeleton — hero + 4 car cards + benefits hint */
export default function Loading() {
  return (
    <>
      {/* Hero */}
      <div className="sk-home-hero" aria-hidden="true">
        <div className="sk-home-hero-content">
          <div className="skeleton sk-home-eyebrow" />
          <div className="skeleton sk-home-h1" />
          <div className="skeleton sk-home-subtitle" />
          <div className="skeleton sk-home-btn" />
          <div className="skeleton sk-home-search" />
        </div>
      </div>

      <main
        className="loading-page"
        aria-busy="true"
        aria-label="Loading homepage"
      >
        <div className="loading-caption" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading your next drive…
        </div>

        {/* Section heading */}
        <div className="skeleton skeleton-title" style={{ width: "38%" }} />
        <div className="skeleton skeleton-subtitle" style={{ width: "26%" }} />

        {/* 4 car cards */}
        <div className="loading-card-grid" style={{ marginTop: 28 }}>
          {[1, 2, 3, 4].map((n) => (
            <div className="skeleton-panel" key={n}>
              <div className="skeleton skeleton-card-photo" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-action" />
            </div>
          ))}
        </div>

        <p className="loading-reassurance">
          You can keep browsing using the navigation above.
        </p>
      </main>
    </>
  );
}
