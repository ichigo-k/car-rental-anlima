import { createHmac } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { isPrivatePath, withoutQuery } from "./analytics";

// First-party website analytics (Guide §10): no cookies, no IP addresses and
// no personal data are stored. A visitor is a code made from the day, the IP
// address and the browser with a server secret; it changes every day, so
// nobody can be identified or followed from one day to the next.
export const EVENT_TYPES = [
  "pageview",
  "search",
  "car-viewed",
  "checkout-started",
  "booking-confirmed",
] as const;
const DATA_KEYS = ["car", "category", "location", "provider", "days"];
const KEEP_MONTHS = 13;
const BOT =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|monitor|uptime/i;

export function visitorCode(
  secret: string,
  day: string,
  ip: string,
  ua: string,
) {
  return createHmac("sha256", secret)
    .update(`${day}|${ip}|${ua}`)
    .digest("hex")
    .slice(0, 20);
}
export function deviceOf(ua: string) {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua))
    return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua))
    return "mobile";
  return "desktop";
}

// What may be stored from a browser report, or null to drop it.
export function cleanEvent(
  input: unknown,
  siteHost: string,
): {
  type: string;
  path: string;
  referrerHost: string | null;
  data: Record<string, string | number> | null;
} | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;
  const type = raw.type;
  if (
    typeof type !== "string" ||
    !(EVENT_TYPES as readonly string[]).includes(type)
  )
    return null;
  const path = withoutQuery(raw.path).slice(0, 200);
  if (!path.startsWith("/") || (type === "pageview" && isPrivatePath(path)))
    return null;
  let referrerHost: string | null = null;
  try {
    const host = new URL(String(raw.referrer ?? "")).hostname.replace(
      /^www\./,
      "",
    );
    if (host && host !== siteHost.replace(/^www\./, ""))
      referrerHost = host.slice(0, 100);
  } catch {
    // No or invalid referrer: a direct visit.
  }
  let data: Record<string, string | number> | null = null;
  if (typeof raw.data === "object" && raw.data !== null)
    for (const [k, v] of Object.entries(raw.data as Record<string, unknown>))
      if (
        DATA_KEYS.includes(k) &&
        (typeof v === "string" || typeof v === "number")
      ) {
        data ??= {};
        data[k] = typeof v === "string" ? v.slice(0, 60) : v;
      }
  return { type, path, referrerHost, data };
}

export async function recordEvent(
  db: PrismaClient,
  req: { ip: string; userAgent: string; doNotTrack: boolean },
  event: NonNullable<ReturnType<typeof cleanEvent>>,
  now = new Date(),
) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || req.doNotTrack || !req.userAgent || BOT.test(req.userAgent))
    return false;
  const visitor = visitorCode(
    secret,
    now.toISOString().slice(0, 10),
    req.ip,
    req.userAgent,
  );
  // A runaway page or script cannot flood the table.
  const recent = await db.siteEvent.count({
    where: { visitor, at: { gt: new Date(now.getTime() - 3600000) } },
  });
  if (recent >= 300) return false;
  await db.siteEvent.create({
    data: {
      at: now,
      type: event.type,
      path: event.path,
      referrerHost: event.referrerHost,
      device: deviceOf(req.userAgent),
      visitor,
      data: event.data ?? Prisma.DbNull,
    },
  });
  return true;
}

export async function removeOldSiteEvents(db: PrismaClient, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - KEEP_MONTHS);
  return (await db.siteEvent.deleteMany({ where: { at: { lt: cutoff } } }))
    .count;
}

// Figures for the admin page. A visit is one visitor on one day.
type Range = { from: Date; to: Date };
export type Totals = {
  visits: number;
  pageviews: number;
  bounces: number;
  totaltime: number;
};
async function totalsFor(db: PrismaClient, r: Range): Promise<Totals> {
  const [row] = await db.$queryRaw<
    {
      visits: bigint;
      pageviews: bigint | null;
      bounces: bigint;
      totaltime: number | null;
    }[]
  >`
    WITH v AS (
      SELECT visitor, date_trunc('day', "at") AS d,
             count(*) FILTER (WHERE type = 'pageview') AS pv,
             EXTRACT(EPOCH FROM max("at") - min("at")) AS dur
      FROM "SiteEvent" WHERE "at" >= ${r.from} AND "at" < ${r.to}
      GROUP BY 1, 2
    )
    SELECT count(*) AS visits, sum(pv) AS pageviews,
           count(*) FILTER (WHERE pv <= 1) AS bounces, sum(dur)::float AS totaltime
    FROM v`;
  return {
    visits: Number(row?.visits ?? 0),
    pageviews: Number(row?.pageviews ?? 0),
    bounces: Number(row?.bounces ?? 0),
    totaltime: Number(row?.totaltime ?? 0),
  };
}
export async function stats(db: PrismaClient, r: Range) {
  const length = r.to.getTime() - r.from.getTime();
  const [current, previous] = await Promise.all([
    totalsFor(db, r),
    totalsFor(db, { from: new Date(r.from.getTime() - length), to: r.from }),
  ]);
  return { current, previous };
}
export async function daily(db: PrismaClient, r: Range) {
  const rows = await db.$queryRaw<
    { d: Date; visits: bigint; pageviews: bigint }[]
  >`
    SELECT date_trunc('day', "at") AS d, count(DISTINCT visitor) AS visits,
           count(*) FILTER (WHERE type = 'pageview') AS pageviews
    FROM "SiteEvent" WHERE "at" >= ${r.from} AND "at" < ${r.to}
    GROUP BY 1`;
  const byDay = new Map(rows.map((x) => [x.d.toISOString().slice(0, 10), x]));
  const out = [];
  const first = new Date(r.from.toISOString().slice(0, 10) + "T00:00:00Z");
  for (let d = first; d <= r.to; d = new Date(d.getTime() + 86400000)) {
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    out.push({
      day: key,
      visits: Number(row?.visits ?? 0),
      pageviews: Number(row?.pageviews ?? 0),
    });
  }
  return out;
}
// Ranked values: "path", "referrerHost", "device" or "type" (events).
export async function ranked(
  db: PrismaClient,
  r: Range,
  by: "path" | "referrerHost" | "device" | "type",
  limit = 10,
) {
  const rows = await db.siteEvent.groupBy({
    by: [by],
    where: {
      at: { gte: r.from, lt: r.to },
      ...(by === "type" ? { type: { not: "pageview" } } : { type: "pageview" }),
    },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  return rows.map((row) => ({
    name: String((row as Record<string, unknown>)[by] ?? ""),
    value: row._count._all,
  }));
}
