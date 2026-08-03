import "server-only";

import { TZDate } from "@date-fns/tz";
import { addDays, addWeeks, endOfDay, isValid, parseISO, startOfDay, startOfWeek, subDays } from "date-fns";
import { and, asc, count, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";

import { getDb } from "@/db";
import { appointments, providers, users, type Provider } from "@/db/schema";
import { env } from "@/lib/env";
import { formatInClinic } from "@/lib/format";
import { generateSlots } from "@/lib/slots";
import { BOOKING_HORIZON_DAYS } from "./appointments";

const NEXT_AVAILABLE_WINDOW_DAYS = 21;

async function bookedStarts(providerIds: string[], from: Date, to: Date) {
  if (providerIds.length === 0) return new Map<string, Set<number>>();
  const db = await getDb();
  const rows = await db
    .select({ providerId: appointments.providerId, startsAt: appointments.startsAt })
    .from(appointments)
    .where(
      and(
        inArray(appointments.providerId, providerIds),
        eq(appointments.status, "booked"),
        gte(appointments.startsAt, from),
        lt(appointments.startsAt, to),
      ),
    );

  const byProvider = new Map<string, Set<number>>();
  for (const row of rows) {
    const set = byProvider.get(row.providerId) ?? new Set<number>();
    set.add(row.startsAt.getTime());
    byProvider.set(row.providerId, set);
  }
  return byProvider;
}

export type ProviderSummary = Provider & { nextAvailable: Date | null };

export async function listProviders(filters: { q?: string; specialty?: string } = {}): Promise<ProviderSummary[]> {
  const db = await getDb();
  const q = filters.q?.trim();
  const rows = await db.query.providers.findMany({
    where: and(
      q ? or(ilike(providers.name, `%${q}%`), ilike(providers.specialty, `%${q}%`)) : undefined,
      filters.specialty ? eq(providers.specialty, filters.specialty) : undefined,
    ),
    with: { availability: true },
    orderBy: asc(providers.name),
  });

  const now = new Date();
  const until = addDays(now, NEXT_AVAILABLE_WINDOW_DAYS);
  const booked = await bookedStarts(
    rows.map((p) => p.id),
    now,
    until,
  );

  return rows.map(({ availability, ...provider }) => {
    const taken = booked.get(provider.id) ?? new Set<number>();
    const next = generateSlots({
      rules: availability,
      slotMinutes: provider.slotMinutes,
      from: now,
      days: NEXT_AVAILABLE_WINDOW_DAYS,
      timeZone: env.CLINIC_TIMEZONE,
    })
      .flatMap((day) => day.slots)
      .find((slot) => slot.startsAt > now && !taken.has(slot.startsAt.getTime()));
    return { ...provider, nextAvailable: next?.startsAt ?? null };
  });
}

export async function listSpecialties(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.selectDistinct({ specialty: providers.specialty }).from(providers).orderBy(providers.specialty);
  return rows.map((row) => row.specialty);
}

export async function getProviderBySlug(slug: string) {
  const db = await getDb();
  return db.query.providers.findFirst({ where: eq(providers.slug, slug), with: { availability: true } });
}

export type ScheduleSlot = { startsAt: string; label: string; available: boolean };
export type ScheduleDay = {
  date: string;
  weekday: string;
  dayLabel: string;
  isToday: boolean;
  isPast: boolean;
  slots: ScheduleSlot[];
};

/** Resolves the `?week=` param to a Monday in the clinic timezone, clamped to the bookable range. */
export function resolveWeek(param: string | undefined) {
  const tz = env.CLINIC_TIMEZONE;
  const currentWeek = startOfWeek(new TZDate(new Date(), tz), { weekStartsOn: 1 });
  const lastWeek = startOfWeek(addDays(currentWeek, BOOKING_HORIZON_DAYS), { weekStartsOn: 1 });

  let week = currentWeek;
  if (param) {
    const parsed = parseISO(param);
    if (isValid(parsed)) {
      const requested = startOfWeek(new TZDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), tz), {
        weekStartsOn: 1,
      });
      if (requested > currentWeek && requested <= lastWeek) week = requested;
    }
  }

  return {
    start: week,
    key: formatInClinic(week, "yyyy-MM-dd"),
    prevKey: week > currentWeek ? formatInClinic(addWeeks(week, -1), "yyyy-MM-dd") : null,
    nextKey: week < lastWeek ? formatInClinic(addWeeks(week, 1), "yyyy-MM-dd") : null,
    label: `${formatInClinic(week, "MMM d")} – ${formatInClinic(addDays(week, 6), "MMM d, yyyy")}`,
  };
}

