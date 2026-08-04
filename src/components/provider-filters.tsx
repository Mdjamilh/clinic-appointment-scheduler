"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

export function ProviderFilters({ specialties }: { specialties: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const specialty = params.get("specialty") ?? ALL;

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounce typing so we don't refetch on every keystroke.
  useEffect(() => {
    if (query === (params.get("q") ?? "")) return;
    const timeout = setTimeout(() => update("q", query.trim() || null), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasFilters = Boolean(params.get("q") || params.get("specialty"));

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row" data-pending={isPending || undefined}>
      <div className="relative flex-1">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or specialty"
          aria-label="Search providers"
          className="pl-9"
        />
      </div>
      <Select value={specialty} onValueChange={(value) => update("specialty", value === ALL ? null : value)}>
        <SelectTrigger className="w-full sm:w-56" aria-label="Filter by specialty">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All specialties</SelectItem>
          {specialties.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          onClick={() => {
            setQuery("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <XIcon /> Clear
        </Button>
      )}
    </div>
  );
}
