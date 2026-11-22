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
// Service and extras chosen with a rental (priced by priceRental).
export const rentalOptionsInput = z.object({
  withDriver: z.boolean().default(false),
  delivery: z.boolean().default(false),
  extraDriver: z.boolean().default(false),
});
export const reservationInput = z
  .object({
    vehicleId: z.string().min(1).max(128),
    pickup: z.iso.datetime(),
    returnAt: z.iso.datetime(),
    location: z.string().trim().min(3).max(120),
    customerName: z.string().trim().min(2, "Enter your full name.").max(120),
    customerEmail: z.email().max(254),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]{7,25}$/, "Enter a valid phone number."),
    ghanaCardNumber: ghanaCardInput,
    // Not needed when an ANLIMA driver drives.
    licenceNumber: z.string().trim().min(4).max(80).optional(),
    licenceExpiry: z.iso.date().optional(),
    deliveryAddress: z.string().trim().max(300).optional(),
    extraDriverName: z.string().trim().max(120).optional(),
    extraDriverLicence: z.string().trim().max(80).optional(),
    terms: z.literal(true),
    couponCode: z
      .string()
      .trim()
      .toUpperCase()
      .max(40)
      .regex(/^[A-Z0-9-]*$/)
      .optional(),
    expectedTotal: z.number().int().nonnegative().optional(),
  })
  .merge(rentalOptionsInput)
  .superRefine((v, ctx) => {
    if (!v.withDriver && (!v.licenceNumber || !v.licenceExpiry))
      ctx.addIssue({
        code: "custom",
        message: "Add your driving licence number and expiry date.",
      });
    if (v.delivery && (v.deliveryAddress ?? "").length < 5)
      ctx.addIssue({
        code: "custom",
        message: "Add the address where we should deliver and collect the car.",
      });
    if (
      v.extraDriver &&
      ((v.extraDriverName ?? "").length < 2 ||
        (v.extraDriverLicence ?? "").length < 4)
    )
      ctx.addIssue({
        code: "custom",
        message: "Add the additional driver's name and licence number.",
      });
  });
export function licenceValidThrough(expiry: string, returnAt: Date) {
  return new Date(`${expiry}T23:59:59.999Z`) >= returnAt;
}
