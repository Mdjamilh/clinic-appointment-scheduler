import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appointments, providers, users, type User } from "@/db/schema";
import type { Database } from "@/db/types";
import { appointmentSearchSchema } from "@/lib/fhir/search";
import { createTestDb } from "@/test/db";
import { readFhirAppointment, searchFhirAppointments } from "./fhir";

const now = new Date("2026-10-23T12:00:00Z");

let db: Database;
let close: () => Promise<void>;
let ava: User;
let noah: User;
let admin: User;
let avaFutureId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const [provider] = await db
    .insert(providers)
    .values({ slug: "p", name: "Dr. P", title: "MD", specialty: "Family Medicine", bio: "", location: "" })
    .returning();
  [ava, noah, admin] = await db
    .insert(users)
    .values([
      { name: "Ava", email: "ava@test.dev" },
      { name: "Noah", email: "noah@test.dev" },
      { name: "Admin", email: "admin@test.dev", role: "admin" },
    ])
    .returning();

  const at = (iso: string) => ({ startsAt: new Date(iso), endsAt: new Date(new Date(iso).getTime() + 30 * 60_000) });
  const rows = await db
    .insert(appointments)
    .values([
      { providerId: provider.id, patientId: ava.id, reason: "past", ...at("2026-10-01T14:00:00Z") },
      { providerId: provider.id, patientId: ava.id, reason: "future", ...at("2026-10-28T14:00:00Z") },
      {
        providerId: provider.id,
        patientId: ava.id,
        reason: "cancelled",
        status: "cancelled",
        cancelledAt: now,
        ...at("2026-10-29T14:00:00Z"),
      },
      { providerId: provider.id, patientId: noah.id, reason: "noah", ...at("2026-10-28T15:00:00Z") },
    ])
    .returning();
  avaFutureId = rows[1].id;
});

afterAll(async () => {
  await close();
});

const search = (query: Record<string, unknown> = {}) => appointmentSearchSchema.parse(query);

describe("searchFhirAppointments", () => {
  it("scopes patients to their own appointments even without a patient filter", async () => {
    const results = await searchFhirAppointments(db, search(), ava, now);
    expect(results.map((r) => r.description)).toEqual(["past", "future", "cancelled"]);
  });

  it("forbids patients from querying someone else", async () => {
    await expect(searchFhirAppointments(db, search({ patient: noah.id }), ava, now)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets admins search across patients", async () => {
    const results = await searchFhirAppointments(db, search({ patient: noah.id }), admin, now);
    expect(results.map((r) => r.description)).toEqual(["noah"]);
  });

  it("filters by derived FHIR status", async () => {
    const fulfilled = await searchFhirAppointments(db, search({ status: "fulfilled" }), ava, now);
    const upcoming = await searchFhirAppointments(db, search({ status: "booked,cancelled" }), ava, now);
    expect(fulfilled.map((r) => r.description)).toEqual(["past"]);
    expect(upcoming.map((r) => r.description)).toEqual(["future", "cancelled"]);
  });

  it("applies date ranges, treating day-precision bounds as whole days", async () => {
    const onDay = await searchFhirAppointments(db, search({ date: ["2026-10-28"] }), admin, now);
    const range = await searchFhirAppointments(db, search({ date: ["gt2026-10-01", "le2026-10-28"] }), ava, now);
    expect(onDay.map((r) => r.description)).toEqual(["future", "noah"]);
    expect(range.map((r) => r.description)).toEqual(["future"]);
  });
});

describe("readFhirAppointment", () => {
  it("returns 404-style errors for other patients' appointments", async () => {
    await expect(readFhirAppointment(db, avaFutureId, noah, now)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readFhirAppointment(db, avaFutureId, ava, now)).resolves.toMatchObject({ status: "booked" });
  });
});
