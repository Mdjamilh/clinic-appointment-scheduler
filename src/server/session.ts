import "server-only";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { getDb } from "@/db";
import { users, type User } from "@/db/schema";

/**
 * Demo authentication: visitors pick one of the seeded accounts and we keep
 * its id in an HTTP-only cookie. Every read re-validates the id against the
 * database, and all authorization happens server-side in actions/queries.
 * Swapping this module for Auth.js is the only change needed for real auth.
 */
const SESSION_COOKIE = "careslot_user";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const parsed = z.uuid().safeParse(store.get(SESSION_COOKIE)?.value);
  if (!parsed.success) return null;

  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, parsed.data) });
  return user ?? null;
});

export async function requireUser(returnTo: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function startSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Only allow same-site relative redirects after sign-in. */
export function safeReturnPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
