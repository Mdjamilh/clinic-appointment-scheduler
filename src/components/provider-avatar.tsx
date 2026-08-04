import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProviderAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn("size-12", className)}>
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
