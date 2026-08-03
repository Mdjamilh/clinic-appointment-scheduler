import { describe, expect, it } from "vitest";

import { generateSlots, isValidSlotStart } from "./slots";

const TZ = "America/New_York";
// Monday 9:00–12:00, 30-minute visits.
const rules = [{ weekday: 1, startMinute: 540, endMinute: 720 }];

describe("generateSlots", () => {
  it("expands working hours into back-to-back slots in the clinic timezone", () => {
    const [monday] = generateSlots({
      rules,
      slotMinutes: 30,
      from: new Date("2026-03-02T15:00:00Z"), // Monday 10:00 in New York
      days: 1,
      timeZone: TZ,
    });

    expect(monday.date).toBe("2026-03-02");
    expect(monday.slots).toHaveLength(6);
    expect(monday.slots[0].startsAt.toISOString()).toBe("2026-03-02T14:00:00.000Z");
    expect(monday.slots.at(-1)?.endsAt.toISOString()).toBe("2026-03-02T17:00:00.000Z");
  });

  it("drops a trailing partial slot that would overrun the window", () => {
    const [day] = generateSlots({ rules, slotMinutes: 45, from: new Date("2026-03-02T15:00:00Z"), days: 1, timeZone: TZ });
    // 9:00, 9:45, 10:30, 11:15 — 12:00 would end at 12:45.
    expect(day.slots).toHaveLength(4);
  });

  it("returns empty days when the provider doesn't work", () => {
    const days = generateSlots({ rules, slotMinutes: 30, from: new Date("2026-03-03T15:00:00Z"), days: 6, timeZone: TZ });
    expect(days.map((d) => d.slots.length)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("keeps local wall-clock times across a daylight-saving change", () => {
    const days = generateSlots({ rules, slotMinutes: 30, from: new Date("2026-03-02T15:00:00Z"), days: 8, timeZone: TZ });
    const before = days[0].slots[0].startsAt; // EST, UTC-5
    const after = days[7].slots[0].startsAt; // EDT, UTC-4
    expect(before.toISOString()).toBe("2026-03-02T14:00:00.000Z");
    expect(after.toISOString()).toBe("2026-03-09T13:00:00.000Z");
  });
});

describe("isValidSlotStart", () => {
  const options = { rules, slotMinutes: 30, timeZone: TZ };

  it("accepts slot boundaries inside working hours", () => {
    expect(isValidSlotStart(new Date("2026-03-02T14:30:00Z"), options)).toBe(true);
  });

  it("rejects times off the slot grid, outside hours, or on other days", () => {
    expect(isValidSlotStart(new Date("2026-03-02T14:10:00Z"), options)).toBe(false);
    expect(isValidSlotStart(new Date("2026-03-02T17:00:00Z"), options)).toBe(false);
    expect(isValidSlotStart(new Date("2026-03-03T14:30:00Z"), options)).toBe(false);
  });
});
