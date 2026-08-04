import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, InfoIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProviderAvatar } from "@/components/provider-avatar";
import { SlotPicker } from "@/components/slot-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clinicTimeZoneLabel, formatInClinic } from "@/lib/format";
import { getProviderBySlug, getProviderWeek, getReschedulableAppointment, resolveWeek } from "@/server/queries";
import { getCurrentUser } from "@/server/session";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string; reschedule?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const provider = await getProviderBySlug((await params).slug);
  return { title: provider ? `${provider.name} · ${provider.specialty}` : "Provider not found" };
}

export default async function ProviderPage({ params, searchParams }: Props) {
  const [{ slug }, { week, reschedule }] = await Promise.all([params, searchParams]);
  const [provider, user] = await Promise.all([getProviderBySlug(slug), getCurrentUser()]);
  if (!provider) notFound();

  const range = resolveWeek(week);
  const days = await getProviderWeek(provider, range.start);

  const rescheduling =
    reschedule && user ? await getReschedulableAppointment(reschedule, user).catch(() => null) : null;
  const validReschedule = rescheduling?.providerId === provider.id ? rescheduling : null;
  const currentLabel = validReschedule ? `${formatInClinic(validReschedule.startsAt, "EEE, MMM d 'at' h:mm a")}` : "";

  const weekHref = (key: string) => {
    const query = new URLSearchParams({ week: key });
    if (validReschedule) query.set("reschedule", validReschedule.id);
    return `/providers/${provider.slug}?${query.toString()}`;
  };

  return (
    <>
      <Link
        href="/providers"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" /> All providers
      </Link>

      <section className="bg-card mb-8 flex flex-col gap-5 rounded-2xl border p-6 sm:flex-row sm:items-center">
        <ProviderAvatar name={provider.name} className="size-16 text-lg" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {provider.name}
              <span className="text-muted-foreground font-normal">, {provider.title}</span>
            </h1>
            <Badge variant="secondary">{provider.specialty}</Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">{provider.bio}</p>
          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="size-4" /> {provider.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="size-4" /> {provider.slotMinutes}-minute visits
            </span>
          </div>
        </div>
      </section>

      {validReschedule && (
        <div className="border-primary/30 bg-primary/5 mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm">
          <InfoIcon className="text-primary mt-0.5 size-4 shrink-0" />
          <p>
            You&apos;re rescheduling your visit on <strong>{currentLabel}</strong>. Pick a new time below — your current
            slot is kept until the new one is confirmed.
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Available times</h2>
          <p className="text-muted-foreground text-sm">
            {range.label} · times shown in {clinicTimeZoneLabel()}
          </p>
        </div>
        <div className="flex gap-2">
          {range.prevKey ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={weekHref(range.prevKey)} scroll={false}>
                <ChevronLeftIcon /> Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeftIcon /> Previous
            </Button>
          )}
          {range.nextKey ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={weekHref(range.nextKey)} scroll={false}>
                Next <ChevronRightIcon />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next <ChevronRightIcon />
            </Button>
          )}
        </div>
      </div>

      <SlotPicker
        providerId={provider.id}
        providerName={provider.name}
        days={days}
        timeZoneLabel={clinicTimeZoneLabel()}
        viewer={user ? user.role : "anonymous"}
        mode={
          validReschedule ? { type: "reschedule", appointmentId: validReschedule.id, currentLabel } : { type: "book" }
        }
      />
    </>
  );
}
