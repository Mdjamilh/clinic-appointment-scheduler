import type { LucideIcon } from "lucide-react";

type Props = { label: string; value: string; hint: string; icon: LucideIcon };

export function StatCard({ label, value, hint, icon: Icon }: Props) {
  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <Icon className="text-muted-foreground size-4" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </div>
  );
}
