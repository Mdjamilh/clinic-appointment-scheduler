import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="mb-6 h-5 w-28" />
      <Skeleton className="mb-8 h-36 w-full rounded-2xl" />
      <Skeleton className="mb-4 h-10 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    </>
  );
}
