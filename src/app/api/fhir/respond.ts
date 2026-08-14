import "server-only";

import { NextResponse } from "next/server";

import { operationOutcome } from "@/lib/fhir/resources";
import { DomainError } from "@/server/errors";

const FHIR_JSON = "application/fhir+json; charset=utf-8";

export function fhirJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": FHIR_JSON, "Cache-Control": "private, no-store" },
  });
}

export function fhirError(status: number, code: string, diagnostics: string) {
  return fhirJson(operationOutcome(code, diagnostics), status);
}

export const unauthenticated = () =>
  fhirError(401, "login", "Sign in to CareSlot first; the API uses the same session cookie as the app.");

export function fhirDomainError(error: unknown) {
  if (error instanceof DomainError) {
    if (error.code === "NOT_FOUND") return fhirError(404, "not-found", error.message);
    if (error.code === "FORBIDDEN") return fhirError(403, "forbidden", error.message);
  }
  console.error(error);
  return fhirError(500, "exception", "Unexpected server error.");
}

export const fhirBase = (request: Request) => `${new URL(request.url).origin}/api/fhir`;
