import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { appointments, availabilityRules, providers, users, type Provider, type User } from "@/db/schema";
import type { Database } from "@/db/types";
import { createTestDb } from "@/test/db";
import { bookAppointment, cancelAppointment, rescheduleAppointment } from "./appointments";

const ctx = { timeZone: "America/New_York", now: new Date("2026-03-02T12:00:00Z") }; // Mon 7:00 ET
// Monday slots at 9:00, 9:30 ... 11:30 ET (14:00Z onward).
const SLOT_9 = new Date("2026-03-02T14:00:00Z");
const SLOT_930 = new Date("2026-03-02T14:30:00Z");

let db: Database;
let close: () => Promise<void>;
let provider: Provider;
let ava: User;
let noah: User;
let admin: User;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(appointments);
  await db.delete(availabilityRules);
  await db.delete(providers);
  await db.delete(users);

  [provider] = await db
    .insert(providers)
    .values({ slug: "test", name: "Dr. Test", title: "MD", specialty: "Family Medicine", bio: "", location: "" })
    .returning();
  await db.insert(availabilityRules).values({ providerId: provider.id, weekday: 1, startMinute: 540, endMinute: 720 });
  [ava, noah, admin] = await db
    .insert(users)
    .values([
      { name: "Ava", email: "ava@test.dev" },
      { name: "Noah", email: "noah@test.dev" },
      { name: "Admin", email: "admin@test.dev", role: "admin" },
    ])
    .returning();
});

const book = (patient: User, startsAt: Date) =>
  bookAppointment(db, { patientId: patient.id, providerId: provider.id, startsAt, reason: "Check-up" }, ctx);

describe("bookAppointment", () => {
  it("books a free slot and derives the end time from the provider's visit length", async () => {
    const appointment = await book(ava, SLOT_9);
    expect(appointment.status).toBe("booked");
    expect(appointment.endsAt.toISOString()).toBe("2026-03-02T14:30:00.000Z");
  });

  it("rejects a slot another patient already holds", async () => {
    await book(ava, SLOT_9);
    await expect(book(noah, SLOT_9)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
  });

  it("only lets one of two concurrent requests win the same slot", async () => {
    const results = await Promise.allSettled([book(ava, SLOT_9), book(noah, SLOT_9)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("rejects past times, off-grid times and times outside working hours", async () => {
    await expect(book(ava, new Date("2026-03-02T11:00:00Z"))).rejects.toMatchObject({ code: "INVALID_SLOT" });
    await expect(book(ava, new Date("2026-03-02T14:10:00Z"))).rejects.toMatchObject({ code: "INVALID_SLOT" });
    await expect(book(ava, new Date("2026-03-03T14:00:00Z"))).rejects.toMatchObject({ code: "INVALID_SLOT" });
  });

  it("stops a patient from double-booking themselves", async () => {
    const [other] = await db
      .insert(providers)
      .values({ slug: "other", name: "Dr. Other", title: "MD", specialty: "Cardiology", bio: "", location: "" })
      .returning();
    await db.insert(availabilityRules).values({ providerId: other.id, weekday: 1, startMinute: 540, endMinute: 720 });
    await book(ava, SLOT_9);

    await expect(
      bookAppointment(db, { patientId: ava.id, providerId: other.id, startsAt: SLOT_9, reason: "x" }, ctx),
    ).rejects.toMatchObject({ code: "PATIENT_CONFLICT" });
  });

  it("frees the slot again once the original booking is cancelled", async () => {
    const first = await book(ava, SLOT_9);
    await cancelAppointment(db, { appointmentId: first.id, actor: { id: ava.id, role: "patient" } }, ctx);
    await expect(book(noah, SLOT_9)).resolves.toMatchObject({ status: "booked" });
  });
});

describe("cancelAppointment", () => {
  it("does not let a patient cancel someone else's appointment", async () => {
    const appointment = await book(ava, SLOT_9);
    await expect(
      cancelAppointment(db, { appointmentId: appointment.id, actor: { id: noah.id, role: "patient" } }, ctx),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets an admin cancel any upcoming appointment", async () => {
    const appointment = await book(ava, SLOT_9);
    const cancelled = await cancelAppointment(
      db,
      { appointmentId: appointment.id, actor: { id: admin.id, role: "admin" } },
      ctx,
    );
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toEqual(ctx.now);
  });
});

describe("rescheduleAppointment", () => {
  it("moves the booking atomically and releases the old slot", async () => {
    const original = await book(ava, SLOT_9);
    const moved = await rescheduleAppointment(
      db,
      { appointmentId: original.id, actor: { id: ava.id, role: "patient" }, startsAt: SLOT_930 },
      ctx,
    );

    expect(moved.startsAt).toEqual(SLOT_930);
    await expect(book(noah, SLOT_9)).resolves.toBeTruthy();
  });

  it("leaves the original booking intact when the new slot is taken", async () => {
    const original = await book(ava, SLOT_9);
    await book(noah, SLOT_930);

    await expect(
      rescheduleAppointment(
        db,
        { appointmentId: original.id, actor: { id: ava.id, role: "patient" }, startsAt: SLOT_930 },
        ctx,
      ),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });

    const stillThere = await db.query.appointments.findFirst({ where: (a, { eq }) => eq(a.id, original.id) });
    expect(stillThere?.status).toBe("booked");
  });
});
