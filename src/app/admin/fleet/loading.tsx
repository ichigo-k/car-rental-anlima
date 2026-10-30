/** Admin fleet skeleton — status tabs + filters + car cards */
export default function Loading() {
    return (
        <div aria-busy="true" aria-label="Loading fleet management">
            {/* Page heading */}
            <div className="admin-top" aria-hidden="true">
                <div>
                    <div className="skeleton sk-eyebrow" />
                    <div className="skeleton skeleton-title" style={{ width: "50%" }} />
                    <div className="skeleton skeleton-subtitle" style={{ width: "65%" }} />
                </div>
                <div className="skeleton sk-admin-btn" />
            </div>

            {/* Status count tabs */}
            <div className="sk-fleet-counts" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                    <div key={n} className="skeleton sk-fleet-count-tab" />
                ))}
            </div>

            {/* Filters */}
            <div className="sk-admin-filters" aria-hidden="true">
                <div className="skeleton sk-filter-input" />
                <div className="skeleton sk-filter-select" />
                <div className="skeleton sk-filter-btn" />
            </div>

            {/* Car cards */}
            {[1, 2, 3].map((n) => (
                <div key={n} className="sk-admin-car-card" aria-hidden="true">
                    <div className="sk-admin-car-summary">
                        <div className="skeleton sk-car-thumb" />
                        <div className="sk-car-meta">
                            <div className="skeleton sk-status-badge" />
                            <div className="skeleton skeleton-line" style={{ width: "55%" }} />
                            <div className="skeleton skeleton-line short" />
                        </div>
                        <div className="sk-car-price-col">
                            <div className="skeleton sk-price-line" />
                            <div className="skeleton skeleton-line short" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
