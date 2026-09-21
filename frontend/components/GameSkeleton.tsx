import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for the Kontexto game during initial load. Mirrors the real layout
// in GameClient (max-w-lg, viewport-height reserve, header → stats row → input →
// guess list) so the skeleton → game swap is free of layout shift. The numbers
// here are measured against the running page, not estimated: header 50px, input
// 50px, guess row 40px (Meter's h-10), stats row two lines at 44px.
export default function GameSkeleton() {
  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col" aria-busy="true" aria-label="Spiel wird geladen">
      <div className="relative flex items-center justify-center px-4 pt-5 pb-1">
        <Skeleton className="h-[30px] w-40" />
        <div className="absolute right-4 flex items-center gap-0.5">
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>
      <div className="flex-1 px-4 py-4 flex flex-col gap-4">
        <div className="-mt-1 flex items-end gap-8">
          <Skeleton className="h-11 w-16" />
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-11 w-14" />
        </div>
        <Skeleton className="h-[50px] w-full rounded-xl" />
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
