import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="mb-3 h-9 w-40" />
      <Skeleton className="mb-8 h-5 w-80 max-w-full" />
      <Skeleton className="mb-4 h-9 w-80" />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </>
  );
}
