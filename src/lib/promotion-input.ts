import { z } from "zod";
export const promotionInput = z
  .object({
    name: z.string().trim().min(3).max(100),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,40}$/)
      .nullable()
      .default(null),
    discountType: z.enum(["PERCENT", "FIXED"]),
    value: z.number().int().positive().max(100000000),
    vehicleIds: z
      .array(z.string().min(1).max(128))
      .max(100)
      .refine((v) => new Set(v).size === v.length),
    minimumRental: z.number().int().min(0).max(100000000),
    maxUses: z.number().int().min(1).max(1000000).nullable(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    active: z.boolean(),
  })
  .refine(
    (p) => p.discountType !== "PERCENT" || p.value <= 90,
    "Percentage discounts must be between 1% and 90%.",
  )
  .refine(
    (p) => new Date(p.endsAt) > new Date(p.startsAt),
    "End date must be after start date.",
  );
