import { db } from "./db";
import {
  deviceLocations,
  deviceTrack,
  parseTracksolidTime,
  tracksolidConfig,
  type TracksolidLocation,
} from "./tracksolid";

// A position is the vehicle's last known location, not necessarily live.
export type GpsFreshness = "LIVE" | "STALE" | "OFFLINE" | "NO_FIX";
export interface GpsPosition {
  vehicleId: string;
  latitude: number | null;
  longitude: number | null;
  recordedAt: string | null;
  heartbeatAt: string | null;
  speedKmh: number | null;
  heading: number | null;
  ignitionOn: boolean | null;
  freshness: GpsFreshness;
}
export type GpsSnapshot = {
  source: "tracksolid" | "mock";
  positions: GpsPosition[];
  error?: string;
};
// A tracker that has not been heard from in this long is shown as stale.
export const STALE_AFTER_MINUTES = 15;

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
export function normalise(
  vehicleId: string,
  loc: TracksolidLocation | undefined,
  now = new Date(),
): GpsPosition {
  const lat = num(loc?.lat);
  const lng = num(loc?.lng);
  const fix = lat !== null && lng !== null && !(lat === 0 && lng === 0);
  const recorded = parseTracksolidTime(loc?.gpsTime);
  const heartbeat = parseTracksolidTime(loc?.hbTime);
  const heard = heartbeat ?? recorded;
  const direction = num(loc?.direction);
  const acc = num(loc?.accStatus);
  const freshness: GpsFreshness = !fix
    ? "NO_FIX"
    : String(loc?.status) !== "1"
      ? "OFFLINE"
      : !heard || now.getTime() - heard.getTime() > STALE_AFTER_MINUTES * 60000
        ? "STALE"
        : "LIVE";
  return {
    vehicleId,
    latitude: fix ? lat : null,
    longitude: fix ? lng : null,
    recordedAt: recorded?.toISOString() ?? null,
    heartbeatAt: heartbeat?.toISOString() ?? null,
    speedKmh: num(loc?.speed),
    heading: direction === null || direction < 0 ? null : direction,
    ignitionOn: acc === null ? null : acc === 1,
    freshness,
  };
}

// Short cache: the live map polls every 15 seconds, and every viewer shares
// one Tracksolid request per 10 seconds.
let cache: { key: string; at: number; snapshot: GpsSnapshot } | null = null;
export async function fleetPositions(
  vehicles: { id: string; gpsImei: string | null }[],
): Promise<GpsSnapshot> {
  const config = tracksolidConfig();
  if (!config)
    return {
      source: "mock",
      positions: vehicles.map((v, i) => ({
        vehicleId: v.id,
        latitude: 5.6037 + i * 0.008,
        longitude: -0.187 + i * 0.012,
        recordedAt: new Date().toISOString(),
        heartbeatAt: null,
        speedKmh: null,
        heading: null,
        ignitionOn: null,
        freshness: "LIVE",
      })),
    };
  const mapped = vehicles.filter((v) => v.gpsImei);
  const key = mapped.map((v) => `${v.id}:${v.gpsImei}`).join("|");
  if (cache && cache.key === key && Date.now() - cache.at < 10000)
    return cache.snapshot;
  try {
    const locations = mapped.length
      ? await deviceLocations(
          config,
          mapped.map((v) => v.gpsImei!),
        )
      : [];
    const byImei = new Map(locations.map((l) => [String(l.imei), l]));
    const snapshot: GpsSnapshot = {
      source: "tracksolid",
      positions: mapped.map((v) => normalise(v.id, byImei.get(v.gpsImei!))),
    };
    cache = { key, at: Date.now(), snapshot };
    return snapshot;
  } catch (error) {
    return {
      source: "tracksolid",
      positions: [],
      error:
        error instanceof Error
          ? `Tracksolid is unavailable: ${error.message}`
          : "Tracksolid is unavailable.",
    };
  }
}

export type RoutePoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh: number | null;
  heading: number | null;
};
// Longest route history one request may ask for.
export const MAX_ROUTE_HOURS = 72;
// Recorded route for one tracker, oldest first, without points lacking a fix.
export async function vehicleRoute(
  imei: string,
  from: Date,
  to: Date,
): Promise<RoutePoint[]> {
  const config = tracksolidConfig();
  if (!config) return [];
  const points: RoutePoint[] = [];
  for (const p of await deviceTrack(config, imei, from, to)) {
    const lat = num(p.lat);
    const lng = num(p.lng);
    const at = parseTracksolidTime(p.gpsTime);
    if (lat === null || lng === null || (lat === 0 && lng === 0) || !at)
      continue;
    const heading = num(p.direction);
    points.push({
      latitude: lat,
      longitude: lng,
      recordedAt: at.toISOString(),
      speedKmh: num(p.gpsSpeed),
      heading: heading === null || heading < 0 ? null : heading,
    });
  }
  return points.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}
// The live map polls often; record a view at most every 10 minutes per person.
export async function auditGpsView(
  actorId: string,
  entityId: string,
  detail: string,
) {
  const recent = await db.auditEvent.findFirst({
    where: {
      actorId,
      action: "GPS_VIEWED",
      entityId,
      createdAt: { gt: new Date(Date.now() - 10 * 60000) },
    },
    select: { id: true },
  });
  if (!recent)
    await db.auditEvent.create({
      data: { actorId, action: "GPS_VIEWED", entityId, detail },
    });
}
