import "server-only";

import path from "node:path";

import { env } from "@/lib/env";
import type { Database } from "./types";

declare global {
  // Cached across hot reloads in development so we don't open a new pool per edit.
  var __db: Promise<Database> | undefined;
}

async function connect(): Promise<Database> {
  if (env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const schema = await import("./schema");
    const client = postgres(env.DATABASE_URL, { max: 5, prepare: false });
    return drizzle(client, { schema });
  }

  // No DATABASE_URL: run an embedded Postgres (PGlite) so the app works with
  // zero setup. It lives in memory on Vercel (read-only filesystem) and during
  // builds, where parallel workers must not share one data directory.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("./schema");
  const { seed } = await import("./seed");

  const inMemory =
    process.env.VERCEL || process.env.PGLITE_IN_MEMORY === "1" || process.env.NEXT_PHASE === "phase-production-build";
  const client = new PGlite(inMemory ? undefined : path.join(process.cwd(), ".pglite"));
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seed(db, { onlyIfEmpty: true });
  return db;
}

export function getDb(): Promise<Database> {
  globalThis.__db ??= connect().catch((error) => {
    globalThis.__db = undefined;
    throw error;
  });
  return globalThis.__db;
}
