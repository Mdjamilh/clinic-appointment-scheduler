/**
 * Minimal FHIR R4 resource shapes and mappers for the data CareSlot owns.
 * Spec: https://hl7.org/fhir/R4/appointment.html, https://hl7.org/fhir/R4/practitioner.html
 */

import type { Appointment, Provider, User } from "@/db/schema";

type Reference = { reference: string; display?: string };
type CodeableConcept = { text: string };

export type FhirAppointment = {
  resourceType: "Appointment";
  id: string;
  meta: { lastUpdated: string };
  status: "booked" | "fulfilled" | "cancelled";
  serviceType: CodeableConcept[];
  description: string;
  start: string;
  end: string;
  minutesDuration: number;
  created: string;
  participant: { actor: Reference; required: "required"; status: "accepted" }[];
};

export type FhirPractitioner = {
  resourceType: "Practitioner";
  id: string;
  active: boolean;
  name: { text: string; prefix?: string[]; given: string[]; family: string; suffix: string[] }[];
  qualification: { code: CodeableConcept }[];
};

export type FhirBundle<T> = {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  link: { relation: "self"; url: string }[];
  entry: { fullUrl: string; resource: T; search: { mode: "match" } }[];
};

export type OperationOutcome = {
  resourceType: "OperationOutcome";
  issue: { severity: "error"; code: string; diagnostics: string }[];
};

/**
 * CareSlot only stores booked/cancelled; a booked visit whose start is in the
 * past is reported as `fulfilled`, matching what the patient UI shows.
 */
export function fhirAppointmentStatus(appointment: Pick<Appointment, "status" | "startsAt">, now = new Date()) {
  if (appointment.status === "cancelled") return "cancelled" as const;
  return appointment.startsAt <= now ? ("fulfilled" as const) : ("booked" as const);
}

export function toFhirAppointment(
  appointment: Appointment & { provider: Provider; patient: Pick<User, "id" | "name"> },
  now = new Date(),
): FhirAppointment {
  const minutes = Math.round((appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60_000);
  return {
    resourceType: "Appointment",
    id: appointment.id,
    meta: { lastUpdated: (appointment.cancelledAt ?? appointment.createdAt).toISOString() },
    status: fhirAppointmentStatus(appointment, now),
    serviceType: [{ text: appointment.provider.specialty }],
    description: appointment.reason,
    start: appointment.startsAt.toISOString(),
    end: appointment.endsAt.toISOString(),
    minutesDuration: minutes,
    created: appointment.createdAt.toISOString(),
    participant: [
      {
        actor: { reference: `Patient/${appointment.patient.id}`, display: appointment.patient.name },
        required: "required",
        status: "accepted",
      },
      {
        actor: { reference: `Practitioner/${appointment.provider.id}`, display: appointment.provider.name },
        required: "required",
        status: "accepted",
      },
    ],
  };
}

export function toFhirPractitioner(provider: Provider): FhirPractitioner {
  const hasPrefix = provider.name.startsWith("Dr. ");
  const parts = provider.name.replace(/^Dr\.\s+/, "").split(/\s+/);
  return {
    resourceType: "Practitioner",
    id: provider.id,
    active: true,
    name: [
      {
        text: `${provider.name}, ${provider.title}`,
        ...(hasPrefix && { prefix: ["Dr."] }),
        given: parts.slice(0, -1),
        family: parts.at(-1) ?? "",
        suffix: provider.title.split(/,\s*/),
      },
    ],
    qualification: [{ code: { text: provider.specialty } }],
  };
}

export function searchBundle<T extends { resourceType: string; id: string }>(
  resources: T[],
  selfUrl: string,
  baseUrl: string,
): FhirBundle<T> {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    link: [{ relation: "self", url: selfUrl }],
    entry: resources.map((resource) => ({
      fullUrl: `${baseUrl}/${resource.resourceType}/${resource.id}`,
      resource,
      search: { mode: "match" },
    })),
  };
}

export function operationOutcome(code: string, diagnostics: string): OperationOutcome {
  return { resourceType: "OperationOutcome", issue: [{ severity: "error", code, diagnostics }] };
}
