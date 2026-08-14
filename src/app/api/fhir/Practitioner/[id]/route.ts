import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { providers } from "@/db/schema";
import { toFhirPractitioner } from "@/lib/fhir/resources";
import { fhirError, fhirJson } from "../../respond";

/** GET /api/fhir/Practitioner/:id */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notFound = () => fhirError(404, "not-found", `Practitioner/${id} not found.`);
  if (!z.uuid().safeParse(id).success) return notFound();

  const db = await getDb();
  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  return provider ? fhirJson(toFhirPractitioner(provider)) : notFound();
}
