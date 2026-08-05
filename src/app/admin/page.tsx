import { ActivityIcon, CalendarDaysIcon, CalendarXIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CancelAppointmentButton } from "@/components/cancel-appointment-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clinicTimeZoneLabel, formatInClinic, relativeDayLabel } from "@/lib/format";
import { getAdminOverview } from "@/server/queries";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Clinic dashboard" };

const percent = (value: number) => `${Math.round(value * 100)}%`;

export default async function AdminPage() {
  await requireAdmin();
  const { stats, utilization, upcoming } = await getAdminOverview();

  return (
    <>
      <PageHeader
        title="Clinic dashboard"
        description={`Today at a glance · ${formatInClinic(new Date(), "EEEE, MMMM d")} · times in ${clinicTimeZoneLabel()}`}
      />

      <section aria-label="Key metrics" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Booked today"
          value={String(stats.bookedToday)}
          hint={`${percent(stats.utilizationToday)} of today's capacity`}
          icon={ActivityIcon}
        />
        <StatCard
          label="Next 7 days"
          value={String(stats.bookedNext7Days)}
          hint="Confirmed appointments"
          icon={CalendarDaysIcon}
        />
        <StatCard
          label="Cancellation rate"
          value={percent(stats.cancellationRate30d)}
          hint="Bookings made in the last 30 days"
          icon={CalendarXIcon}
        />
        <StatCard label="Patients" value={String(stats.patients)} hint="Registered patient accounts" icon={UsersIcon} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="bg-card rounded-xl border p-5 lg:col-span-1" aria-labelledby="utilization-heading">
          <h2 id="utilization-heading" className="font-semibold">
            Today by provider
          </h2>
          <p className="text-muted-foreground mb-5 text-sm">Booked slots vs. capacity</p>
          <ul className="space-y-4">
            {utilization.map(({ provider, booked, capacity }) => {
              const ratio = capacity ? booked / capacity : 0;
              return (
                <li key={provider.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <Link href={`/providers/${provider.slug}`} className="truncate font-medium hover:underline">
                      {provider.name}
                    </Link>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {capacity ? `${booked}/${capacity}` : "Off today"}
                    </span>
                  </div>
                  <div
                    className="bg-muted h-2 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-label={`${provider.name} utilization`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(ratio * 100)}
                  >
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: percent(ratio) }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="bg-card rounded-xl border lg:col-span-2" aria-labelledby="upcoming-heading">
          <div className="p-5 pb-3">
            <h2 id="upcoming-heading" className="font-semibold">
              Upcoming appointments
            </h2>
            <p className="text-muted-foreground text-sm">Next 7 days across all providers</p>
          </div>
          {upcoming.length === 0 ? (
            <div className="p-5 pt-0">
              <EmptyState icon={CalendarDaysIcon} title="Quiet week" description="No upcoming appointments yet." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">When</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Provider</TableHead>
                  <TableHead className="hidden xl:table-cell">Reason</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="pl-5">
                      <p className="font-medium">{relativeDayLabel(a.startsAt)}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {formatInClinic(a.startsAt, "h:mm a")}
                      </p>
                    </TableCell>
                    <TableCell>{a.patient.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p>{a.provider.name}</p>
                      <p className="text-muted-foreground text-xs">{a.provider.specialty}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden max-w-48 truncate xl:table-cell">
                      {a.reason}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <CancelAppointmentButton
                        appointmentId={a.id}
                        summary={`${a.patient.name} with ${a.provider.name}, ${relativeDayLabel(a.startsAt)} at ${formatInClinic(a.startsAt, "h:mm a")}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
