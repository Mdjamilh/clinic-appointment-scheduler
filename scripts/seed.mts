import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Without it the app seeds its embedded database automatically.");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
await seed(drizzle(client, { schema }), { onlyIfEmpty: process.argv.includes("--if-empty") });
await client.end();
console.log("Seed complete.");
