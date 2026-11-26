import "dotenv/config";
import { PrismaClient } from "@prisma/client";
// Loads ANLIMA's fleet at the launch rates in "ANLIMA Accra Car Rental Market
// and Recommended Pricing" (15 Nov 2026). Safe to run again: cars are matched
// by their web address (slug), and nothing is deleted. Sample cars that ANLIMA
// does not offer are made inactive. Amounts are pesewas.
const db = new PrismaClient();
const PLACEHOLDER = "/images/vehicle-photo-coming-soon.svg";
const fleet = [
  {
    slug: "honda-civic",
    name: "Honda Civic",
    category: "Sport saloon",
    seats: 5,
    dailyRate: 90000,
    withDriverRate: 110000,
    deposit: 400000,
    description:
      "A sporty, comfortable saloon for city driving, business meetings and weekend trips around Accra.",
  },
  {
    slug: "toyota-rav4",
    name: "Toyota RAV4",
    category: "Compact SUV",
    seats: 5,
    dailyRate: 100000,
    withDriverRate: 120000,
    deposit: 500000,
    description:
      "A versatile compact SUV with room for luggage, suited to everyday driving and weekend getaways.",
  },
  {
    slug: "hyundai-santa-fe",
    name: "Hyundai Santa Fe",
    category: "Family SUV",
    seats: 5,
    dailyRate: 120000,
    withDriverRate: 140000,
    deposit: 600000,
    description:
      "A spacious family SUV for group trips, airport runs and longer journeys in comfort.",
  },
  {
    slug: "nissan-frontier",
    name: "Nissan Frontier",
    category: "Double-cab pickup",
    seats: 5,
    dailyRate: 120000,
    withDriverRate: 140000,
    deposit: 600000,
    description:
      "A tough double-cab pickup for site visits, equipment and rougher roads. Commercial or off-road use needs prior approval.",
  },
  {
    slug: "toyota-tundra",
    name: "Toyota Tundra",
    category: "Full-size pickup",
    seats: 5,
    dailyRate: 220000,
    withDriverRate: 250000,
    deposit: 1000000,
    description:
      "A premium full-size pickup with power and presence. Stricter verification and a higher deposit apply.",
  },
  {
    slug: "mercedes-benz-c-class",
    name: "Mercedes-Benz C-Class",
    category: "Executive saloon",
    seats: 5,
    dailyRate: 180000,
    withDriverRate: 220000,
    deposit: 1000000,
    description:
      "An executive saloon for business travel and special occasions. Stricter verification and a higher deposit apply.",
  },
];
const RETIRED = ["toyota-camry", "toyota-land-cruiser"];
async function main() {
  const actorId = "SYSTEM:fleet-import";
  for (const car of fleet) {
    const existing = await db.vehicle.findUnique({ where: { slug: car.slug } });
    const pricing = {
      name: car.name,
      category: car.category,
      seats: car.seats,
      dailyRate: car.dailyRate,
      deposit: car.deposit,
      driverOption: "BOTH",
      withDriverRate: car.withDriverRate,
      description: car.description,
      status: "AVAILABLE",
    };
    const saved = existing
      ? await db.vehicle.update({ where: { id: existing.id }, data: pricing })
      : await db.vehicle.create({
          data: { ...pricing, slug: car.slug, image: PLACEHOLDER },
        });
    await db.auditEvent.create({
      data: {
        actorId,
        action: existing ? "VEHICLE_UPDATED" : "VEHICLE_CREATED",
        entityId: saved.id,
        detail: `${car.name}: GH₵${car.dailyRate / 100}/day self-drive, GH₵${car.withDriverRate / 100} with driver, GH₵${car.deposit / 100} deposit (Nov 2026 pricing)`,
      },
    });
    console.log(`${existing ? "updated" : "added  "} ${car.name}`);
  }
  for (const slug of RETIRED) {
    const car = await db.vehicle.findUnique({ where: { slug } });
    if (!car || car.status === "INACTIVE") continue;
    await db.vehicle.update({
      where: { id: car.id },
      data: { status: "INACTIVE" },
    });
    await db.auditEvent.create({
      data: {
        actorId,
        action: "VEHICLE_UPDATED",
        entityId: car.id,
        detail: `${car.name} made inactive: not in ANLIMA's fleet`,
      },
    });
    console.log(`inactive ${car.name}`);
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
