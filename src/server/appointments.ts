import { addDays, addMinutes } from "date-fns";
import { and, eq, gt, lt } from "drizzle-orm";

import { appointments, providers, type Appointment } from "@/db/schema";
import type { Executor } from "@/db/types";
import { isValidSlotStart } from "@/lib/slots";
import { DomainError, isUniqueViolation } from "./errors";

/** How far ahead patients may book. */
export const BOOKING_HORIZON_DAYS = 60;

export type Actor = { id: string; role: "patient" | "admin" };

type Context = { timeZone: string; now?: Date };

type BookInput = {
  patientId: string;
  providerId: string;
  startsAt: Date;
  reason: string;
};

async function loadProvider(db: Executor, providerId: string) {
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
    with: { availability: true },
  });
  if (!provider) throw new DomainError("NOT_FOUND", "That provider no longer exists.");
  return provider;
}

async function insertBooking(tx: Executor, input: BookInput, ctx: Context): Promise<Appointment> {
  const now = ctx.now ?? new Date();
  const provider = await loadProvider(tx, input.providerId);

  if (input.startsAt <= now) {
    throw new DomainError("INVALID_SLOT", "That time has already passed. Please pick another slot.");
  }
  if (input.startsAt > addDays(now, BOOKING_HORIZON_DAYS)) {
    throw new DomainError("INVALID_SLOT", `Appointments can be booked up to ${BOOKING_HORIZON_DAYS} days ahead.`);
  }
  const slotRules = { rules: provider.availability, slotMinutes: provider.slotMinutes, timeZone: ctx.timeZone };
  if (!isValidSlotStart(input.startsAt, slotRules)) {
    throw new DomainError("INVALID_SLOT", "That time isn't within this provider's schedule.");
  }

  const endsAt = addMinutes(input.startsAt, provider.slotMinutes);

  const overlapping = await tx.query.appointments.findFirst({
    columns: { id: true },
    where: and(
      eq(appointments.patientId, input.patientId),
      eq(appointments.status, "booked"),
      lt(appointments.startsAt, endsAt),
      gt(appointments.endsAt, input.startsAt),
    ),
  });
  if (overlapping) {
    throw new DomainError("PATIENT_CONFLICT", "You already have an appointment at that time.");
  }

  try {
    const [created] = await tx
      .insert(appointments)
      .values({
        providerId: provider.id,
        patientId: input.patientId,
        startsAt: input.startsAt,
        endsAt,
        reason: input.reason,
      })
      .returning();
    return created;
  } catch (error) {
    // Two patients raced for the same slot; the partial unique index decided.
    if (isUniqueViolation(error)) {
      throw new DomainError("SLOT_TAKEN", "Someone just booked that slot. Please choose another time.");
    }
    throw error;
  }
}

async function loadOwnedBooking(db: Executor, appointmentId: string, actor: Actor, now: Date) {
  const appointment = await db.query.appointments.findFirst({ where: eq(appointments.id, appointmentId) });
  if (!appointment) throw new DomainError("NOT_FOUND", "Appointment not found.");
  if (actor.role !== "admin" && appointment.patientId !== actor.id) {
    throw new DomainError("FORBIDDEN", "You can only change your own appointments.");
  }
  if (appointment.status !== "booked" || appointment.startsAt <= now) {
    throw new DomainError("NOT_CANCELLABLE", "Only upcoming appointments can be changed.");
  }
  return appointment;
}

export async function bookAppointment(db: Executor, input: BookInput, ctx: Context): Promise<Appointment> {
  return db.transaction((tx) => insertBooking(tx, input, ctx));
}

export async function cancelAppointment(
  db: Executor,
  { appointmentId, actor }: { appointmentId: string; actor: Actor },
  ctx: Context,
): Promise<Appointment> {
  const now = ctx.now ?? new Date();
  return db.transaction(async (tx) => {
    await loadOwnedBooking(tx, appointmentId, actor, now);
    const [cancelled] = await tx
      .update(appointments)
      .set({ status: "cancelled", cancelledAt: now })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "booked")))
      .returning();
    if (!cancelled) throw new DomainError("NOT_CANCELLABLE", "This appointment was already cancelled.");
    return cancelled;
  });
}

/**
 * Moves an appointment to a new slot with the same provider. Runs as a single
 * transaction so the patient never ends up with zero or two bookings.
 */
export async function rescheduleAppointment(
  db: Executor,
  { appointmentId, actor, startsAt }: { appointmentId: string; actor: Actor; startsAt: Date },
  ctx: Context,
): Promise<Appointment> {
  const now = ctx.now ?? new Date();
  return db.transaction(async (tx) => {
    const existing = await loadOwnedBooking(tx, appointmentId, actor, now);
    if (existing.startsAt.getTime() === startsAt.getTime()) {
      throw new DomainError("INVALID_SLOT", "Pick a different time to reschedule.");
    }
    await tx
      .update(appointments)
      .set({ status: "cancelled", cancelledAt: now })
      .where(eq(appointments.id, existing.id));
    return insertBooking(
      tx,
      { patientId: existing.patientId, providerId: existing.providerId, startsAt, reason: existing.reason },
      { ...ctx, now },
    );
  });
}
