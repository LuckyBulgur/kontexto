import { Skeleton } from "@/components/ui/skeleton";

// Structure-faithful placeholder for the admin stats dashboard. Deliberately
// self-contained: it must NOT import from charts.tsx, which pulls recharts into
// the bundle — keeping recharts confined to the lazily-loaded Dashboard chunk.
// The container classes mirror the real components in StatsCharts.tsx / charts.tsx
// so swapping skeleton → dashboard does not shift layout.

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

function PanelSkeleton({ height = 200, span2 = false }: { height?: number; span2?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-sm sm:p-5 ${span2 ? "lg:col-span-2" : ""}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </div>
  );
}

export default function StatsSkeleton() {
  return (
    <div className="space-y-12" aria-busy="true" aria-label="Statistiken werden geladen">
      {/* Greeting header */}
      <div className="space-y-3 rounded-3xl border p-6 shadow-sm sm:p-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-3/4 max-w-2xl" />
        <Skeleton className="h-3 w-48" />
      </div>

      {/* Überblick */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeaderSkeleton />
          <Skeleton className="h-9 w-56 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} spark />)}
        </div>
        <Skeleton className="h-3 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      </section>

      {/* Seit Beginn der Zählung */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <PanelSkeleton height={120} />
          <PanelSkeleton height={160} />
        </div>
      </section>

      {/* Besucher & Reichweite */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="grid gap-4 lg:grid-cols-2">
          <PanelSkeleton height={200} />
          <PanelSkeleton height={200} />
          <PanelSkeleton height={220} />
          <PanelSkeleton height={220} />
          <PanelSkeleton height={180} span2 />
        </div>
      </section>

      {/* Spielverhalten */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <PanelSkeleton key={i} height={200} />)}
        </div>
      </section>
    </div>
  );
}
