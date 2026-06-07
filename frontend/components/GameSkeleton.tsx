import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for the Kontexto game during initial load. Mirrors the real layout
// in GameClient (max-w-lg, min-h-screen header → stats line → input → guess list)
// so the skeleton → game swap is free of layout shift. Guess rows match GuessBar's
// h-10.
export default function GameSkeleton() {
  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col" aria-busy="true" aria-label="Spiel wird geladen">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <Skeleton className="h-7 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </main>
    </div>
  );
}
