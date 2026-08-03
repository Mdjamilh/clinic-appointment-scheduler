import { TZDate } from "@date-fns/tz";
import { addDays, addMinutes, format, startOfDay } from "date-fns";

export type WeeklyRule = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type Slot = {
  startsAt: Date;
  endsAt: Date;
};

export type DaySlots = {
  /** Calendar date in the clinic timezone, `yyyy-MM-dd`. */
  date: string;
  slots: Slot[];
};

type GenerateOptions = {
  rules: WeeklyRule[];
  slotMinutes: number;
  /** Any instant on the first day to generate. */
  from: Date;
  days: number;
  timeZone: string;
};

/**
 * Expands weekly working hours into concrete bookable slots, day by day, in
 * the clinic's timezone. Pure: it knows nothing about existing bookings.
 */
export function generateSlots({ rules, slotMinutes, from, days, timeZone }: GenerateOptions): DaySlots[] {
  if (slotMinutes <= 0) throw new RangeError("slotMinutes must be positive");

  const firstDay = startOfDay(new TZDate(from, timeZone));
  const result: DaySlots[] = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(firstDay, i);
    const dayRules = rules
      .filter((rule) => rule.weekday === day.getDay())
      .sort((a, b) => a.startMinute - b.startMinute);

    const slots: Slot[] = [];
    for (const rule of dayRules) {
      for (let minute = rule.startMinute; minute + slotMinutes <= rule.endMinute; minute += slotMinutes) {
        const start = new TZDate(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          Math.floor(minute / 60),
          minute % 60,
          timeZone,
        );
        slots.push({ startsAt: new Date(start.getTime()), endsAt: addMinutes(new Date(start.getTime()), slotMinutes) });
      }
    }

    result.push({ date: format(day, "yyyy-MM-dd"), slots });
  }

  return result;
}

/** True when `startsAt` lands exactly on a slot boundary inside the provider's hours. */
export function isValidSlotStart(
  startsAt: Date,
  { rules, slotMinutes, timeZone }: Omit<GenerateOptions, "from" | "days">,
): boolean {
  const local = new TZDate(startsAt, timeZone);
  if (local.getSeconds() !== 0 || local.getMilliseconds() !== 0) return false;

  const minute = local.getHours() * 60 + local.getMinutes();
  return rules.some(
    (rule) =>
      rule.weekday === local.getDay() &&
      minute >= rule.startMinute &&
      minute + slotMinutes <= rule.endMinute &&
      (minute - rule.startMinute) % slotMinutes === 0,
  );
}
