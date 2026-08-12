import { describe, expect, it } from "vitest";

import type { Appointment, Provider } from "@/db/schema";
import { fhirAppointmentStatus, searchBundle, toFhirAppointment, toFhirPractitioner } from "./resources";
import { appointmentSearchSchema, parseDateParam, readSearchParams } from "./search";

const provider: Provider = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "james-okafor",
  name: "Dr. James Okafor",
  title: "MD, FACC",
  specialty: "Cardiology",
  bio: "",
  location: "Heart Center",
  slotMinutes: 45,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const appointment: Appointment = {
  id: "22222222-2222-4222-8222-222222222222",
  providerId: provider.id,
  patientId: "33333333-3333-4333-8333-333333333333",
  startsAt: new Date("2026-10-26T12:00:00Z"),
  endsAt: new Date("2026-10-26T12:45:00Z"),
  status: "booked",
  reason: "Palpitations",
  createdAt: new Date("2026-10-20T09:00:00Z"),
  cancelledAt: null,
};

const now = new Date("2026-10-23T12:00:00Z");

describe("toFhirAppointment", () => {
  it("maps a booking to a FHIR R4 Appointment with patient and practitioner participants", () => {
    const resource = toFhirAppointment(
      { ...appointment, provider, patient: { id: appointment.patientId, name: "Ava Thompson" } },
      now,
    );

    expect(resource).toMatchObject({
      resourceType: "Appointment",
      status: "booked",
      start: "2026-10-26T12:00:00.000Z",
      end: "2026-10-26T12:45:00.000Z",
      minutesDuration: 45,
      serviceType: [{ text: "Cardiology" }],
      description: "Palpitations",
    });
    expect(resource.participant.map((p) => p.actor.reference)).toEqual([
      `Patient/${appointment.patientId}`,
      `Practitioner/${provider.id}`,
    ]);
  });

  it("reports past bookings as fulfilled and keeps cancellations cancelled", () => {
    expect(fhirAppointmentStatus({ status: "booked", startsAt: new Date("2026-10-01T00:00:00Z") }, now)).toBe(
      "fulfilled",
    );
    expect(fhirAppointmentStatus({ status: "cancelled", startsAt: new Date("2026-12-01T00:00:00Z") }, now)).toBe(
      "cancelled",
    );
  });
});

describe("toFhirPractitioner", () => {
  it("splits the display name into structured HumanName parts", () => {
    expect(toFhirPractitioner(provider).name[0]).toEqual({
      text: "Dr. James Okafor, MD, FACC",
      prefix: ["Dr."],
      given: ["James"],
      family: "Okafor",
      suffix: ["MD", "FACC"],
    });
  });
});

describe("searchBundle", () => {
  it("wraps resources in a searchset Bundle with absolute fullUrls", () => {
    const bundle = searchBundle([toFhirPractitioner(provider)], "http://x/api/fhir/Practitioner", "http://x/api/fhir");
    expect(bundle.total).toBe(1);
    expect(bundle.entry[0].fullUrl).toBe(`http://x/api/fhir/Practitioner/${provider.id}`);
  });
});

describe("FHIR search parameters", () => {
  it("parses date prefixes at day and instant precision", () => {
    expect(parseDateParam("ge2026-10-01")).toEqual({
      op: "ge",
      value: new Date("2026-10-01T00:00:00Z"),
      dayPrecision: true,
    });
    expect(parseDateParam("lt2026-10-01T15:30:00Z")?.dayPrecision).toBe(false);
    expect(parseDateParam("2026-10-01")?.op).toBe("eq");
    expect(parseDateParam("soon")).toBeNull();
  });

  it("accepts repeated date params and comma-separated statuses", () => {
    const params = new URLSearchParams("date=ge2026-10-01&date=lt2026-11-01&status=booked,fulfilled");
    const { raw, unsupported } = readSearchParams(params);
    const parsed = appointmentSearchSchema.parse(raw);

    expect(unsupported).toEqual([]);
    expect(parsed.date).toHaveLength(2);
    expect(parsed.status).toEqual(["booked", "fulfilled"]);
    expect(parsed._count).toBe(50);
  });

  it("flags unknown parameters and rejects invalid values", () => {
    expect(readSearchParams(new URLSearchParams("identifier=123")).unsupported).toEqual(["identifier"]);
    expect(appointmentSearchSchema.safeParse({ status: "noshow" }).success).toBe(false);
    expect(appointmentSearchSchema.safeParse({ _count: "500" }).success).toBe(false);
  });
});
