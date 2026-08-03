"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";
import { bookAppointment, cancelAppointment, rescheduleAppointment } from "@/server/appointments";
import { DomainError } from "@/server/errors";
import { endSession, getCurrentUser, safeReturnPath, startSession } from "@/server/session";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const ctx = () => ({ timeZone: env.CLINIC_TIMEZONE });

function failure(error: unknown): ActionResult {
  if (error instanceof DomainError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Something went wrong on our side. Please try again." };
}

function invalid(error: z.ZodError): ActionResult {
  return { ok: false, error: error.issues[0]?.message ?? "Please check your input." };
}

function revalidateScheduling() {
  revalidatePath("/", "layout");
}

const bookSchema = z.object({
  providerId: z.uuid(),
  startsAt: z.iso.datetime().transform((value) => new Date(value)),
  reason: z
    .string()
    .trim()
    .min(3, "Tell us briefly why you're coming in (at least 3 characters).")
    .max(200, "Keep the reason under 200 characters."),
});

export async function bookAction(input: z.input<typeof bookSchema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to book an appointment." };
  if (user.role !== "patient") return { ok: false, error: "Switch to a patient account to book a visit." };

  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const db = await getDb();
    await bookAppointment(db, { ...parsed.data, patientId: user.id }, ctx());
    revalidateScheduling();
    return { ok: true, message: "Appointment booked. See you then!" };
  } catch (error) {
    return failure(error);
  }
}

const cancelSchema = z.object({ appointmentId: z.uuid() });

export async function cancelAction(input: z.input<typeof cancelSchema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const db = await getDb();
    await cancelAppointment(db, { appointmentId: parsed.data.appointmentId, actor: user }, ctx());
    revalidateScheduling();
    return { ok: true, message: "Appointment cancelled." };
  } catch (error) {
    return failure(error);
  }
}

const rescheduleSchema = z.object({
  appointmentId: z.uuid(),
  startsAt: z.iso.datetime().transform((value) => new Date(value)),
});

export async function rescheduleAction(input: z.input<typeof rescheduleSchema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const db = await getDb();
    await rescheduleAppointment(db, { ...parsed.data, actor: user }, ctx());
    revalidateScheduling();
    return { ok: true, message: "Appointment rescheduled." };
  } catch (error) {
    return failure(error);
  }
}

export async function signInAction(formData: FormData) {
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) redirect("/sign-in");

  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId.data), columns: { id: true } });
  if (!user) redirect("/sign-in");

  await startSession(user.id);
  revalidateScheduling();
  redirect(safeReturnPath(formData.get("next")));
}

export async function signOutAction() {
  await endSession();
  revalidateScheduling();
  redirect("/");
}
