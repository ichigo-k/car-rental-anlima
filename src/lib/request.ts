import { z } from "zod";
import { DEFAULT_PICKUP_POINTS, pickupPointsInput } from "./reservation";
export function trustedOrigin(req: Request) {
  return (
    req.headers.get("origin") === new URL(process.env.BETTER_AUTH_URL!).origin
  );
}
export const vehicleInput = z.object({
  name: z.string().min(3).max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  category: z.enum(["Premium SUV", "Compact SUV", "Luxury sedan", "Sedan"]),
  seats: z.number().int().min(2).max(15),
  dailyRate: z.number().int().min(100).max(100000000),
  deposit: z.number().int().min(0).max(100000000),
  image: z
    .url()
    .refine(
      (url) => new URL(url).protocol === "https:",
      "Use an HTTPS image URL",
    ),
  description: z.string().min(10).max(2000),
  pickupPoints: pickupPointsInput.default(DEFAULT_PICKUP_POINTS),
});
