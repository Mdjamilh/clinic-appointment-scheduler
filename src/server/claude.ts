import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import type { ModelClassifier } from "./intake";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const SYSTEM_PROMPT = `You help patients of a small outpatient clinic decide which department to book.
You are not diagnosing anyone. Pick the single best-fit specialty from the list you are given,
explain the choice in one plain-language sentence addressed to the patient, and rate urgency:
"emergency" if the description suggests something that needs an emergency room today,
"soon" if they should be seen within a few days, otherwise "routine".
If nothing fits clearly, choose Family Medicine when it is available.`;

let client: Anthropic | undefined;

/** Returns a Claude-backed classifier, or undefined when no API key is configured. */
export function getClaudeClassifier(): ModelClassifier | undefined {
  if (!process.env.ANTHROPIC_API_KEY) return undefined;
  client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });

  return async (description, specialties) => {
    const schema = z.object({
      specialty: z.enum(specialties),
      rationale: z.string(),
      urgency: z.enum(["routine", "soon", "emergency"]),
    });

    const response = await client!.beta.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      // Short routing decision: low effort keeps it fast and cheap.
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      // If a safety classifier declines, retry server-side on Anthropic's recommended fallback.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Available specialties: ${specialties.join(", ")}\n\nPatient's description:\n${description}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
    return response.parsed_output ?? null;
  };
}
