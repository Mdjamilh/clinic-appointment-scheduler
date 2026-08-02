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
  // zero setup. On Vercel the filesystem is read-only, so it lives in memory.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("./schema");
  const { seed } = await import("./seed");

  const client = new PGlite(process.env.VERCEL ? undefined : path.join(process.cwd(), ".pglite"));
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
