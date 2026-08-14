import { fhirJson } from "../respond";

/** GET /api/fhir/metadata — CapabilityStatement describing what this server supports. */
export function GET() {
  return fhirJson({
    resourceType: "CapabilityStatement",
    status: "active",
    date: new Date().toISOString(),
    kind: "instance",
    software: { name: "CareSlot FHIR facade" },
    fhirVersion: "4.0.1",
    format: ["application/fhir+json"],
    rest: [
      {
        mode: "server",
        documentation:
          "Read-only. Appointment endpoints require a signed-in session; patients only see their own data.",
        resource: [
          {
            type: "Appointment",
            interaction: [{ code: "read" }, { code: "search-type" }],
            searchParam: [
              { name: "patient", type: "reference" },
              { name: "practitioner", type: "reference" },
              { name: "status", type: "token" },
              { name: "date", type: "date" },
              { name: "_count", type: "number" },
            ],
          },
          {
            type: "Practitioner",
            interaction: [{ code: "read" }, { code: "search-type" }],
          },
        ],
      },
    ],
  });
}
