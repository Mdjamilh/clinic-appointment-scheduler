import "server-only";

import { TZDate } from "@date-fns/tz";
import { format, isSameDay } from "date-fns";

import { env } from "./env";

/** Formats an instant in the clinic's timezone (all user-facing times use it). */
export function formatInClinic(date: Date, pattern: string): string {
  return format(new TZDate(date, env.CLINIC_TIMEZONE), pattern);
}

export function clinicNow(): TZDate {
  return new TZDate(new Date(), env.CLINIC_TIMEZONE);
}

/** e.g. "Today", "Tomorrow" or "Thu, Oct 23". */
export function relativeDayLabel(date: Date, now = new Date()): string {
  const day = new TZDate(date, env.CLINIC_TIMEZONE);
  const today = new TZDate(now, env.CLINIC_TIMEZONE);
  if (isSameDay(day, today)) return "Today";
  const tomorrow = new TZDate(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(day, tomorrow)) return "Tomorrow";
  return format(day, "EEE, MMM d");
}

/** Short timezone label such as "EDT", shown next to times so there's no ambiguity. */
export function clinicTimeZoneLabel(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: env.CLINIC_TIMEZONE,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? env.CLINIC_TIMEZONE;
}

export function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
