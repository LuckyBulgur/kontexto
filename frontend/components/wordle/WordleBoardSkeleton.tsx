import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for the Wördle board + keyboard during initial load. Tile and key
// dimensions are copied verbatim from Tile.tsx / Key.tsx (and the gaps from
// Board.tsx / Keyboard.tsx) so the skeleton → board swap is free of layout shift.
// Shared by the single-player game and the duel.

export function WordleBoardGridSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 items-center py-4" aria-hidden>
      {Array.from({ length: 6 }).map((_, r) => (
        <div key={r} className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, c) => (
            <Skeleton key={c} className="w-[58px] h-[58px] sm:w-[62px] sm:h-[62px] rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

function KeySkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <Skeleton
      className={`${wide ? "w-[56px] sm:w-[72px]" : "w-[36px] sm:w-[46px]"} h-[58px] sm:h-[64px] rounded`}
    />
  );
}

export function WordleKeyboardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 pb-4" aria-hidden>
      <div className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => <KeySkeleton key={i} />)}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 9 }).map((_, i) => <KeySkeleton key={i} />)}
      </div>
      <div className="flex gap-1">
        <KeySkeleton wide />
        {Array.from({ length: 7 }).map((_, i) => <KeySkeleton key={i} />)}
        <KeySkeleton wide />
      </div>
    </div>
  );
}

// Full single-player layout, matching WordleGame's game container.
export default function WordleBoardSkeleton() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto gap-6"
      aria-busy="true"
      aria-label="Spiel wird geladen"
    >
      <div style={{ marginTop: "-8vh" }}>
        <WordleBoardGridSkeleton />
      </div>
      <WordleKeyboardSkeleton />
    </div>
  );
}
