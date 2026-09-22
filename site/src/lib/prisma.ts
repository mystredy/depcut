import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaShutdownHooked?: boolean;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  // A single dashboard load fires a dozen-plus Prisma-backed requests at
  // once (session, account, credits, studios, generations, export-job
  // polling, ...) — with max 5, most of them just queue for a slot, which is
  // what turned into 2-8s "successful" responses and outright
  // connectionTimeoutMillis failures on plain single-row lookups, even
  // though pg_stat_activity shows the Supabase side sitting idle. Kept
  // comfortably under the pooler's own limit rather than raised further.
  // connectionTimeoutMillis fails fast instead of the ~22s hang seen when
  // the pooler itself is saturated (e.g. by leaked connections from a killed
  // dev process — see the shutdown hook below).
  const adapter = new PrismaPg({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// A killed process (a dev restart, a deploy rolling over) otherwise leaves
// this pool's connections open until the pooler's own idle timeout reclaims
// them — exactly what runs a free-tier pooler's slot count down under
// restart churn. Release them on a graceful shutdown instead. Guarded by
// the same global so Turbopack's hot reload never stacks a second listener
// on top of the last one.
if (!globalForPrisma.prismaShutdownHooked) {
  globalForPrisma.prismaShutdownHooked = true;
  const disconnect = () => void prisma.$disconnect();
  process.once("SIGTERM", disconnect);
  process.once("SIGINT", disconnect);
}
