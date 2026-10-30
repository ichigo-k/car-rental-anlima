import { Header } from "@/components/header";

/** Policies skeleton — prose layout: header + long text blocks */
export default function Loading() {
    return (
        <>
            <Header />
            <main
                className="section prose loading-page"
                aria-busy="true"
                aria-label="Loading rental guide"
            >
                <div className="loading-caption" role="status">
                    <span className="loading-spinner" aria-hidden="true" />
                    Loading rental guide…
                </div>

                {/* Page heading */}
                <div className="skeleton sk-eyebrow" aria-hidden="true" />
                <div className="skeleton sk-prose-h1" aria-hidden="true" />
                <div className="skeleton sk-prose-h1-line2" aria-hidden="true" />
                <div className="skeleton sk-notice-block" aria-hidden="true" />

                {/* 6 prose sections */}
                {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className="sk-prose-section" aria-hidden="true">
                        <div className="skeleton sk-prose-h2" />
                        <div className="skeleton sk-prose-line" />
                        <div className="skeleton sk-prose-line" style={{ width: "90%" }} />
                        <div className="skeleton sk-prose-line" style={{ width: "75%" }} />
                    </div>
                ))}
            </main>
        </>
    );
}
