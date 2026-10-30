import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
function connectionUrl() {
  if (!process.env.DATABASE_URL) return undefined;
  const url = new URL(process.env.DATABASE_URL);
  // Allow a sleeping database time to wake; preserve explicit deployment tuning.
  if (!url.searchParams.has("connect_timeout"))
    url.searchParams.set("connect_timeout", "15");
  if (!url.searchParams.has("pool_timeout"))
    url.searchParams.set("pool_timeout", "20");
  return url.toString();
}
// Reuse one pool even when production server chunks load this module separately.
export const db =
  globalDb.prisma ??
  new PrismaClient({
    datasourceUrl: connectionUrl(),
    transactionOptions: { maxWait: 15000, timeout: 30000 },
  });
globalDb.prisma = db;
