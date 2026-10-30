import { z } from "zod";

export const RESERVATION_HOLD_MINUTES = 15;
export const DEFAULT_PICKUP_POINTS = [
  "Accra · Airport pickup",
  "Accra · City pickup",
];
export const pickupPointsInput = z
  .array(z.string().trim().min(3).max(120))
  .min(1, "Add at least one pickup point.")
  .max(20)
  .refine(
    (points) => new Set(points).size === points.length,
    "Remove duplicate pickup points.",
  );
export const ghanaCardInput = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^GHA-\d{9}-\d$/, "Enter your Ghana Card number as GHA-123456789-0.");
export const reservationInput = z.object({
  vehicleId: z.string().min(1).max(128),
  pickup: z.iso.datetime(),
  returnAt: z.iso.datetime(),
  location: z.string().trim().min(3).max(120),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{7,25}$/, "Enter a valid phone number."),
  ghanaCardNumber: ghanaCardInput,
  licenceNumber: z.string().trim().min(4).max(80),
  licenceExpiry: z.iso.date(),
  terms: z.literal(true),
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(40)
    .regex(/^[A-Z0-9-]*$/)
    .optional(),
  expectedTotal: z.number().int().nonnegative().optional(),
});
export function licenceValidThrough(expiry: string, returnAt: Date) {
  return new Date(`${expiry}T23:59:59.999Z`) >= returnAt;
}
