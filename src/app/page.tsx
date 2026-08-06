import { ArrowRightIcon, CalendarCheckIcon, CalendarClockIcon, SearchIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";

import { ProviderAvatar } from "@/components/provider-avatar";
import { ProviderCard } from "@/components/provider-card";
import { Button } from "@/components/ui/button";
import { clinicTimeZoneLabel, formatInClinic, relativeDayLabel } from "@/lib/format";
import { getNextAppointment, listProviders } from "@/server/queries";
import { getCurrentUser } from "@/server/session";

const STEPS = [
  {
    icon: SearchIcon,
    title: "Find the right clinician",
    body: "Search by name or specialty and compare who can see you soonest.",
  },
  {
    icon: CalendarClockIcon,
    title: "Pick a real open slot",
    body: "Availability comes straight from provider schedules and updates the moment a slot is taken.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Manage it in one place",
    body: "Reschedule or cancel in a click. Your old slot is held until the new one is confirmed.",
  },
];

export default async function HomePage() {
  const [user, providers] = await Promise.all([getCurrentUser(), listProviders()]);
  const nextVisit = user?.role === "patient" ? await getNextAppointment(user.id) : null;

  const soonest = [...providers]
    .filter((p) => p.nextAvailable)
    .sort((a, b) => a.nextAvailable!.getTime() - b.nextAvailable!.getTime())
    .slice(0, 3);
  const specialties = [...new Set(providers.map((p) => p.specialty))];

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="bg-card text-muted-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <span className="bg-success size-1.5 rounded-full" /> Live availability across {providers.length} providers
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {user ? `Welcome back, ${user.name.split(" ")[0]}.` : "Book a clinic visit in under a minute."}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-lg">
            See every provider&apos;s real openings, book the time that suits you, and reschedule without phone calls.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/providers">
                Find a provider <ArrowRightIcon />
              </Link>
            </Button>
            {user?.role === "patient" && (
              <Button size="lg" variant="outline" asChild>
                <Link href="/appointments">My visits</Link>
              </Button>
            )}
            {user?.role === "admin" && (
              <Button size="lg" variant="outline" asChild>
                <Link href="/admin">Clinic dashboard</Link>
              </Button>
            )}
            {!user && (
              <Button size="lg" variant="outline" asChild>
                <Link href="/sign-in">Try a demo account</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-6 shadow-sm">
          {nextVisit ? (
            <>
              <p className="text-muted-foreground text-sm font-medium">Your next visit</p>
              <div className="mt-4 flex items-center gap-4">
                <ProviderAvatar name={nextVisit.provider.name} />
                <div>
                  <p className="font-semibold">{nextVisit.provider.name}</p>
                  <p className="text-muted-foreground text-sm">{nextVisit.provider.specialty}</p>
                </div>
              </div>
              <div className="bg-primary/5 mt-5 rounded-xl p-4">
                <p className="text-2xl font-semibold tracking-tight">{relativeDayLabel(nextVisit.startsAt)}</p>
                <p className="text-muted-foreground">
                  {formatInClinic(nextVisit.startsAt, "h:mm a")} {clinicTimeZoneLabel(nextVisit.startsAt)} ·{" "}
                  {nextVisit.provider.location}
                </p>
              </div>
              <p className="mt-4 text-sm">
                <span className="text-muted-foreground">Reason:</span> {nextVisit.reason}
              </p>
              <Button variant="outline" className="mt-5 w-full" asChild>
                <Link href="/appointments">Manage appointment</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm font-medium">Soonest openings</p>
              <ul className="mt-4 divide-y">
                {soonest.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/providers/${p.slug}`}
                      className="hover:bg-accent -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors"
                    >
                      <ProviderAvatar name={p.name} className="size-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-muted-foreground text-sm">{p.specialty}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">{relativeDayLabel(p.nextAvailable!)}</p>
                        <p className="text-muted-foreground tabular-nums">
                          {formatInClinic(p.nextAvailable!, "h:mm a")}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="sr-only">
          How it works
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="bg-card rounded-xl border p-6">
              <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                <step.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="specialties-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="specialties-heading" className="text-xl font-semibold tracking-tight">
              Our providers
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {specialties.map((s) => (
                <Link
                  key={s}
                  href={`/providers?specialty=${encodeURIComponent(s)}`}
                  className="bg-card hover:border-primary/50 hover:text-primary rounded-full border px-3 py-1 text-sm transition-colors"
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/providers">
              View all <ArrowRightIcon />
            </Link>
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {providers.slice(0, 3).map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      </section>

      <section className="bg-primary/5 flex flex-col items-center gap-4 rounded-2xl border px-6 py-10 text-center">
        <CalendarCheckIcon className="text-primary size-8" />
        <h2 className="text-xl font-semibold tracking-tight">Ready when you are</h2>
        <p className="text-muted-foreground max-w-md">Most patients find a slot within the next two days.</p>
        <Button asChild>
          <Link href="/providers">Book a visit</Link>
        </Button>
      </section>
    </div>
  );
}
