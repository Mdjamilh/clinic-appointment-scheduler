import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url().optional(),
  CLINIC_TIMEZONE: z.string().default("America/New_York"),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL || undefined,
  CLINIC_TIMEZONE: process.env.CLINIC_TIMEZONE || undefined,
});
