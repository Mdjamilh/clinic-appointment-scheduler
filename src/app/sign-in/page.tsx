import { ArrowRightIcon, ShieldCheckIcon, UserIcon } from "lucide-react";
import type { Metadata } from "next";

import { signInAction } from "@/app/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listDemoAccounts } from "@/server/queries";
import { getCurrentUser, safeReturnPath } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const [accounts, current] = await Promise.all([listDemoAccounts(), getCurrentUser()]);

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a demo account</h1>
        <p className="text-muted-foreground mt-2">
          No password needed. Patients can book and manage visits; the admin sees the whole clinic.
        </p>
      </div>

      <ul className="space-y-3">
        {accounts.map((account) => {
          const isAdmin = account.role === "admin";
          const isCurrent = current?.id === account.id;
          return (
            <li key={account.id}>
              <form action={signInAction}>
                <input type="hidden" name="userId" value={account.id} />
                <input
                  type="hidden"
                  name="next"
                  value={safeReturnPath(next ?? (isAdmin ? "/admin" : "/appointments"))}
                />
                <button
                  type="submit"
                  className={cn(
                    "group bg-card hover:border-primary/50 hover:bg-accent focus-visible:ring-ring/50 flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-[3px]",
                    isCurrent && "border-primary/50",
                  )}
                >
                  <Avatar className="size-11">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {initials(account.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {account.name}
                      {isCurrent && <span className="text-primary ml-2 text-xs font-normal">Signed in</span>}
                    </p>
                    <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                      {isAdmin ? <ShieldCheckIcon className="size-3.5" /> : <UserIcon className="size-3.5" />}
                      {isAdmin ? "Clinic admin" : "Patient"} · {account.email}
                    </p>
                  </div>
                  <ArrowRightIcon className="text-muted-foreground group-hover:text-primary size-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground mt-6 text-center text-xs">
        Demo sign-in stores your choice in an HTTP-only cookie. Production would use a real identity provider.
      </p>
    </div>
  );
}
