/** Favourites skeleton — account sidebar + page heading + car cards grid */
export default function Loading() {
  return (
    <div className="customer-workspace" aria-busy="true" aria-label="Loading favourites">
      {/* Sidebar */}
      <aside className="sk-sidebar" aria-hidden="true">
        <div className="skeleton sk-sidebar-logo" />
        <div className="skeleton sk-sidebar-label" />
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton sk-sidebar-link" />
        ))}
      </aside>

      {/* Main */}
      <main className="loading-page sk-account-main">
        <div className="loading-caption" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading your favourites…
        </div>

        {/* Page heading */}
        <div className="skeleton sk-eyebrow" aria-hidden="true" />
        <div className="skeleton skeleton-title" style={{ width: "42%" }} aria-hidden="true" />
        <div className="skeleton skeleton-subtitle" aria-hidden="true" />

        {/* Car cards */}
        <div className="loading-card-grid" style={{ marginTop: 32 }} aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <div className="skeleton-panel" key={n}>
              <div className="skeleton skeleton-card-photo" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-action" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
