import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers";

test("the FHIR API requires a session and returns a searchset Bundle", async ({ page }) => {
  const anonymous = await page.request.get("/api/fhir/Appointment");
  expect(anonymous.status()).toBe(401);
  expect((await anonymous.json()).resourceType).toBe("OperationOutcome");

  await signInAs(page, "Priya Shah");
  const response = await page.request.get("/api/fhir/Appointment?status=booked");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/fhir+json");

  const bundle = await response.json();
  expect(bundle).toMatchObject({ resourceType: "Bundle", type: "searchset" });
  for (const entry of bundle.entry) {
    expect(entry.resource.resourceType).toBe("Appointment");
    expect(entry.resource.status).toBe("booked");
    expect(entry.resource.participant[0].actor.display).toBe("Priya Shah");
  }
});

test("practitioners and the capability statement are public", async ({ request }) => {
  const practitioners = await (await request.get("/api/fhir/Practitioner")).json();
  expect(practitioners.total).toBe(6);

  const metadata = await (await request.get("/api/fhir/metadata")).json();
  expect(metadata).toMatchObject({ resourceType: "CapabilityStatement", fhirVersion: "4.0.1" });
});
