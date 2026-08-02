import { addDays, subDays } from "date-fns";
import { count } from "drizzle-orm";

import { generateSlots } from "@/lib/slots";
import { appointments, availabilityRules, providers, users } from "./schema";
import type { Database } from "./types";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const weekdays = (days: number[], startMinute: number, endMinute: number) =>
  days.map((weekday) => ({ weekday, startMinute, endMinute }));

const MON_FRI = [1, 2, 3, 4, 5];

const PROVIDERS = [
  {
    slug: "maya-patel",
    name: "Dr. Maya Patel",
    title: "MD",
    specialty: "Family Medicine",
    location: "Room 104 · Main Clinic",
    slotMinutes: 30,
    bio: "Primary care for the whole family, with a focus on preventive care and chronic condition management.",
    hours: [...weekdays(MON_FRI, h(9), h(12)), ...weekdays(MON_FRI, h(13), h(17))],
  },
  {
    slug: "james-okafor",
    name: "Dr. James Okafor",
    title: "MD, FACC",
    specialty: "Cardiology",
    location: "Heart Center · 2nd Floor",
    slotMinutes: 45,
    bio: "Board-certified cardiologist treating hypertension, arrhythmias and post-cardiac-event recovery.",
    hours: weekdays([1, 3, 4], h(8), h(14)),
  },
  {
    slug: "sofia-ramirez",
    name: "Dr. Sofia Ramirez",
    title: "DO",
    specialty: "Pediatrics",
    location: "Children's Wing · Room 12",
    slotMinutes: 30,
    bio: "Well-child visits, vaccinations and sick visits for newborns through teens. Saturday hours available.",
    hours: weekdays([2, 3, 4, 5, 6], h(10), h(16)),
  },
  {
    slug: "daniel-kim",
    name: "Dr. Daniel Kim",
    title: "MD",
    specialty: "Dermatology",
    location: "Room 210 · Main Clinic",
    slotMinutes: 20,
    bio: "Medical dermatology including acne, eczema, psoriasis and annual skin cancer screenings.",
    hours: weekdays([1, 2, 4, 5], h(9), h(15)),
  },
  {
    slug: "aisha-rahman",
    name: "Dr. Aisha Rahman",
    title: "PsyD",
    specialty: "Behavioral Health",
    location: "Wellness Suite · Room 3",
    slotMinutes: 60,
    bio: "Licensed psychologist offering evidence-based therapy for anxiety, depression and stress.",
    hours: weekdays([1, 2, 3, 4], h(11), h(19)),
  },
  {
    slug: "lucas-bennett",
    name: "Dr. Lucas Bennett",
    title: "PT, DPT",
    specialty: "Physical Therapy",
    location: "Rehab Gym · Ground Floor",
    slotMinutes: 45,
    bio: "Sports and orthopedic rehabilitation, post-surgical recovery and mobility programs.",
    hours: weekdays(MON_FRI, h(7), h(13)),
  },
];

export const DEMO_USERS = [
  { name: "Ava Thompson", email: "ava@example.com", role: "patient" as const },
  { name: "Noah Williams", email: "noah@example.com", role: "patient" as const },
  { name: "Priya Shah", email: "priya@example.com", role: "patient" as const },
  { name: "Jordan Lee", email: "admin@example.com", role: "admin" as const },
];

// Other clinic patients, so the admin view looks like a real clinic day.
const BACKGROUND_PATIENTS = [
  "Liam Carter", "Emma Rodriguez", "Oliver Nguyen", "Sophia Brooks", "Elijah Moore", "Isabella Cruz",
  "Lucas Foster", "Mia Hughes", "Mason Price", "Amelia Ward", "Ethan Kelly", "Harper Diaz",
  "Logan Reyes", "Evelyn Sanders", "Aiden Ross", "Abigail Perry", "Caleb Long", "Ella Jenkins",
].map((name) => ({
  name,
  email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
  role: "patient" as const,
}));

const REASONS = [
  "Annual physical",
  "Follow-up visit",
  "Persistent cough",
  "Blood pressure check",
  "Medication review",
  "Skin rash",
  "Knee pain after running",
  "Routine check-up",
  "Lab results review",
  "Trouble sleeping",
];

/** Small deterministic PRNG so every fresh database looks the same. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SeedOptions = {
  onlyIfEmpty?: boolean;
  now?: Date;
  timeZone?: string;
};

export async function seed(db: Database, options: SeedOptions = {}) {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? process.env.CLINIC_TIMEZONE ?? "America/New_York";

  if (options.onlyIfEmpty) {
    const [{ value }] = await db.select({ value: count() }).from(users);
    if (value > 0) return;
  }

  await db.transaction(async (tx) => {
    const random = mulberry32(42);
    const demoPatients = (await tx.insert(users).values(DEMO_USERS).returning()).filter(
      (user) => user.role === "patient",
    );
    const backgroundPatients = await tx.insert(users).values(BACKGROUND_PATIENTS).returning();

    // Demo accounts get a realistic handful of visits; everyone else fills the clinic.
    const pickPatient = () => {
      const roll = random();
      if (roll < 0.035) return demoPatients[0];
      if (roll < 0.06) return demoPatients[1];
      if (roll < 0.08) return demoPatients[2];
      return backgroundPatients[Math.floor(random() * backgroundPatients.length)];
    };

    const booked: (typeof appointments.$inferInsert)[] = [];
    const patientBusy = new Map<string, { start: number; end: number }[]>();

    for (const definition of PROVIDERS) {
      const { hours, ...values } = definition;
      const [provider] = await tx.insert(providers).values(values).returning();
      await tx.insert(availabilityRules).values(hours.map((rule) => ({ ...rule, providerId: provider.id })));

      // Sprinkle past and upcoming visits so dashboards aren't empty.
      const days = generateSlots({
        rules: hours,
        slotMinutes: provider.slotMinutes,
        from: subDays(now, 28),
        days: 28 + 21,
        timeZone,
      });
      for (const slot of days.flatMap((day) => day.slots)) {
        const upcoming = slot.startsAt > now;
        if (random() > (upcoming ? 0.35 : 0.55) || slot.startsAt > addDays(now, 21)) continue;

        const patient = pickPatient();
        const busy = patientBusy.get(patient.id) ?? [];
        const start = slot.startsAt.getTime();
        const end = slot.endsAt.getTime();
        if (busy.some((b) => b.start < end && b.end > start)) continue;
        busy.push({ start, end });
        patientBusy.set(patient.id, busy);

        const cancelled = random() < 0.08;
        booked.push({
          providerId: provider.id,
          patientId: patient.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          reason: REASONS[Math.floor(random() * REASONS.length)],
          status: cancelled ? "cancelled" : "booked",
          cancelledAt: cancelled ? subDays(slot.startsAt, 2) : null,
          createdAt: subDays(slot.startsAt, 3 + Math.floor(random() * 10)),
        });
      }
    }

    if (booked.length > 0) await tx.insert(appointments).values(booked);
  });
}
