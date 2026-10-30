export interface GpsPosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  status: "SIMULATED";
  source: "mock";
}
export interface GpsProvider {
  positions(vehicleIds: string[]): Promise<GpsPosition[]>;
}
export const gpsProvider: GpsProvider = {
  async positions(ids) {
    return ids.map((vehicleId, i) => ({
      vehicleId,
      latitude: 5.6037 + i * 0.008,
      longitude: -0.187 + i * 0.012,
      recordedAt: new Date().toISOString(),
      status: "SIMULATED",
      source: "mock",
    }));
  },
};
