"use client";

import { ArrowRightIcon, Loader2Icon, SirenIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { suggestSpecialtyAction } from "@/app/intake-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeSuggestion } from "@/server/intake";

const MAX = 500;

const SOURCE_LABEL: Record<IntakeSuggestion["source"], string> = {
  ai: "AI-assisted suggestion",
  "keyword-rules": "Rule-based suggestion",
  "safety-rules": "Safety check",
};

export function IntakeAssistant() {
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<IntakeSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await suggestSpecialtyAction({ description });
      if (result.ok) setSuggestion(result.suggestion);
      else setError(result.error);
    });
  };

  return (
    <section aria-labelledby="intake-heading" className="bg-card mb-8 rounded-2xl border p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <SparklesIcon className="size-4" />
        </span>
        <div>
          <h2 id="intake-heading" className="font-semibold">
            Not sure who to see?
          </h2>
          <p className="text-muted-foreground text-sm">
            Describe what&apos;s going on and we&apos;ll point you to the right specialty. This isn&apos;t a diagnosis.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-3">
        <Label htmlFor="intake-description" className="sr-only">
          Describe your symptoms or reason for visit
        </Label>
        <Textarea
          id="intake-description"
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, MAX))}
          placeholder="e.g. My knee has been sore for two weeks since I started running"
          rows={3}
          aria-describedby="intake-privacy"
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p id="intake-privacy" className="text-muted-foreground text-xs">
            Don&apos;t include names or other personal details. {description.length}/{MAX}
          </p>
          <Button type="submit" disabled={isPending || description.trim().length < 10}>
            {isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            Suggest a specialty
          </Button>
        </div>
      </form>

      <div aria-live="polite">
        {error && <p className="text-destructive mt-4 text-sm">{error}</p>}

        {suggestion?.urgency === "emergency" && (
          <div role="alert" className="border-destructive/40 bg-destructive/10 mt-5 flex gap-3 rounded-xl border p-4">
            <SirenIcon className="text-destructive mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-destructive font-semibold">This may be an emergency</p>
              <p className="mt-1 text-sm">{suggestion.rationale}</p>
            </div>
          </div>
        )}

        {suggestion && suggestion.urgency !== "emergency" && suggestion.specialty && (
          <div className="border-primary/30 bg-primary/5 mt-5 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">We suggest</span>
                <Badge>{suggestion.specialty}</Badge>
                {suggestion.urgency === "soon" && (
                  <Badge variant="outline" className="border-warning text-warning">
                    Book within a few days
                  </Badge>
                )}
              </div>
              <p className="text-sm">{suggestion.rationale}</p>
              <p className="text-muted-foreground text-xs">{SOURCE_LABEL[suggestion.source]}</p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/providers?specialty=${encodeURIComponent(suggestion.specialty)}`} scroll={false}>
                See {suggestion.specialty} providers <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
