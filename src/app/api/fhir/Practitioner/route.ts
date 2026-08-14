import { asc } from "drizzle-orm";

import { getDb } from "@/db";
import { providers } from "@/db/schema";
import { searchBundle, toFhirPractitioner } from "@/lib/fhir/resources";
import { fhirBase, fhirJson } from "../respond";

/** GET /api/fhir/Practitioner — the provider directory is public, like the app's. */
export async function GET(request: Request) {
  const db = await getDb();
  const rows = await db.query.providers.findMany({ orderBy: asc(providers.name) });
  return fhirJson(searchBundle(rows.map(toFhirPractitioner), request.url, fhirBase(request)));
}
