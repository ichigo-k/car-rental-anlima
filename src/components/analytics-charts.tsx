// Charts for the admin Analytics page. One series each, in the validated
// chart blue; text stays in text colours. Bars: at most 24px, 4px rounded
// ends, 2px gaps, hairline grid. Every chart has a table view or is a table.
const BLUE = "#2a78d6";
const compact = (n: number) =>
  n >= 1000 ? `${Math.round(n / 100) / 10}K` : String(Math.round(n));
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

// Rounded tick step so the axis shows clean numbers.
function ticks(max: number) {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const out = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out.at(-1)! < max) out.push(out.at(-1)! + step);
  return out;
}

// Columns are HTML, not a scaled SVG, so labels stay readable on a phone.
export function DailyVisits({
  days,
}: {
  days: { day: string; visits: number; pageviews: number }[];
}) {
  const axis = ticks(Math.max(...days.map((d) => d.visits), 0));
  const max = axis.at(-1)!;
  const labels = [0, Math.floor((days.length - 1) / 2), days.length - 1];
  return (
    <figure className="analytics-chart">
      <div className="daily-plot" role="img" aria-label="Visits per day">
        {axis.map((t) => (
          <div
            key={t}
            className="daily-grid"
            style={{ bottom: `${(t / max) * 100}%` }}
          >
            <span>{compact(t)}</span>
          </div>
        ))}
        <div className="daily-bars" style={{ gap: days.length > 45 ? 1 : 2 }}>
          {days.map((d) => (
            <div
              key={d.day}
              className="daily-col"
              title={`${day(d.day)}: ${d.visits} visits, ${d.pageviews} page views`}
            >
              {d.visits > 0 && (
                <span
                  style={{
                    height: `${(d.visits / max) * 100}%`,
                    background: BLUE,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="daily-axis">
        {[...new Set(labels)].map((i) => (
          <span key={i}>{days[i] ? day(days[i].day) : ""}</span>
        ))}
      </div>
      <details>
        <summary>Show as a table</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Visits</th>
              <th>Page views</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td>{day(d.day)}</td>
                <td>{d.visits}</td>
                <td>{d.pageviews}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

// Booking funnel: each step's count, and the share that went on from the
// step before.
export function Funnel({
  steps,
}: {
  steps: { label: string; value: number }[];
}) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <ol className="analytics-funnel">
      {steps.map((s, i) => {
        const before = i ? steps[i - 1].value : null;
        return (
          <li key={s.label}>
            <span className="funnel-label">{s.label}</span>
            <span className="funnel-track">
              <span
                className="funnel-bar"
                style={{ width: `${(s.value / max) * 100}%`, background: BLUE }}
              />
            </span>
            <span className="funnel-value">
              {s.value.toLocaleString("en-GB")}
              {before !== null && (
                <small>
                  {before
                    ? `${Math.round((s.value / before) * 100)}% of previous`
                    : "—"}
                </small>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// A ranked list as a table, with a thin bar for scale.
export function Ranked({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { name: string; value: number }[];
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <section className="admin-panel analytics-ranked">
      <h2>{title}</h2>
      {rows.length ? (
        <table className="data-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>
                  <span>{r.name}</span>
                  <span className="ranked-track">
                    <span
                      style={{
                        width: `${(r.value / max) * 100}%`,
                        background: BLUE,
                      }}
                    />
                  </span>
                </td>
                <td className="num">{r.value.toLocaleString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}
