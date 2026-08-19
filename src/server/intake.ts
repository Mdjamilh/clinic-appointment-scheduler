/**
 * "Not sure who to see?" intake helper.
 *
 * Order of checks, from most to least conservative:
 *   1. Red-flag phrases → emergency advice, without calling any model.
 *   2. Claude (when ANTHROPIC_API_KEY is set) picks the best-fit specialty.
 *   3. Keyword rules, used when there's no key or the model call fails.
 *
 * This routes patients to a department; it never diagnoses.
 */

export type Urgency = "routine" | "soon" | "emergency";

export type IntakeSuggestion = {
  specialty: string | null;
  rationale: string;
  urgency: Urgency;
  source: "safety-rules" | "ai" | "keyword-rules";
};

export type ModelClassifier = (
  description: string,
  specialties: [string, ...string[]],
) => Promise<{ specialty: string; rationale: string; urgency: Urgency } | null>;

const RED_FLAGS: RegExp[] = [
  /chest (pain|pressure|tightness)/i,
  /(can'?t|cannot|trouble|difficulty|hard to) breath/i,
  /short(ness)? of breath/i,
  /(face|arm|smile) (droop|numb|weak)/i,
  /slurred speech/i,
  /(suicid|kill myself|end my life|self[- ]harm)/i,
  /(severe|heavy|uncontrolled) bleeding/i,
  /(passed out|fainted|unconscious|seizure)/i,
  /(worst|sudden|thunderclap) headache/i,
  /(anaphyla|throat (is )?(closing|swelling))/i,
];

export function detectRedFlag(description: string): boolean {
  return RED_FLAGS.some((pattern) => pattern.test(description));
}

const KEYWORDS: Record<string, RegExp> = {
  Cardiology: /\b(heart|palpitation|blood pressure|hypertension|cholesterol|irregular (heart)?beat|stent)\b/i,
  Dermatology: /\b(skin|rash|mole|acne|eczema|psoriasis|itch(y|ing)?|hives|wart)\b/i,
  Pediatrics: /\b(my (son|daughter|baby|child|kid|toddler)|newborn|infant|vaccin\w*|well[- ]child)\b/i,
  "Behavioral Health":
    /\b(anxi\w*|depress\w*|stress\w*|panic|insomnia|can'?t sleep|trouble sleeping|mood|therapy|grief)\b/i,
  "Physical Therapy": /\b(knee|back pain|shoulder|ankle|sprain|hip|mobility|rehab\w*|sports injury|after surgery)\b/i,
};

export function keywordSuggestion(description: string, specialties: string[]): IntakeSuggestion {
  const match = Object.entries(KEYWORDS).find(
    ([specialty, pattern]) => specialties.includes(specialty) && pattern.test(description),
  );
  if (match) {
    return {
      specialty: match[0],
      rationale: `Your description mentions things ${match[0]} commonly treats.`,
      urgency: "routine",
      source: "keyword-rules",
    };
  }
  const fallback = specialties.includes("Family Medicine") ? "Family Medicine" : null;
  return {
    specialty: fallback,
    rationale: "Family Medicine is a good first stop for most concerns and can refer you on if needed.",
    urgency: "routine",
    source: "keyword-rules",
  };
}

export const EMERGENCY_SUGGESTION: IntakeSuggestion = {
  specialty: null,
  rationale:
    "Some of what you described can be a sign of a medical emergency. Call 911 or go to the nearest emergency room now. Don't wait for an appointment.",
  urgency: "emergency",
  source: "safety-rules",
};

export async function suggestSpecialty(
  description: string,
  specialties: string[],
  classify?: ModelClassifier,
): Promise<IntakeSuggestion> {
  if (detectRedFlag(description)) return EMERGENCY_SUGGESTION;
  if (!classify || specialties.length === 0) return keywordSuggestion(description, specialties);

  try {
    const result = await classify(description, specialties as [string, ...string[]]);
    if (!result || !specialties.includes(result.specialty)) return keywordSuggestion(description, specialties);
    // The model can escalate to an emergency even when no keyword matched.
    if (result.urgency === "emergency") return EMERGENCY_SUGGESTION;
    return { ...result, source: "ai" };
  } catch (error) {
    console.error("Intake classifier failed; using keyword rules", error);
    return keywordSuggestion(description, specialties);
  }
}
