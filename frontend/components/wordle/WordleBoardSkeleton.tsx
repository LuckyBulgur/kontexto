import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for the Wördle board + keyboard during initial load. Tile and key
// dimensions are copied verbatim from Tile.tsx / Key.tsx (and the gaps from
// Board.tsx / Keyboard.tsx) so the skeleton → board swap is free of layout shift.
// Shared by the single-player game and the duel.

export function WordleBoardGridSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[21rem] flex-col items-center gap-1.5 py-4" aria-hidden>
      {Array.from({ length: 6 }).map((_, r) => (
        <div key={r} className="grid w-full grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }).map((_, c) => (
            <Skeleton key={c} className="aspect-square w-full rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

function KeySkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <Skeleton
      className={`${wide ? "flex-[1.5]" : "flex-1"} min-w-0 h-[58px] sm:h-[64px] rounded`}
    />
  );
}

export function WordleKeyboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[500px] flex-col gap-1.5 px-2 pb-4" aria-hidden>
      <div className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => <KeySkeleton key={i} />)}
      </div>
      <div className="flex gap-1">
        <div className="flex-[0.5]" />
        {Array.from({ length: 9 }).map((_, i) => <KeySkeleton key={i} />)}
        <div className="flex-[0.5]" />
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
      className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto gap-6"
      aria-busy="true"
      aria-label="Spiel wird geladen"
    >
      {/* Versatz wie in WordleGame; Betrag gedeckelt gegen Header-Überlappung. */}
      <div className="w-full px-3" style={{ marginTop: "max(-8vh, -64px)" }}>
        <WordleBoardGridSkeleton />
      </div>
      <WordleKeyboardSkeleton />
    </div>
  );
}
