import { Header } from "@/components/header";

/** Car detail skeleton — mirrors the two-column detail-grid layout */
export default function Loading() {
  return (
    <>
      <Header active="Cars" />
      <main
        className="section reservation-page loading-page"
        aria-busy="true"
        aria-label="Loading car details"
      >
        <div className="loading-caption" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading your car…
        </div>

        {/* Breadcrumb + flow steps */}
        <div className="skeleton sk-breadcrumb" aria-hidden="true" />
        <div className="sk-flow-steps" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton sk-flow-step" />
          ))}
        </div>

        {/* Two-column grid */}
        <div className="loading-detail-grid" aria-hidden="true">
          {/* Left: car summary */}
          <div>
            <div className="skeleton skeleton-car" />
            <div className="skeleton sk-eyebrow" />
            <div className="skeleton skeleton-title" />
            <div className="skeleton sk-price" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
            <div className="sk-specs-row">
              {[1, 2, 3].map((n) => (
                <div key={n} className="skeleton sk-spec-chip" />
              ))}
            </div>
            <div className="skeleton skeleton-line" style={{ marginTop: 24, width: "55%" }} />
            <div className="skeleton skeleton-line short" />
          </div>

          {/* Right: booking panel */}
          <div className="skeleton-panel sk-booking-panel">
            <div className="skeleton skeleton-subtitle" style={{ width: "50%" }} />
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton skeleton-field" />
            ))}
            <div className="skeleton sk-total-row" />
            <div className="skeleton skeleton-action" />
            <div className="skeleton sk-reassurance-line" />
          </div>
        </div>
      </main>
    </>
  );
}
