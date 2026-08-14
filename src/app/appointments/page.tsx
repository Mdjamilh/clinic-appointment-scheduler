import { CalendarPlusIcon, CalendarXIcon, FileJsonIcon, HistoryIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentCard } from "@/components/appointment-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPatientAppointments } from "@/server/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "My visits" };

export default async function AppointmentsPage() {
  const user = await requireUser("/appointments");
  const { upcoming, past, cancelled } = await getPatientAppointments(user.id);

  const bookButton = (
    <Button asChild>
      <Link href="/providers">
        <CalendarPlusIcon /> Book a visit
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="My visits"
        description="Manage upcoming appointments and look back at past visits."
        actions={
          <>
            <Button variant="outline" asChild>
              {/* Plain <a>: this is a JSON API response, not a page to client-side navigate to. */}
              <a href="/api/fhir/Appointment" target="_blank" rel="noopener">
                <FileJsonIcon /> Export (FHIR)
              </a>
            </Button>
            {bookButton}
          </>
        }
      />

      <Tabs defaultValue="upcoming">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-3">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarPlusIcon}
              title="No upcoming visits"
              description="When you book an appointment it will show up here."
              action={bookButton}
            />
          ) : (
            upcoming.map((a) => <AppointmentCard key={a.id} appointment={a} variant="upcoming" />)
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-3">
          {past.length === 0 ? (
            <EmptyState
              icon={HistoryIcon}
              title="No past visits yet"
              description="Completed visits will appear here."
            />
          ) : (
            past.map((a) => <AppointmentCard key={a.id} appointment={a} variant="past" />)
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-3">
          {cancelled.length === 0 ? (
            <EmptyState
              icon={CalendarXIcon}
              title="Nothing cancelled"
              description="Appointments you cancel are kept here for your records."
            />
          ) : (
            cancelled.map((a) => <AppointmentCard key={a.id} appointment={a} variant="cancelled" />)
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
