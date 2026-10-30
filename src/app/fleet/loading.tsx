import { Header } from "@/components/header";

/** Fleet catalogue skeleton — hero + search bar + car grid */
export default function Loading() {
    return (
        <>
            {/* Hero strip */}
            <div className="sk-fleet-hero" aria-hidden="true">
                <Header overlay />
                <div className="sk-fleet-hero-copy">
                    <div className="skeleton sk-fleet-h1" />
                    <div className="skeleton sk-fleet-subtitle" />
                    <div className="skeleton sk-fleet-btn" />
                </div>
            </div>

            <main
                className="loading-page"
                aria-busy="true"
                aria-label="Loading fleet"
            >
                <div className="loading-caption" role="status">
                    <span className="loading-spinner" aria-hidden="true" />
                    Loading your next drive…
                </div>

                {/* Section heading */}
                <div className="skeleton skeleton-title" style={{ width: "34%" }} />
                <div
                    className="skeleton skeleton-subtitle"
                    style={{ width: "22%", marginBottom: 28 }}
                />

                {/* Search bar */}
                <div className="skeleton skeleton-search" />

                {/* Category tabs */}
                <div className="sk-filter-tabs" aria-hidden="true">
                    {[80, 60, 70, 55, 65].map((w, i) => (
                        <div key={i} className="skeleton sk-tab" style={{ width: w }} />
                    ))}
                </div>

                {/* Car grid */}
                <div className="loading-card-grid">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                        <div className="skeleton-panel" key={n}>
                            <div className="skeleton skeleton-card-photo" />
                            <div className="skeleton skeleton-line" />
                            <div className="skeleton skeleton-line short" />
                            <div className="skeleton skeleton-line short" style={{ width: "35%" }} />
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
