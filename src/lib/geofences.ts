import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { GpsPosition } from "./gps";
import { opsAlert } from "./monitoring";

// Geofences drawn by staff on the tracking map (Guide FR-020). Positions are
// checked whenever fresh tracking data arrives: on the scheduled job and while
// staff have the live map open.
export const GEOFENCE_KINDS = ["ALLOWED", "RESTRICTED"] as const;
export const APPLIES_WHEN = ["ALWAYS", "ON_RENTAL"] as const;
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
export const geofenceInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    kind: z.enum(GEOFENCE_KINDS),
    shape: z.enum(["CIRCLE", "POLYGON"]),
    centerLat: lat.nullable().optional(),
    centerLng: lng.nullable().optional(),
    radiusM: z.number().int().min(100).max(500000).nullable().optional(),
    points: z
      .array(z.tuple([lat, lng]))
      .min(3)
      .max(200)
      .nullable()
      .optional(),
    vehicleIds: z.array(z.string().min(1).max(64)).max(200).default([]),
    appliesWhen: z.enum(APPLIES_WHEN).default("ALWAYS"),
    active: z.boolean().default(true),
  })
  .superRefine((g, ctx) => {
    if (
      g.shape === "CIRCLE" &&
      (g.centerLat == null || g.centerLng == null || !g.radiusM)
    )
      ctx.addIssue({
        code: "custom",
        message: "Click the map to place the circle and set its radius.",
      });
    if (g.shape === "POLYGON" && (!g.points || g.points.length < 3))
      ctx.addIssue({
        code: "custom",
        message: "Click at least three points on the map to draw the area.",
      });
  });
export type GeofenceInput = z.infer<typeof geofenceInput>;
// What is stored for each shape; the other shape's fields are cleared.
export function geofenceData(g: GeofenceInput) {
  return {
    name: g.name,
    kind: g.kind,
    shape: g.shape,
    centerLat: g.shape === "CIRCLE" ? g.centerLat! : null,
    centerLng: g.shape === "CIRCLE" ? g.centerLng! : null,
    radiusM: g.shape === "CIRCLE" ? g.radiusM! : null,
    points:
      g.shape === "POLYGON"
        ? (g.points as Prisma.InputJsonValue)
        : Prisma.DbNull,
    vehicleIds: g.vehicleIds,
    appliesWhen: g.appliesWhen,
    active: g.active,
  };
}

type Shape = {
  shape: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number | null;
  points: unknown;
};
export function distanceM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
// Ray casting; accurate enough for areas the size of a region.
function inPolygon(
  latitude: number,
  longitude: number,
  points: [number, number][],
) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [yi, xi] = points[i];
    const [yj, xj] = points[j];
    if (
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function contains(fence: Shape, latitude: number, longitude: number) {
  if (fence.shape === "CIRCLE")
    return (
      fence.centerLat != null &&
      fence.centerLng != null &&
      fence.radiusM != null &&
      distanceM(fence.centerLat, fence.centerLng, latitude, longitude) <=
        fence.radiusM
    );
  return (
    Array.isArray(fence.points) &&
    inPolygon(latitude, longitude, fence.points as [number, number][])
  );
}

// The event for a car's new position, if any. `before` is undefined the first
// time a car is seen against a fence: only a breach is recorded then.
export function crossing(
  kind: string,
  before: boolean | undefined,
  inside: boolean,
) {
  if (before === inside) return null;
  const type = inside ? "ENTER" : "EXIT";
  const breach = kind === "ALLOWED" ? !inside : inside;
  if (before === undefined && !breach) return null;
  return { type, breach };
}
export const isBreach = (kind: string, type: string) =>
  kind === "ALLOWED" ? type === "EXIT" : type === "ENTER";

export async function evaluateGeofences(
  db: PrismaClient,
  positions: GpsPosition[],
  now = new Date(),
) {
  const fences = await db.geofence.findMany({ where: { active: true } });
  const located = positions.filter(
    (p) => p.latitude !== null && p.longitude !== null,
  );
  if (!fences.length || !located.length) return 0;
  const [rentals, cars] = await Promise.all([
    db.booking.findMany({
      where: {
        status: "CHECKED_OUT",
        vehicleId: { in: located.map((p) => p.vehicleId) },
      },
      select: { id: true, reference: true, vehicleId: true },
    }),
    db.vehicle.findMany({
      where: { id: { in: located.map((p) => p.vehicleId) } },
      select: { id: true, name: true },
    }),
  ]);
  const rentalOf = new Map(rentals.map((r) => [r.vehicleId, r]));
  const nameOf = new Map(cars.map((c) => [c.id, c.name]));
  const states = await db.geofenceState.findMany({
    where: { geofenceId: { in: fences.map((f) => f.id) } },
  });
  const stateOf = new Map(
    states.map((s) => [`${s.geofenceId}:${s.vehicleId}`, s.inside]),
  );
  let created = 0;
  for (const fence of fences)
    for (const p of located) {
      const key = { geofenceId: fence.id, vehicleId: p.vehicleId };
      const rental = rentalOf.get(p.vehicleId);
      const applies =
        (!fence.vehicleIds.length || fence.vehicleIds.includes(p.vehicleId)) &&
        (fence.appliesWhen === "ALWAYS" || !!rental);
      const before = stateOf.get(`${fence.id}:${p.vehicleId}`);
      if (!applies) {
        // A car back from its rental starts fresh on the next one.
        if (before !== undefined)
          await db.geofenceState.deleteMany({ where: key });
        continue;
      }
      const inside = contains(fence, p.latitude!, p.longitude!);
      const event = crossing(fence.kind, before, inside);
      if (before === inside) continue;
      // Only the worker that changes the state records the event.
      if (before === undefined) {
        try {
          await db.geofenceState.create({ data: { ...key, inside } });
        } catch {
          continue;
        }
      } else {
        const changed = await db.geofenceState.updateMany({
          where: { ...key, inside: before },
          data: { inside },
        });
        if (!changed.count) continue;
      }
      if (!event) continue;
      const at = p.recordedAt ? new Date(p.recordedAt) : now;
      const saved = await db.geofenceEvent.create({
        data: {
          ...key,
          bookingId: rental?.id ?? null,
          type: event.type,
          latitude: p.latitude!,
          longitude: p.longitude!,
          at,
        },
      });
      created++;
      if (event.breach) {
        const car = nameOf.get(p.vehicleId) ?? "A car";
        const what =
          fence.kind === "ALLOWED"
            ? `left the allowed area "${fence.name}"`
            : `entered the restricted area "${fence.name}"`;
        await opsAlert(
          db,
          `geofence:${saved.id}`,
          `${car} ${what}`,
          `${car}${rental ? ` (booking ${rental.reference})` : ""} ${what} at ${at.toISOString()}.\nLast position: https://www.google.com/maps?q=${p.latitude},${p.longitude}\n\nAcknowledge it on the Fleet tracking page.`,
          now,
          3600000,
        );
      }
    }
  return created;
}
