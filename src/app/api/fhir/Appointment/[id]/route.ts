import { z } from "zod";

import { getDb } from "@/db";
import { readFhirAppointment } from "@/server/fhir";
import { getCurrentUser } from "@/server/session";
import { fhirDomainError, fhirError, fhirJson, unauthenticated } from "../../respond";

/** GET /api/fhir/Appointment/:id */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthenticated();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fhirError(404, "not-found", `Appointment/${id} not found.`);

  try {
    const db = await getDb();
    return fhirJson(await readFhirAppointment(db, id, user));
  } catch (error) {
    return fhirDomainError(error);
  }
}
