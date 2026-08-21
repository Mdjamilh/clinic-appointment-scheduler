import { SearchXIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { IntakeAssistant } from "@/components/intake-assistant";
import { PageHeader } from "@/components/page-header";
import { ProviderCard } from "@/components/provider-card";
import { ProviderFilters } from "@/components/provider-filters";
import { listProviders, listSpecialties } from "@/server/queries";

export const metadata: Metadata = { title: "Find care" };

type Props = { searchParams: Promise<{ q?: string; specialty?: string }> };

export default async function ProvidersPage({ searchParams }: Props) {
  const { q, specialty } = await searchParams;
  const [providers, specialties] = await Promise.all([listProviders({ q, specialty }), listSpecialties()]);

  return (
    <>
      <PageHeader
        title="Find care"
        description="Browse our clinicians, compare availability and pick a time that works for you."
      />
      <IntakeAssistant />
      <ProviderFilters specialties={specialties} />
      {providers.length === 0 ? (
        <EmptyState
          icon={SearchXIcon}
          title="No providers match"
          description="Try a different name or specialty, or clear the filters to see everyone."
        />
      ) : (
        <>
          <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
            {providers.length} {providers.length === 1 ? "provider" : "providers"}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
