/** Admin bookings skeleton — filters + booking cards list */
export default function Loading() {
    return (
        <div aria-busy="true" aria-label="Loading bookings">
            {/* Page heading */}
            <div className="admin-top" aria-hidden="true">
                <div>
                    <div className="skeleton sk-eyebrow" />
                    <div className="skeleton skeleton-title" style={{ width: "40%" }} />
                    <div className="skeleton skeleton-subtitle" style={{ width: "60%" }} />
                </div>
                <div className="skeleton sk-admin-btn" />
            </div>

            {/* Filters */}
            <div className="sk-admin-filters" aria-hidden="true">
                <div className="skeleton sk-filter-input" />
                <div className="skeleton sk-filter-select" />
                <div className="skeleton sk-filter-btn" />
            </div>

            {/* Result count */}
            <div className="skeleton skeleton-subtitle" style={{ width: "30%", marginBottom: 20 }} aria-hidden="true" />

            {/* Booking cards */}
            {[1, 2, 3, 4].map((n) => (
                <div key={n} className="sk-booking-card" aria-hidden="true">
                    <div className="sk-booking-card-head">
                        <div className="skeleton sk-booking-ref" />
                        <div className="skeleton sk-booking-name" style={{ width: "28%" }} />
                        <div className="skeleton sk-status-badge" />
                        <div className="skeleton sk-total" />
                    </div>
                    <div className="sk-booking-card-info">
                        {[1, 2, 3].map((m) => (
                            <div key={m} className="sk-info-col">
                                <div className="skeleton sk-info-label" />
                                <div className="skeleton sk-info-value" />
                                <div className="skeleton skeleton-line short" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
