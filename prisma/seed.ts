import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { fleet } from "../src/lib/catalogue";
const db = new PrismaClient();
async function main() {
  for (const vehicle of fleet)
    await db.vehicle.upsert({
      where: { slug: vehicle.slug },
      create: vehicle,
      update: {},
    });
  console.log(
    "Sample catalogue ready (4 illustrative vehicles). No bookings or staff accounts seeded.",
  );
}
main().finally(() => db.$disconnect());
