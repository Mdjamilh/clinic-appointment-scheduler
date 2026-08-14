import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { searchBundle } from "@/lib/fhir/resources";
import { appointmentSearchSchema, readSearchParams } from "@/lib/fhir/search";
import { searchFhirAppointments } from "@/server/fhir";
import { getCurrentUser } from "@/server/session";
import { fhirBase, fhirDomainError, fhirError, fhirJson, unauthenticated } from "../respond";

/** GET /api/fhir/Appointment?patient=&practitioner=&status=&date=&_count= */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthenticated();

  const { raw, unsupported } = readSearchParams(request.nextUrl.searchParams);
  if (unsupported.length > 0) {
    return fhirError(400, "not-supported", `Unsupported search parameter(s): ${unsupported.join(", ")}`);
  }
  const search = appointmentSearchSchema.safeParse(raw);
  if (!search.success) return fhirError(400, "invalid", search.error.issues[0]?.message ?? "Invalid search");

  try {
    const db = await getDb();
    const resources = await searchFhirAppointments(db, search.data, user);
    return fhirJson(searchBundle(resources, request.url, fhirBase(request)));
  } catch (error) {
    return fhirDomainError(error);
  }
}
