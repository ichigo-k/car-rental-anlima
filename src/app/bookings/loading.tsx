import { Header } from "@/components/header";

/** Bookings / account page skeleton — sidebar shell + 3 summary tiles + booking rows */
export default function Loading() {
  return (
    <div className="customer-workspace" aria-busy="true" aria-label="Loading your account">
      {/* Sidebar */}
      <aside className="sk-sidebar" aria-hidden="true">
        <div className="skeleton sk-sidebar-logo" />
        <div className="skeleton sk-sidebar-label" />
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton sk-sidebar-link" />
        ))}
      </aside>

      {/* Main content */}
      <main className="loading-page sk-account-main">
        <div className="loading-caption" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading your account…
        </div>

        {/* Page heading */}
        <div className="skeleton sk-eyebrow" aria-hidden="true" />
        <div className="skeleton skeleton-title" aria-hidden="true" />
        <div className="skeleton skeleton-subtitle" aria-hidden="true" />

        {/* 3 summary tiles */}
        <div className="loading-account-summary" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton skeleton-summary" />
          ))}
        </div>

        {/* Section title + tabs */}
        <div className="skeleton skeleton-line" style={{ width: "22%", marginBottom: 14 }} aria-hidden="true" />
        <div className="sk-filter-tabs" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton sk-tab" style={{ width: 110 }} />
          ))}
        </div>

        {/* Booking rows */}
        {[1, 2, 3].map((n) => (
          <div key={n} className="sk-booking-row" aria-hidden="true">
            <div className="skeleton sk-booking-photo" />
            <div className="sk-booking-info">
              <div className="skeleton sk-booking-ref" />
              <div className="skeleton sk-booking-name" />
              <div className="skeleton skeleton-line short" />
              <div className="skeleton sk-booking-status" />
            </div>
            <div className="sk-booking-price">
              <div className="skeleton sk-price-line" />
              <div className="skeleton sk-booking-btn" />
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
