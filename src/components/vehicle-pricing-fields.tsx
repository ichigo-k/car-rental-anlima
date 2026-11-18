"use client";
import { VEHICLE_CATEGORIES } from "@/lib/vehicle-options";

// Category, driver service and mileage fields shared by the add and edit
// vehicle forms.
export function VehicleCategoryField({ value }: { value?: string }) {
  const options = VEHICLE_CATEGORIES.includes(
    (value ?? "") as (typeof VEHICLE_CATEGORIES)[number],
  )
    ? VEHICLE_CATEGORIES
    : [...VEHICLE_CATEGORIES, ...(value ? [value] : [])];
  return (
    <label>
      Category
      <select name="category" defaultValue={value ?? "Saloon"}>
        {options.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </label>
  );
}
export function VehiclePricingFields({
  car,
}: {
  car?: {
    driverOption: string;
    withDriverRate: number | null;
    dailyKmAllowance: number | null;
    excessKmFee: number | null;
  };
}) {
  return (
    <>
      <label>
        Driver service
        <select name="driverOption" defaultValue={car?.driverOption ?? "BOTH"}>
          <option value="SELF_DRIVE">Self-drive only</option>
          <option value="BOTH">Self-drive or with an ANLIMA driver</option>
          <option value="CHAUFFEUR_ONLY">With an ANLIMA driver only</option>
        </select>
      </label>
      <label>
        Daily rate with driver (GHS)
        <input
          name="withDriverRate"
          type="number"
          min="1"
          step=".01"
          defaultValue={car?.withDriverRate ? car.withDriverRate / 100 : ""}
          placeholder="Leave empty for self-drive only"
        />
      </label>
      <label>
        Daily mileage allowance (km)
        <input
          name="dailyKmAllowance"
          type="number"
          min="1"
          defaultValue={car?.dailyKmAllowance ?? ""}
          placeholder="Use Fees & settings"
        />
      </label>
      <label>
        Charge per extra km (GHS)
        <input
          name="excessKmFee"
          type="number"
          min="0"
          step=".01"
          defaultValue={car?.excessKmFee ? car.excessKmFee / 100 : ""}
          placeholder="Use Fees & settings"
        />
      </label>
    </>
  );
}
export function readPricingFields(f: FormData) {
  const amount = (name: string) => {
    const raw = String(f.get(name) ?? "").trim();
    return raw ? Math.round(Number(raw) * 100) : null;
  };
  const km = String(f.get("dailyKmAllowance") ?? "").trim();
  return {
    driverOption: f.get("driverOption"),
    withDriverRate: amount("withDriverRate"),
    dailyKmAllowance: km ? Number(km) : null,
    excessKmFee: amount("excessKmFee"),
  };
}
