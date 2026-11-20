// Reads ANLIMA's website statistics from Umami Cloud for the admin Analytics
// page. The API key stays on the server (UMAMI_API_KEY). Answers are cached for
// five minutes: Umami allows 50 calls per 15 seconds per key.
const BASE = () => process.env.UMAMI_API_URL || "https://api.umami.is/v1";
const WEBSITE = () => process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
export const umamiReady = () => !!(process.env.UMAMI_API_KEY && WEBSITE());
export class UmamiError extends Error {}
const TTL = 5 * 60000;
const cache = new Map<string, { at: number; data: unknown }>();

async function get(path: string, params: Record<string, string | number>) {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const url = `${BASE()}/websites/${encodeURIComponent(WEBSITE() ?? "")}${path}?${query}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.UMAMI_API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new UmamiError("Umami did not answer. Try again shortly.");
  }
  if (response.status === 401 || response.status === 403)
    throw new UmamiError("Umami refused the API key. Check UMAMI_API_KEY.");
  if (response.status === 429)
    throw new UmamiError("Umami is limiting requests. Try again in a minute.");
  if (!response.ok)
    throw new UmamiError(`Umami returned an error (${response.status}).`);
  const data = await response.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

// Umami has returned totals both as plain numbers and as { value }.
const count = (v: unknown) => {
  const n =
    typeof v === "object" && v !== null && "value" in v
      ? Number((v as { value: unknown }).value)
      : Number(v);
  return Number.isFinite(n) ? n : 0;
};
export type Totals = {
  visitors: number;
  visits: number;
  pageviews: number;
  bounces: number;
  totaltime: number;
};
const totals = (o: Record<string, unknown> | undefined): Totals => ({
  visitors: count(o?.visitors),
  visits: count(o?.visits),
  pageviews: count(o?.pageviews),
  bounces: count(o?.bounces),
  totaltime: count(o?.totaltime),
});
type Range = { from: Date; to: Date };
const span = (r: Range) => ({
  startAt: r.from.getTime(),
  endAt: r.to.getTime(),
});

// Totals for the period and, when Umami provides it, the period before.
export async function stats(r: Range) {
  const data = (await get("/stats", { ...span(r), compare: "prev" })) as Record<
    string,
    unknown
  >;
  const previous = data.comparison as Record<string, unknown> | undefined;
  return {
    current: totals(data),
    previous: previous ? totals(previous) : null,
  };
}

// Daily page views and visits, in Ghana time (GMT), with every day of the
// period present: Umami may leave out days without visits.
export async function daily(r: Range) {
  const data = (await get("/pageviews", {
    ...span(r),
    unit: "day",
    timezone: "Africa/Accra",
  })) as {
    pageviews?: { x: string; y: unknown }[];
    sessions?: { x: string; y: unknown }[];
  };
  const byDay = (points?: { x: string; y: unknown }[]) =>
    new Map((points ?? []).map((p) => [String(p.x).slice(0, 10), count(p.y)]));
  const views = byDay(data.pageviews);
  const visits = byDay(data.sessions);
  const out = [];
  const first = new Date(r.from.toISOString().slice(0, 10) + "T00:00:00Z");
  for (let d = first; d <= r.to; d = new Date(d.getTime() + 86400000)) {
    const key = d.toISOString().slice(0, 10);
    out.push({
      day: key,
      pageviews: views.get(key) ?? 0,
      visits: visits.get(key) ?? 0,
    });
  }
  return out;
}

// Ranked values: pages ("path"), sources ("referrer"), countries, devices or
// custom events ("event").
export async function ranked(r: Range, type: string, limit = 10) {
  const data = (await get("/metrics", { ...span(r), type, limit })) as {
    x: string | null;
    y: unknown;
  }[];
  return (Array.isArray(data) ? data : []).map((row) => ({
    name: row.x ?? "",
    value: count(row.y),
  }));
}
