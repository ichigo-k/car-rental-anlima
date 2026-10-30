import { Header } from "./header";
export function LoadingSkeleton({
  variant = "fleet",
}: {
  variant?: "fleet" | "detail" | "account";
}) {
  return (
    <>
      <Header />
      <main
        className={`loading-page loading-page--${variant}`}
        aria-busy="true"
        aria-label="Loading page"
      >
        <div className="loading-caption" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading{" "}
          {variant === "detail"
            ? "your car"
            : variant === "account"
              ? "your account"
              : "your next drive"}
          …
        </div>
        <div className="loading-placeholder-content" aria-hidden="true">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-subtitle" />
          {variant === "detail" ? (
            <div className="loading-detail-grid">
              <div>
                <div className="skeleton skeleton-car" />
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-line" />
              </div>
              <div className="skeleton-panel">
                <div className="skeleton skeleton-subtitle" />
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton skeleton-field" />
                ))}
                <div className="skeleton skeleton-action" />
              </div>
            </div>
          ) : variant === "account" ? (
            <>
              <div className="loading-account-summary">
                {[1, 2, 3].map((n) => (
                  <div className="skeleton skeleton-summary" key={n} />
                ))}
              </div>
              <div className="skeleton-panel loading-account-list">
                {[1, 2, 3].map((n) => (
                  <div className="skeleton skeleton-account-row" key={n} />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="skeleton skeleton-search" />
              <div className="loading-card-grid">
                {[1, 2, 3, 4].map((n) => (
                  <div className="skeleton-panel" key={n}>
                    <div className="skeleton skeleton-card-photo" />
                    <div className="skeleton skeleton-line" />
                    <div className="skeleton skeleton-line short" />
                    <div className="skeleton skeleton-action" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <p className="loading-reassurance">
          You can keep browsing using the navigation above.
        </p>
      </main>
    </>
  );
}