export async function getProviderWeek(
  provider: NonNullable<Awaited<ReturnType<typeof getProviderBySlug>>>,
  weekStart: Date,
): Promise<ScheduleDay[]> {
  const now = new Date();
  const horizon = addDays(now, BOOKING_HORIZON_DAYS);
  const booked = (await bookedStarts([provider.id], weekStart, addDays(weekStart, 7))).get(provider.id) ?? new Set();
  const todayKey = formatInClinic(now, "yyyy-MM-dd");

  return generateSlots({
    rules: provider.availability,
    slotMinutes: provider.slotMinutes,
    from: weekStart,
    days: 7,
    timeZone: env.CLINIC_TIMEZONE,
  }).map((day) => {
    const [y, m, d] = day.date.split("-").map(Number);
    const anchor = new TZDate(y, m - 1, d, 12, 0, env.CLINIC_TIMEZONE);
    return {
      date: day.date,
      weekday: formatInClinic(anchor, "EEE"),
      dayLabel: formatInClinic(anchor, "MMM d"),
      isToday: day.date === todayKey,
      isPast: day.date < todayKey,
      slots: day.slots.map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        label: formatInClinic(slot.startsAt, "h:mm a"),
        available: slot.startsAt > now && slot.startsAt <= horizon && !booked.has(slot.startsAt.getTime()),
      })),
    };
  });
}

export async function getPatientAppointments(patientId: string) {
  const db = await getDb();
  const rows = await db.query.appointments.findMany({
    where: eq(appointments.patientId, patientId),
    with: { provider: true },
    orderBy: asc(appointments.startsAt),
  });

  const now = new Date();
  return {
    upcoming: rows.filter((a) => a.status === "booked" && a.startsAt > now),
    past: rows.filter((a) => a.status === "booked" && a.startsAt <= now).reverse(),
    cancelled: rows.filter((a) => a.status === "cancelled").reverse(),
  };
}

export async function getNextAppointment(patientId: string) {
  const db = await getDb();
  return db.query.appointments.findFirst({
    where: and(
      eq(appointments.patientId, patientId),
      eq(appointments.status, "booked"),
      gte(appointments.startsAt, new Date()),
    ),
    with: { provider: true },
    orderBy: asc(appointments.startsAt),
  });
}

/** Looks up an upcoming booking the user is allowed to move. */
export async function getReschedulableAppointment(appointmentId: string, user: { id: string; role: string }) {
  const db = await getDb();
  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
    with: { provider: true },
  });
  if (!appointment || appointment.status !== "booked" || appointment.startsAt <= new Date()) return null;
  if (user.role !== "admin" && appointment.patientId !== user.id) return null;
  return appointment;
}

export async function getAdminOverview() {
  const db = await getDb();
  const now = new Date();
  const tz = env.CLINIC_TIMEZONE;
  const todayStart = startOfDay(new TZDate(now, tz));
  const todayEnd = endOfDay(new TZDate(now, tz));
  const weekEnd = addDays(todayStart, 7);
  const monthAgo = subDays(now, 30);

  const [todayRows, weekCount, recentTotals, upcoming, providerRows, patientCount] = await Promise.all([
    db
      .select({ providerId: appointments.providerId, value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.status, "booked"),
          gte(appointments.startsAt, todayStart),
          lt(appointments.startsAt, todayEnd),
        ),
      )
      .groupBy(appointments.providerId),
    db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.status, "booked"),
          gte(appointments.startsAt, todayStart),
          lt(appointments.startsAt, weekEnd),
        ),
      ),
    db
      .select({ status: appointments.status, value: count() })
      .from(appointments)
      .where(gte(appointments.createdAt, monthAgo))
      .groupBy(appointments.status),
    db.query.appointments.findMany({
      where: and(
        eq(appointments.status, "booked"),
        gte(appointments.startsAt, now),
        lt(appointments.startsAt, weekEnd),
      ),
      with: { provider: true, patient: true },
      orderBy: asc(appointments.startsAt),
      limit: 40,
    }),
    db.query.providers.findMany({ with: { availability: true }, orderBy: asc(providers.name) }),
    db.select({ value: count() }).from(users).where(eq(users.role, "patient")),
  ]);

  const todayByProvider = new Map(todayRows.map((row) => [row.providerId, row.value]));
  const utilization = providerRows.map(({ availability, ...provider }) => {
    const [today] = generateSlots({
      rules: availability,
      slotMinutes: provider.slotMinutes,
      from: now,
      days: 1,
      timeZone: tz,
    });
    const booked = todayByProvider.get(provider.id) ?? 0;
    return { provider, booked, capacity: today.slots.length };
  });

  const bookedToday = todayRows.reduce((sum, row) => sum + row.value, 0);
  const capacityToday = utilization.reduce((sum, row) => sum + row.capacity, 0);
  const created = recentTotals.reduce((sum, row) => sum + row.value, 0);
  const cancelled = recentTotals.find((row) => row.status === "cancelled")?.value ?? 0;

  return {
    stats: {
      bookedToday,
      utilizationToday: capacityToday ? bookedToday / capacityToday : 0,
      bookedNext7Days: weekCount[0]?.value ?? 0,
      cancellationRate30d: created ? cancelled / created : 0,
      patients: patientCount[0]?.value ?? 0,
    },
    utilization,
    upcoming,
  };
}

export async function listDemoAccounts() {
  const db = await getDb();
  return db.query.users.findMany({
    where: inArray(users.email, ["ava@example.com", "noah@example.com", "priya@example.com", "admin@example.com"]),
    orderBy: [asc(users.role), asc(users.name)],
  });
}
