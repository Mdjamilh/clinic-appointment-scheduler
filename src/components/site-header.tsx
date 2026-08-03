import { CalendarHeartIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { getCurrentUser } from "@/server/session";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const user = await getCurrentUser();

  const nav = [{ href: "/providers", label: "Find care" }];
  if (user?.role === "patient") nav.push({ href: "/appointments", label: "My visits" });
  if (user?.role === "admin") nav.push({ href: "/admin", label: "Clinic dashboard" });

  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <CalendarHeartIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">CareSlot</span>
        </Link>

        <NavLinks items={nav} />

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <UserMenu name={user.name} email={user.email} role={user.role} initials={initials(user.name)} />
          ) : (
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
