"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getClaudeClassifier } from "@/server/claude";
import { suggestSpecialty, type IntakeSuggestion } from "@/server/intake";
import { listSpecialties } from "@/server/queries";
import { createRateLimiter } from "@/server/rate-limit";

export type IntakeResult = { ok: true; suggestion: IntakeSuggestion } | { ok: false; error: string };

const limiter = createRateLimiter({ limit: 8, windowMs: 60_000 });

const schema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Add a little more detail (at least 10 characters).")
    .max(500, "Please keep it under 500 characters."),
});

export async function suggestSpecialtyAction(input: z.input<typeof schema>): Promise<IntakeResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  const { allowed, retryAfterMs } = limiter(ip);
  if (!allowed) {
    return { ok: false, error: `Too many requests. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.` };
  }

  // The description is health information: it's sent to the model but never logged or stored.
  const suggestion = await suggestSpecialty(parsed.data.description, await listSpecialties(), getClaudeClassifier());
  return { ok: true, suggestion };
}
