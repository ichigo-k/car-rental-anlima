import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "../db";
import { money } from "../catalogue";
import { blockingWhere, NO_OPTIONS, overlaps, priceRental } from "../pricing";
import { getFees } from "../fees";

// Read-only tools over public information. None of them can see customers,
// bookings or payments.
export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_cars",
    description:
      "List ANLIMA cars currently offered for rent, with daily rate, deposit, seats, gearbox, fuel, pickup points and the car's page path. Optionally filter by category words (e.g. SUV, sedan, luxury), maximum daily rate in GHS, or minimum seats. Does not check dates; use check_availability for that.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Words to match in the car category, e.g. 'SUV'.",
        },
        max_daily_rate_ghs: {
          type: "number",
          description: "Highest acceptable daily rate in Ghana cedis.",
        },
        min_seats: { type: "integer", description: "Minimum seats needed." },
      },
    },
  },
  {
    name: "check_availability",
    description:
      "Check whether one car is free for a pickup and return time, and get the exact quote (rental days, rental amount, any longer-rental discount, refundable deposit, total). Times are Ghana time (GMT) in ISO format, e.g. 2026-12-01T10:00.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        car_slug: {
          type: "string",
          description: "The car's slug from search_cars, e.g. 'toyota-camry'.",
        },
        pickup: { type: "string", description: "Pickup date and time." },
        return: { type: "string", description: "Return date and time." },
        with_driver: {
          type: "boolean",
          description:
            "True to price the rental with an ANLIMA driver, where the car offers it.",
        },
      },
      required: ["car_slug", "pickup", "return"],
    },
  },
  {
    name: "get_rental_terms",
    description:
      "Get ANLIMA's current fees and cancellation terms as set by the rental team: late return grace period and charge, fuel, cleaning, smoking and mileage charges, and the free cancellation window.",
    eager_input_streaming: true,
    input_schema: { type: "object", properties: {} },
  },
];

const SearchInput = z.object({
  category: z.string().max(60).optional(),
  max_daily_rate_ghs: z.number().positive().max(1000000).optional(),
  min_seats: z.number().int().min(1).max(20).optional(),
});
const AvailabilityInput = z.object({
  car_slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
  pickup: z.string().max(40),
  return: z.string().max(40),
  with_driver: z.boolean().optional(),
});
// Ghana is on GMT all year, so a time without a zone is read as UTC.
const ghanaTime = (value: string) =>
  new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
const ghs = (pesewas: number) => money(pesewas);

async function searchCars(input: z.infer<typeof SearchInput>) {
  const cars = await db.vehicle.findMany({
    where: {
      status: "AVAILABLE",
      ...(input.category
        ? { category: { contains: input.category, mode: "insensitive" } }
        : {}),
      ...(input.max_daily_rate_ghs
        ? { dailyRate: { lte: Math.round(input.max_daily_rate_ghs * 100) } }
        : {}),
      ...(input.min_seats ? { seats: { gte: input.min_seats } } : {}),
    },
    orderBy: { dailyRate: "asc" },
    take: 20,
  });
  if (!cars.length) return { cars: [], note: "No cars match those filters." };
  return {
    cars: cars.map((c) => ({
      name: c.name,
      slug: c.slug,
      page: `/fleet/${c.slug}`,
      category: c.category,
      seats: c.seats,
      transmission: c.transmission,
      fuel: c.fuel,
      service:
        c.driverOption === "CHAUFFEUR_ONLY"
          ? "with an ANLIMA driver only"
          : c.driverOption === "BOTH"
            ? "self-drive or with an ANLIMA driver"
            : "self-drive",
      daily_rate: c.driverOption === "CHAUFFEUR_ONLY" ? null : ghs(c.dailyRate),
      daily_rate_with_driver: c.withDriverRate ? ghs(c.withDriverRate) : null,
      refundable_deposit: ghs(c.deposit),
      pickup_points: c.pickupPoints,
      description: c.description,
    })),
  };
}

