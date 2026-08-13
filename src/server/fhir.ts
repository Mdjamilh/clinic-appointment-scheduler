import { addDays } from "date-fns";
import { and, asc, eq, gt, gte, lt, lte, or, type SQL } from "drizzle-orm";

import { appointments } from "@/db/schema";
import type { Executor } from "@/db/types";
import { toFhirAppointment } from "@/lib/fhir/resources";
import type { AppointmentSearch, DateFilter } from "@/lib/fhir/search";
import type { Actor } from "./appointments";
import { DomainError } from "./errors";

function statusCondition(status: "booked" | "fulfilled" | "cancelled", now: Date): SQL {
  switch (status) {
    case "cancelled":
      return eq(appointments.status, "cancelled");
    case "fulfilled":
      return and(eq(appointments.status, "booked"), lte(appointments.startsAt, now))!;
    case "booked":
      return and(eq(appointments.status, "booked"), gt(appointments.startsAt, now))!;
  }
}

/** Day-precision values cover the whole UTC day, per FHIR's implicit-range rule. */
function dateCondition({ op, value, dayPrecision }: DateFilter): SQL {
  const column = appointments.startsAt;
  if (!dayPrecision) {
    return { eq: eq, ge: gte, gt: gt, le: lte, lt: lt }[op](column, value);
  }
  const nextDay = addDays(value, 1);
  switch (op) {
    case "eq":
      return and(gte(column, value), lt(column, nextDay))!;
    case "ge":
      return gte(column, value);
    case "gt":
      return gte(column, nextDay);
    case "le":
      return lt(column, nextDay);
    case "lt":
      return lt(column, value);
  }
}

export async function searchFhirAppointments(db: Executor, search: AppointmentSearch, actor: Actor, now = new Date()) {
  if (actor.role === "patient" && search.patient && search.patient !== actor.id) {
    throw new DomainError("FORBIDDEN", "Patients can only read their own appointments.");
  }
  const patientId = actor.role === "patient" ? actor.id : search.patient;

  const rows = await db.query.appointments.findMany({
    where: and(
      patientId ? eq(appointments.patientId, patientId) : undefined,
      search.practitioner ? eq(appointments.providerId, search.practitioner) : undefined,
      search.status ? or(...search.status.map((s) => statusCondition(s, now))) : undefined,
      ...(search.date ?? []).map(dateCondition),
    ),
    with: { provider: true, patient: { columns: { id: true, name: true } } },
    orderBy: asc(appointments.startsAt),
    limit: search._count,
  });

  return rows.map((row) => toFhirAppointment(row, now));
}

export async function readFhirAppointment(db: Executor, id: string, actor: Actor, now = new Date()) {
  const row = await db.query.appointments.findFirst({
    where: eq(appointments.id, id),
    with: { provider: true, patient: { columns: { id: true, name: true } } },
  });
  // Don't reveal whether someone else's appointment exists.
  if (!row || (actor.role === "patient" && row.patientId !== actor.id)) {
    throw new DomainError("NOT_FOUND", `Appointment/${id} not found.`);
  }
  return toFhirAppointment(row, now);
}
