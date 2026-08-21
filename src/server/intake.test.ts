import { describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "./rate-limit";
import { detectRedFlag, keywordSuggestion, suggestSpecialty, type ModelClassifier } from "./intake";

const SPECIALTIES = [
  "Behavioral Health",
  "Cardiology",
  "Dermatology",
  "Family Medicine",
  "Pediatrics",
  "Physical Therapy",
];

describe("detectRedFlag", () => {
  it.each([
    "I have crushing chest pain and my left arm hurts",
    "I can't breathe properly since this morning",
    "my face droop started an hour ago",
    "I've been thinking about ending it, I want to kill myself",
    "sudden worst headache of my life",
  ])("flags %s", (text) => {
    expect(detectRedFlag(text)).toBe(true);
  });

  it("leaves routine complaints alone", () => {
    expect(detectRedFlag("itchy rash on my arm for a week")).toBe(false);
  });
});

describe("keywordSuggestion", () => {
  it.each([
    ["Itchy rash on my forearm", "Dermatology"],
    ["My heart races and I get palpitations", "Cardiology"],
    ["My daughter needs her vaccines", "Pediatrics"],
    ["Feeling anxious and having trouble sleeping", "Behavioral Health"],
    ["Knee pain after running", "Physical Therapy"],
  ])("routes %s to %s", (text, specialty) => {
    expect(keywordSuggestion(text, SPECIALTIES).specialty).toBe(specialty);
  });

  it("falls back to Family Medicine when nothing matches", () => {
    expect(keywordSuggestion("I just don't feel great lately", SPECIALTIES).specialty).toBe("Family Medicine");
  });
});

describe("suggestSpecialty", () => {
  it("never calls the model for red-flag descriptions", async () => {
    const classify = vi.fn<ModelClassifier>();
    const result = await suggestSpecialty("sudden chest pain and shortness of breath", SPECIALTIES, classify);
    expect(result).toMatchObject({ urgency: "emergency", source: "safety-rules" });
    expect(classify).not.toHaveBeenCalled();
  });

  it("uses the model's answer when it names a known specialty", async () => {
    const classify: ModelClassifier = async () => ({
      specialty: "Dermatology",
      rationale: "Skin changes are best checked by dermatology.",
      urgency: "soon",
    });
    const result = await suggestSpecialty("a mole that changed colour", SPECIALTIES, classify);
    expect(result).toMatchObject({ specialty: "Dermatology", urgency: "soon", source: "ai" });
  });

  it("escalates when the model judges it an emergency", async () => {
    const classify: ModelClassifier = async () => ({ specialty: "Cardiology", rationale: "", urgency: "emergency" });
    expect((await suggestSpecialty("feeling very odd", SPECIALTIES, classify)).urgency).toBe("emergency");
  });

  it("falls back to keyword rules when the model fails, refuses or invents a specialty", async () => {
    const failing: ModelClassifier = async () => {
      throw new Error("network down");
    };
    const refusing: ModelClassifier = async () => null;
    const inventing: ModelClassifier = async () => ({ specialty: "Oncology", rationale: "", urgency: "routine" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    for (const classify of [failing, refusing, inventing]) {
      const result = await suggestSpecialty("itchy rash on my arm", SPECIALTIES, classify);
      expect(result).toMatchObject({ specialty: "Dermatology", source: "keyword-rules" });
    }
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then resets", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(check("ip", 0).allowed).toBe(true);
    expect(check("ip", 10).allowed).toBe(true);
    expect(check("ip", 20)).toEqual({ allowed: false, retryAfterMs: 980 });
    expect(check("other-ip", 20).allowed).toBe(true);
    expect(check("ip", 1000).allowed).toBe(true);
  });
});
