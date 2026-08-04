import { ClockIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatInClinic, relativeDayLabel } from "@/lib/format";
import type { ProviderSummary } from "@/server/queries";
import { ProviderAvatar } from "./provider-avatar";

export function ProviderCard({ provider }: { provider: ProviderSummary }) {
  return (
    <Card className="focus-within:ring-ring/50 relative gap-4 transition-shadow focus-within:ring-2 hover:shadow-md">
      <CardHeader className="flex flex-row items-start gap-4">
        <ProviderAvatar name={provider.name} />
        <div className="min-w-0 space-y-1">
          <h3 className="leading-tight font-semibold">
            <Link href={`/providers/${provider.slug}`} className="after:absolute after:inset-0">
              {provider.name}
              <span className="text-muted-foreground font-normal">, {provider.title}</span>
            </Link>
          </h3>
          <Badge variant="secondary">{provider.specialty}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        <p className="text-muted-foreground line-clamp-2">{provider.bio}</p>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon className="size-3.5" /> {provider.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" /> {provider.slotMinutes} min visits
          </span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3 border-t pt-4">
        <div className="text-sm">
          <p className="text-muted-foreground text-xs">Next available</p>
          <p className="font-medium">
            {provider.nextAvailable
              ? `${relativeDayLabel(provider.nextAvailable)} · ${formatInClinic(provider.nextAvailable, "h:mm a")}`
              : "No openings in 3 weeks"}
          </p>
        </div>
        <Button size="sm" variant="outline" className="relative z-10" asChild>
          <Link href={`/providers/${provider.slug}`}>View times</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
