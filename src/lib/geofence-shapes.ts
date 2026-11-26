import type * as Leaflet from "leaflet";

// A geofence as the maps draw it (browser side).
export type FenceShape = {
  id?: string;
  name: string;
  kind: string;
  shape: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number | null;
  points: [number, number][] | null;
  active?: boolean;
};
// Allowed areas in blue, restricted ones in red; paused ones faded.
export function drawFence(
  L: typeof Leaflet,
  layer: Leaflet.LayerGroup,
  fence: FenceShape,
  faded = false,
) {
  const colour = fence.kind === "RESTRICTED" ? "#c0392b" : "#1f6fd1";
  const style = {
    color: colour,
    weight: 2,
    dashArray: "6 6",
    fillColor: colour,
    fillOpacity: faded || fence.active === false ? 0.03 : 0.08,
    opacity: faded || fence.active === false ? 0.4 : 0.9,
  };
  const shape =
    fence.shape === "CIRCLE" &&
    fence.centerLat != null &&
    fence.centerLng != null &&
    fence.radiusM
      ? L.circle([fence.centerLat, fence.centerLng], {
          ...style,
          radius: fence.radiusM,
        })
      : fence.points && fence.points.length >= 3
        ? L.polygon(fence.points, style)
        : null;
  shape
    ?.bindTooltip(
      `${fence.name} · ${fence.kind === "RESTRICTED" ? "no-go area" : "allowed area"}`,
    )
    .addTo(layer);
  return shape;
}
