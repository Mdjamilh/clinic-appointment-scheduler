"use client";

import { CalendarCheckIcon, Loader2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { bookAction, rescheduleAction, type ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ScheduleDay, ScheduleSlot } from "@/server/queries";

type Mode = { type: "book" } | { type: "reschedule"; appointmentId: string; currentLabel: string };

type Props = {
  providerId: string;
  providerName: string;
  days: ScheduleDay[];
  timeZoneLabel: string;
  mode: Mode;
  viewer: "anonymous" | "patient" | "admin";
};

type Selection = { day: ScheduleDay; slot: ScheduleSlot };

const REASON_MAX = 200;

export function SlotPicker({ providerId, providerName, days, timeZoneLabel, mode, viewer }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const choose = (day: ScheduleDay, slot: ScheduleSlot) => {
    if (viewer === "anonymous") {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (viewer === "admin" && mode.type === "book") {
      toast.info("Switch to a patient account to book a visit.");
      return;
    }
    setSelected({ day, slot });
  };

  const submit = () => {
    if (!selected) return;
    startTransition(async () => {
      let result: ActionResult;
      if (mode.type === "book") {
        result = await bookAction({ providerId, startsAt: selected.slot.startsAt, reason });
      } else {
        result = await rescheduleAction({ appointmentId: mode.appointmentId, startsAt: selected.slot.startsAt });
      }

      if (result.ok) {
        toast.success(result.message);
        setSelected(null);
        setReason("");
        router.push(viewer === "admin" ? "/admin" : "/appointments");
      } else {
        toast.error(result.error);
        // The slot may have been taken in the meantime; show fresh availability.
        router.refresh();
      }
    });
  };

  const selectedLabel = selected
    ? `${selected.day.weekday}, ${selected.day.dayLabel} at ${selected.slot.label} ${timeZoneLabel}`
    : "";

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => {
          const open = day.slots.filter((slot) => slot.available).length;
          return (
            <section
              key={day.date}
              aria-label={`${day.weekday} ${day.dayLabel}`}
              className={cn(
                "bg-card flex flex-col rounded-xl border",
                day.isToday && "border-primary/50",
                // Past days add nothing on small screens, where columns stack vertically.
                day.isPast && "bg-muted/40 opacity-60 max-sm:hidden",
              )}
            >
              <header className="border-b px-3 py-2.5 text-center">
                <p
                  className={cn(
                    "text-xs font-medium uppercase",
                    day.isToday ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {day.isToday ? "Today" : day.weekday}
                </p>
                <p className="font-semibold">{day.dayLabel}</p>
                <p className="text-muted-foreground text-xs">
                  {day.isPast
                    ? "Past"
                    : day.slots.length === 0
                      ? "Closed"
                      : open === 0
                        ? "Fully booked"
                        : `${open} open`}
                </p>
              </header>
              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {day.isPast && <p className="text-muted-foreground py-6 text-center text-xs">No longer bookable</p>}
                {!day.isPast && day.slots.length === 0 && (
                  <p className="text-muted-foreground py-6 text-center text-xs">No clinic hours</p>
                )}
                {!day.isPast &&
                  day.slots.map((slot) => (
                    <Button
                      key={slot.startsAt}
                      size="sm"
                      variant="outline"
                      disabled={!slot.available}
                      onClick={() => choose(day, slot)}
                      aria-label={`${slot.available ? "Book" : "Unavailable:"} ${day.weekday} ${day.dayLabel} ${slot.label}`}
                      className={cn(
                        "w-full font-normal tabular-nums",
                        slot.available
                          ? "border-primary/30 text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground"
                          : "line-through disabled:opacity-40",
                      )}
                    >
                      {slot.label}
                    </Button>
                  ))}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && !isPending && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode.type === "book" ? "Confirm your visit" : "Confirm new time"}</DialogTitle>
            <DialogDescription>
              {mode.type === "book" ? (
                <>
                  With {providerName} on <strong className="text-foreground">{selectedLabel}</strong>.
                </>
              ) : (
                <>
                  Move your visit with {providerName} from {mode.currentLabel} to{" "}
                  <strong className="text-foreground">{selectedLabel}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {mode.type === "book" && (
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason for visit</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, REASON_MAX))}
                placeholder="e.g. Follow-up on blood pressure medication"
                rows={3}
                autoFocus
              />
              <p className="text-muted-foreground text-right text-xs tabular-nums">
                {reason.length}/{REASON_MAX}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={isPending}>
              Back
            </Button>
            <Button onClick={submit} disabled={isPending || (mode.type === "book" && reason.trim().length < 3)}>
              {isPending ? <Loader2Icon className="animate-spin" /> : <CalendarCheckIcon />}
              {mode.type === "book" ? "Book appointment" : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
