import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  gatherState,
  healthChecks,
  problemsFrom,
  systemReports,
} from "@/lib/monitoring";
export const dynamic = "force-dynamic";
const at = (iso: string | Date | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Africa/Accra",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never";
const CHECK_LABEL = {
  database: "Database",
  storage: "Photo storage",
  scheduler: "Scheduled job (reminders, retries, alerts)",
  backups: "Backups (last 26 hours)",
};
export default async function System() {
  const current = await requireStaff();
  if (!can(current.user.role, "audit.read"))
    return <p>Your staff role does not include system health.</p>;
  const now = new Date();
  const [health, reports, state, errors] = await Promise.all([
    healthChecks(db, now),
    systemReports(db),
    gatherState(db, now),
    db.errorEvent.findMany({ orderBy: { lastSeen: "desc" }, take: 25 }),
  ]);
  const problems = problemsFrom(state, now);
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h1>System health</h1>
          <p>
            Alerts go to{" "}
            {process.env.OPERATIONS_EMAIL ||
              "no one yet (set OPERATIONS_EMAIL)"}
            . Uptime monitors can check {process.env.BETTER_AUTH_URL}
            /api/health.
          </p>
        </div>
        <span className={`status health-${health.status}`}>
          {health.status === "ok"
            ? "ALL WORKING"
            : health.status === "degraded"
              ? "NEEDS A LOOK"
              : "DOWN"}
        </span>
      </div>
      <section className="report-summary" aria-label="Checks">
        {(Object.keys(health.checks) as (keyof typeof CHECK_LABEL)[]).map(
          (k) => (
            <div className={`admin-panel check-${health.checks[k]}`} key={k}>
              <span>{CHECK_LABEL[k]}</span>
              <strong>
                {health.checks[k] === "ok"
                  ? "Working"
                  : health.checks[k] === "warn"
                    ? "Check"
                    : "Failing"}
              </strong>
            </div>
          ),
        )}
      </section>
      <section className="admin-panel">
        <h2>Needs attention</h2>
        {problems.length ? (
          <ul className="problem-list">
            {problems.map((p) => (
              <li key={p.key}>
                <strong>{p.title}</strong>
                <span>{p.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing needs attention.</p>
        )}
      </section>
      <section className="admin-panel">
        <h2>Scheduled job and backups</h2>
        <dl className="system-facts">
          <dt>Scheduled job last ran</dt>
          <dd>{at(reports.lastScheduledRun)}</dd>
          <dt>Last backup</dt>
          <dd>
            {reports.backup
              ? `${at(reports.backup.at)} · ${reports.backup.ok ? "OK" : "FAILED"} · ${reports.backup.detail}`
              : "No backup reported yet. See docs/backups.md."}
          </dd>
          <dt>Last restore test</dt>
          <dd>
            {reports.restoreTest
              ? `${at(reports.restoreTest.at)} · ${reports.restoreTest.ok ? "PASSED" : "FAILED"} · ${reports.restoreTest.detail}`
              : "No restore test reported yet."}
          </dd>
        </dl>
      </section>
      <section className="admin-panel">
        <h2>Recent server errors</h2>
        {errors.length ? (
          <div className="report-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Last seen</th>
                  <th>Times</th>
                  <th>Where</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.id}>
                    <td>{at(e.lastSeen)}</td>
                    <td>{e.count}</td>
                    <td>
                      {e.method} {e.path}
                    </td>
                    <td>
                      {e.message.split("\n")[0].slice(0, 200)}
                      {e.digest && <small> · digest {e.digest}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No server errors recorded.</p>
        )}
      </section>
    </>
  );
}
