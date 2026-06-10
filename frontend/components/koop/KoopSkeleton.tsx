import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for the cooperative Kontexto during initial load. Mirrors
// KoopPageClient's layout (max-w-4xl, header → flex-col md:flex-row body with
// main column + desktop PlayerBar sidebar) so the skeleton → game swap is free
// of layout shift.

function PlayerBarSkeleton() {
  return (
    <div className="w-56 shrink-0 space-y-2 rounded-xl border bg-card p-3">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

export default function KoopSkeleton() {
  return (
    <div className="max-w-4xl mx-auto min-h-screen flex flex-col" aria-busy="true" aria-label="Koop wird geladen">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <Skeleton className="h-7 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 px-4 py-4 gap-4">
        <div className="flex-1 flex flex-col gap-4">
          {/* Mobile player bar */}
          <div className="flex gap-2 md:hidden">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
          <div className="flex items-baseline gap-4">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <PlayerBarSkeleton />
        </div>
      </div>
    </div>
  );
}
