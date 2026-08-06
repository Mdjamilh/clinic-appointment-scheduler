import { CompassIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon={CompassIcon}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Button asChild>
            <Link href="/providers">Browse providers</Link>
          </Button>
        }
      />
    </div>
  );
}
