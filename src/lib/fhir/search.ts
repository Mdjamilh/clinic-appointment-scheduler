import { z } from "zod";

/**
 * FHIR date search parameter with an optional comparison prefix, e.g.
 * `date=ge2026-10-01` or `date=lt2026-11-01T00:00:00Z`.
 * https://hl7.org/fhir/R4/search.html#date
 */
export type DateFilter = { op: "eq" | "ge" | "gt" | "le" | "lt"; value: Date; dayPrecision: boolean };

const PREFIXES = ["eq", "ge", "gt", "le", "lt"] as const;

export function parseDateParam(raw: string): DateFilter | null {
  const prefix = PREFIXES.find((p) => raw.startsWith(p));
  const value = prefix ? raw.slice(2) : raw;
  const dayPrecision = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!dayPrecision && !z.iso.datetime({ offset: true }).safeParse(value).success) return null;

  const date = new Date(dayPrecision ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return { op: prefix ?? "eq", value: date, dayPrecision };
}

const statusSchema = z.enum(["booked", "fulfilled", "cancelled"]);

export const appointmentSearchSchema = z
  .object({
    patient: z.uuid({ error: "patient must be a Patient id" }).optional(),
    practitioner: z.uuid({ error: "practitioner must be a Practitioner id" }).optional(),
    status: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.array(statusSchema, { error: "status must be booked, fulfilled or cancelled" }))
      .optional(),
    date: z
      .array(z.string())
      .transform((values, ctx) => {
        const parsed = values.map(parseDateParam);
        if (parsed.some((d) => d === null)) {
          ctx.addIssue({ code: "custom", message: "date must look like ge2026-10-01 or an ISO 8601 timestamp" });
          return z.NEVER;
        }
        return parsed as DateFilter[];
      })
      .optional(),
    _count: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export type AppointmentSearch = z.output<typeof appointmentSearchSchema>;

const SUPPORTED = new Set(["patient", "practitioner", "status", "date", "_count"]);

/** Collects query params, keeping `date` repeatable as FHIR allows (`date=ge..&date=lt..`). */
export function readSearchParams(params: URLSearchParams) {
  const unsupported = [...new Set(params.keys())].filter((key) => !SUPPORTED.has(key));
  const raw: Record<string, unknown> = {};
  for (const key of SUPPORTED) {
    const values = params.getAll(key);
    if (values.length === 0) continue;
    raw[key] = key === "date" ? values : values[0];
  }
  return { raw, unsupported };
}
