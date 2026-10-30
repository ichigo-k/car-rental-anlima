/** Admin overview skeleton — 4 stat tiles + attention cards + recent bookings table */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading workspace overview">
      {/* Page heading */}
      <div className="admin-top" aria-hidden="true">
        <div>
          <div className="skeleton sk-eyebrow" />
          <div className="skeleton skeleton-title" style={{ width: "55%" }} />
          <div className="skeleton skeleton-subtitle" style={{ width: "70%" }} />
        </div>
        <div className="skeleton sk-admin-btn" />
      </div>

      {/* 4 stat tiles */}
      <div className="stats" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton skeleton-summary" />
        ))}
      </div>

      {/* Attention cards */}
      <div className="sk-attention-row" aria-hidden="true">
        <div className="skeleton sk-attention-card" />
        <div className="skeleton sk-attention-card" />
      </div>

      {/* Recent bookings panel */}
      <div className="sk-admin-panel" aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: "28%" }} />
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="skeleton sk-table-row" />
        ))}
      </div>
    </div>
  );
}
