import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["patient", "admin"]);
export const appointmentStatus = pgEnum("appointment_status", ["booked", "cancelled"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: userRole("role").notNull().default("patient"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  specialty: text("specialty").notNull(),
  bio: text("bio").notNull(),
  location: text("location").notNull(),
  slotMinutes: integer("slot_minutes").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Weekly recurring working hours. Minutes are measured from midnight in the
 * clinic's timezone, so 9:00–17:00 is stored as 540–1020.
 */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
  },
  (t) => [
    index("availability_rules_provider_idx").on(t.providerId),
    check("availability_rules_weekday_check", sql`${t.weekday} between 0 and 6`),
    check(
      "availability_rules_window_check",
      sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute}`,
    ),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").notNull().default("booked"),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    // The database, not application code, is the final guard against double booking.
    uniqueIndex("appointments_provider_slot_booked_uq")
      .on(t.providerId, t.startsAt)
      .where(sql`${t.status} = 'booked'`),
    index("appointments_patient_starts_idx").on(t.patientId, t.startsAt),
    index("appointments_starts_idx").on(t.startsAt),
    check("appointments_time_order_check", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const providersRelations = relations(providers, ({ many }) => ({
  availability: many(availabilityRules),
  appointments: many(appointments),
}));

export const availabilityRulesRelations = relations(availabilityRules, ({ one }) => ({
  provider: one(providers, {
    fields: [availabilityRules.providerId],
    references: [providers.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  provider: one(providers, { fields: [appointments.providerId], references: [providers.id] }),
  patient: one(users, { fields: [appointments.patientId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  appointments: many(appointments),
}));

export type User = typeof users.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type AvailabilityRule = typeof availabilityRules.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
