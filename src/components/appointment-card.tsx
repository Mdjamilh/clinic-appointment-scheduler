import { CalendarIcon, ClockIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Appointment, Provider } from "@/db/schema";
import { clinicTimeZoneLabel, formatInClinic, relativeDayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CancelAppointmentButton } from "./cancel-appointment-button";
import { ProviderAvatar } from "./provider-avatar";

type Variant = "upcoming" | "past" | "cancelled";

const STATUS: Record<Variant, { label: string; className: string }> = {
  upcoming: { label: "Confirmed", className: "bg-success/15 text-success" },
  past: { label: "Completed", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
};

type Props = { appointment: Appointment & { provider: Provider }; variant: Variant };

export function AppointmentCard({ appointment, variant }: Props) {
  const { provider } = appointment;
  const status = STATUS[variant];
  const when = `${formatInClinic(appointment.startsAt, "EEE, MMM d")} at ${formatInClinic(appointment.startsAt, "h:mm a")}`;

  return (
    <article
      className={cn(
        "bg-card flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center",
        variant === "cancelled" && "opacity-75",
      )}
    >
      <div className="flex w-full items-center gap-4 sm:w-auto">
        <div className="bg-background flex w-16 shrink-0 flex-col items-center rounded-lg border py-2 text-center">
          <span className="text-primary text-xs font-medium uppercase">
            {formatInClinic(appointment.startsAt, "MMM")}
          </span>
          <span className="text-2xl leading-none font-semibold tabular-nums">
            {formatInClinic(appointment.startsAt, "d")}
          </span>
          <span className="text-muted-foreground text-xs">{formatInClinic(appointment.startsAt, "EEE")}</span>
        </div>
        <ProviderAvatar name={provider.name} className="size-10 sm:hidden" />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/providers/${provider.slug}`} className="font-semibold hover:underline">
            {provider.name}
          </Link>
          <span className="text-muted-foreground text-sm">{provider.specialty}</span>
          <Badge className={status.className}>{status.label}</Badge>
        </div>
        <p className="text-sm">{appointment.reason}</p>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-3.5" />
            {variant === "upcoming"
              ? relativeDayLabel(appointment.startsAt)
              : formatInClinic(appointment.startsAt, "MMM d, yyyy")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" />
            {formatInClinic(appointment.startsAt, "h:mm a")} – {formatInClinic(appointment.endsAt, "h:mm a")}{" "}
            {clinicTimeZoneLabel(appointment.startsAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon className="size-3.5" /> {provider.location}
          </span>
        </div>
      </div>

      {variant === "upcoming" && (
        <div className="flex gap-2 sm:flex-col sm:items-stretch">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/providers/${provider.slug}?reschedule=${appointment.id}`}>Reschedule</Link>
          </Button>
          <CancelAppointmentButton appointmentId={appointment.id} summary={`${provider.name} on ${when}`} />
        </div>
      )}
      {variant === "past" && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/providers/${provider.slug}`}>Book again</Link>
        </Button>
      )}
    </article>
  );
}
