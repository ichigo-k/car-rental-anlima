/** Admin payments skeleton — title + export btn + data table */
export default function Loading() {
    return (
        <div aria-busy="true" aria-label="Loading payments">
            {/* Heading row */}
            <div className="admin-top" aria-hidden="true">
                <div className="skeleton skeleton-title" style={{ width: "45%" }} />
                <div className="skeleton sk-admin-btn" />
            </div>
            <div className="skeleton skeleton-subtitle" style={{ width: "60%", marginBottom: 28 }} aria-hidden="true" />

            <div className="sk-admin-panel" aria-hidden="true">
                {/* Table header */}
                <div className="sk-table-header">
                    {[22, 20, 15, 15, 28].map((w, i) => (
                        <div key={i} className="skeleton sk-th" style={{ width: `${w}%` }} />
                    ))}
                </div>
                {/* Rows */}
                {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <div key={n} className="skeleton sk-table-row" />
                ))}
            </div>
        </div>
    );
}
