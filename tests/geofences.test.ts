import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contains,
  crossing,
  distanceM,
  geofenceInput,
} from "../src/lib/geofences";
const accra = { lat: 5.6037, lng: -0.187 };
const circle = {
  shape: "CIRCLE",
  centerLat: accra.lat,
  centerLng: accra.lng,
  radiusM: 10000,
  points: null,
};
// Roughly Greater Accra's core, as staff might outline it.
const polygon = {
  shape: "POLYGON",
  centerLat: null,
  centerLng: null,
  radiusM: null,
  points: [
    [5.75, -0.35],
    [5.75, -0.05],
    [5.52, -0.05],
    [5.52, -0.35],
  ],
};
test("measures distance on the earth's surface", () => {
  const km = distanceM(5.6037, -0.187, 5.6037, -0.0966) / 1000; // ~10 km east
  assert.ok(km > 9.5 && km < 10.5, `${km}`);
});
test("knows whether a car is inside a circle or an outlined area", () => {
  assert.equal(contains(circle, 5.6, -0.19), true);
  assert.equal(contains(circle, 5.1, -1.25), false); // Cape Coast
  assert.equal(contains(polygon, 5.61, -0.2), true); // Accra centre
  assert.equal(contains(polygon, 6.69, -1.62), false); // Kumasi
});
test("alerts on breaches only, and not when a new area finds cars inside", () => {
  assert.deepEqual(crossing("ALLOWED", true, false), {
    type: "EXIT",
    breach: true,
  });
  assert.deepEqual(crossing("ALLOWED", false, true), {
    type: "ENTER",
    breach: false,
  });
  assert.equal(crossing("ALLOWED", undefined, true), null);
  assert.deepEqual(crossing("ALLOWED", undefined, false), {
    type: "EXIT",
    breach: true,
  });
  assert.deepEqual(crossing("RESTRICTED", false, true), {
    type: "ENTER",
    breach: true,
  });
  assert.equal(crossing("RESTRICTED", undefined, false), null);
  assert.equal(crossing("RESTRICTED", true, true), null);
});
test("needs a complete shape", () => {
  const base = { name: "Accra", kind: "ALLOWED" };
  assert.equal(
    geofenceInput.safeParse({ ...base, shape: "CIRCLE" }).success,
    false,
  );
  assert.equal(
    geofenceInput.safeParse({
      ...base,
      shape: "POLYGON",
      points: [[5.6, -0.2]],
    }).success,
    false,
  );
  assert.equal(
    geofenceInput.safeParse({
      ...base,
      shape: "CIRCLE",
      centerLat: 5.6,
      centerLng: -0.18,
      radiusM: 5000,
    }).success,
    true,
  );
});
test("region outlines contain their own towns and not their neighbours'", async () => {
  const { GHANA_REGIONS } = await import("../src/lib/ghana-regions");
  const { geofenceInput } = await import("../src/lib/geofences");
  assert.equal(GHANA_REGIONS.length, 16);
  const region = (name: string) => {
    const r = GHANA_REGIONS.find((x) => x.name === name)!;
    return { shape: "POLYGON", points: r.points } as Parameters<
      typeof contains
    >[0];
  };
  const accra = [5.6037, -0.187] as const;
  const tema = [5.6698, -0.0166] as const;
  const kumasi = [6.6885, -1.6244] as const;
  const tamale = [9.4034, -0.8424] as const;
  assert.ok(contains(region("Greater Accra"), ...accra));
  assert.ok(contains(region("Greater Accra"), ...tema));
  assert.ok(!contains(region("Greater Accra"), ...kumasi));
  assert.ok(contains(region("Ashanti"), ...kumasi));
  assert.ok(!contains(region("Ashanti"), ...accra));
  assert.ok(contains(region("Northern"), ...tamale));
  // Every outline is a valid geofence.
  for (const r of GHANA_REGIONS)
    assert.ok(
      geofenceInput.safeParse({
        name: r.name,
        kind: "ALLOWED",
        shape: "POLYGON",
        points: r.points,
      }).success,
      r.name,
    );
});
