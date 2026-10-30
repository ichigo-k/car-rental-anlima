/** Admin customers skeleton — title + data table rows */
export default function Loading() {
    return (
        <div aria-busy="true" aria-label="Loading customers">
            <div className="skeleton skeleton-title" style={{ width: "35%" }} aria-hidden="true" />
            <div className="skeleton skeleton-subtitle" style={{ width: "55%", marginBottom: 28 }} aria-hidden="true" />

            <div className="sk-admin-panel" aria-hidden="true">
                {/* Table header */}
                <div className="sk-table-header">
                    {[30, 38, 18, 14].map((w, i) => (
                        <div key={i} className="skeleton sk-th" style={{ width: `${w}%` }} />
                    ))}
                </div>
                {/* Rows */}
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <div key={n} className="skeleton sk-table-row" />
                ))}
            </div>
        </div>
    );
}
