import { z } from "zod";

// Car types ANLIMA offers (from the Accra pricing review). Older types stay
// listed so existing records remain editable.
export const VEHICLE_CATEGORIES = [
  "Economy",
  "Saloon",
  "Sport saloon",
  "Executive saloon",
  "Compact SUV",
  "Family SUV",
  "Premium SUV",
  "Double-cab pickup",
  "Full-size pickup",
  "Passenger van",
  "Luxury sedan",
  "Sedan",
] as const;
export const DRIVER_OPTIONS = ["SELF_DRIVE", "BOTH", "CHAUFFEUR_ONLY"] as const;

const amount = z.number().int().min(100).max(100000000);
// Driver service and mileage settings for one car. Omitted fields default to
// self-drive only with the Fees & settings mileage rules.
const pricingFields = {
  driverOption: z.enum(DRIVER_OPTIONS),
  withDriverRate: amount.nullable(),
  dailyKmAllowance: z.number().int().min(1).max(10000).nullable(),
  excessKmFee: z.number().int().min(0).max(100000000).nullable(),
};
export const vehiclePricingInput = z.object({
  driverOption: pricingFields.driverOption.default("SELF_DRIVE"),
  withDriverRate: pricingFields.withDriverRate.default(null),
  dailyKmAllowance: pricingFields.dailyKmAllowance.default(null),
  excessKmFee: pricingFields.excessKmFee.default(null),
});
export const vehiclePricingPatch = z.object(pricingFields).partial();
export function driverRateIssue(v: {
  driverOption?: string;
  withDriverRate?: number | null;
}) {
  return v.driverOption && v.driverOption !== "SELF_DRIVE" && !v.withDriverRate
    ? "Add the daily rate with driver, or choose self-drive only."
    : null;
}
// HTTPS photo links, or images published with the website (/images/…).
export const vehicleImageInput = z
  .string()
  .max(2000)
  .refine(
    (value) =>
      /^\/images\/[\w./-]+$/.test(value) ||
      (URL.canParse(value) && new URL(value).protocol === "https:"),
    "Use an HTTPS image link.",
  );