async function checkAvailability(input: z.infer<typeof AvailabilityInput>) {
  const car = await db.vehicle.findUnique({ where: { slug: input.car_slug } });
  if (!car || car.status !== "AVAILABLE")
    return { available: false, reason: "That car is not currently offered." };
  const pickup = ghanaTime(input.pickup);
  const returnAt = ghanaTime(input.return);
  if (
    !Number.isFinite(pickup.getTime()) ||
    !Number.isFinite(returnAt.getTime())
  )
    return { available: false, reason: "The dates could not be read." };
  if (pickup <= new Date())
    return { available: false, reason: "Pickup must be in the future." };
  let price;
  try {
    price = priceRental(
      pickup,
      returnAt,
      car,
      {
        ...NO_OPTIONS,
        withDriver:
          car.driverOption === "CHAUFFEUR_ONLY" || !!input.with_driver,
      },
      await getFees(db),
    );
  } catch (e) {
    return { available: false, reason: (e as Error).message };
  }
  const [booked, blocked] = await Promise.all([
    db.booking.findFirst({
      where: {
        vehicleId: car.id,
        ...overlaps(pickup, returnAt),
        ...blockingWhere(new Date()),
      },
      select: { id: true },
    }),
    db.vehicleBlock.findFirst({
      where: {
        vehicleId: car.id,
        start: { lt: returnAt },
        end: { gt: pickup },
      },
      select: { id: true },
    }),
  ]);
  const available = !booked && !blocked;
  return {
    car: car.name,
    page: `/fleet/${car.slug}`,
    available,
    ...(available
      ? {
          rental_days: price.days,
          with_driver: price.withDriver,
          rental_amount: ghs(price.rentalAmount),
          longer_rental_discount: price.durationDiscount
            ? `${price.durationPercent}% (−${ghs(price.durationDiscount)})`
            : "none",
          refundable_deposit: ghs(price.deposit),
          total_before_offers: ghs(price.total),
          note: "Availability is confirmed only when the customer reserves and pays; offers may lower the price at checkout.",
        }
      : {
          reason: "The car is already booked or unavailable for those times.",
        }),
  };
}

async function rentalTerms() {
  const fees = await getFees(db);
  return {
    late_return: `${fees.lateGraceMinutes}-minute grace period, then ${fees.lateHourPercent}% of the daily rate per hour late, capped at the daily rate for each day`,
    longer_rental_discounts: `${fees.discount3Days}% off rentals of 3-6 days, ${fees.discount7Days}% for 7-13 days, ${fees.discount14Days}% for 14-29 days, ${fees.discount30Days}% for 30 days or more (applied automatically)`,
    delivery_and_collection: ghs(fees.deliveryFee),
    additional_driver: `${ghs(fees.extraDriverFee)} per rental`,
    driver_overtime: `${ghs(fees.driverOvertimeHourly)} per hour after the agreed daily service period`,
    fuel: "Not included; return the car with the same fuel level",
    travel_outside_accra:
      "Needs approval and a separate quote; contact the ANLIMA team",
    fuel_shortage: fees.fuelPerQuarter
      ? `${ghs(fees.fuelPerQuarter)} per quarter tank short`
      : "No set fuel charge; return with the same fuel level",
    cleaning_fee: fees.cleaningFee ? ghs(fees.cleaningFee) : "None set",
    smoking_fee: fees.smokingFee ? ghs(fees.smokingFee) : "None set",
    mileage: fees.dailyKmAllowance
      ? `${fees.dailyKmAllowance} km per day included, then ${ghs(fees.excessKmFee)} per km`
      : "Unlimited mileage",
    cancellation: `Free cancellation up to ${fees.freeCancellationHours} hours before pickup; after that ANLIMA keeps ${fees.lateCancellationPercent}% of the rental amount. The deposit is always refunded.`,
    deposit:
      "The security deposit is refundable; approved charges may be taken from it after return.",
  };
}

// Runs one tool call. Inputs are untrusted model output and are validated
// before use; any failure becomes an error result the model can explain.
export async function runAssistantTool(
  name: string,
  input: unknown,
): Promise<{ content: string; isError: boolean }> {
  try {
    let result: unknown;
    if (name === "search_cars") {
      const parsed = SearchInput.safeParse(input ?? {});
      if (!parsed.success) throw new Error("Invalid search filters.");
      result = await searchCars(parsed.data);
    } else if (name === "check_availability") {
      const parsed = AvailabilityInput.safeParse(input);
      if (!parsed.success) throw new Error("Invalid car or dates.");
      result = await checkAvailability(parsed.data);
    } else if (name === "get_rental_terms") {
      result = await rentalTerms();
    } else throw new Error(`Unknown tool ${name}`);
    return { content: JSON.stringify(result), isError: false };
  } catch (e) {
    return {
      content: e instanceof Error ? e.message : "The lookup failed.",
      isError: true,
    };
  }
}
