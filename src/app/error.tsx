"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon={TriangleAlertIcon}
        title="Something went wrong"
        description="We couldn't load this page. It's probably temporary, so please try again."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
