import { Skeleton } from "@/components/ui/skeleton";

// Structure-faithful placeholder for the admin stats dashboard. Deliberately
// self-contained: it must NOT import from charts.tsx, which pulls recharts into
// the bundle — keeping recharts confined to the lazily-loaded Dashboard chunk.
// The container classes mirror the real shell in StatsCharts.tsx (grouped
// sidebar + the default "Überblick" section) so swapping skeleton → dashboard
// does not shift layout.

function SectionHeaderSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="mt-0.5 h-9 w-9 shrink-0 rounded-lg" />
      <div className="space-y-2 pt-0.5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3.5 w-56" />
      </div>
    </div>
  );
}

function KpiCardSkeleton({ spark = false }: { spark?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-20" />
      {spark && <Skeleton className="mt-1 h-8 w-full rounded-md" />}
    </div>
  );
}

// Item counts per sidebar group (Dashboard · Reichweite · Spiel · System).
const SIDEBAR_GROUPS = [1, 3, 2, 2];

function SidebarSkeleton() {
  return (
    <div className="lg:w-56 lg:shrink-0">
      {/* Mobile / tablet: horizontal pill bar */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-xl" />
        ))}
      </div>
      {/* Desktop: grouped vertical list */}
      <div className="hidden lg:block lg:space-y-6">
        {SIDEBAR_GROUPS.map((count, gi) => (
          <div key={gi} className="space-y-1">
            <Skeleton className="mx-3 h-3 w-20" />
            <div className="space-y-0.5">
              {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 lg:flex-row lg:gap-8"
      aria-busy="true"
      aria-label="Statistiken werden geladen"
    >
      <SidebarSkeleton />
      <div className="min-w-0 flex-1 space-y-6">
        {/* Section header + range toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeaderSkeleton />
          <Skeleton className="h-9 w-56 rounded-xl" />
        </div>

        {/* Default "Überblick" section: greeting + two KPI grids */}
        <div className="space-y-4">
          <div className="space-y-3 rounded-3xl border p-6 shadow-sm sm:p-8">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-3/4 max-w-2xl" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} spark />)}
          </div>
          <Skeleton className="h-3 w-40" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
