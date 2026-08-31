"use client";

import { useEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion } from "motion/react";
import { RotateCcw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { fireDemoBurst } from "@/lib/confetti";

/**
 * Animated, self-explaining demo of how Kontexto works. Decorative
 * (`aria-hidden`). The surrounding server-rendered prose is the accessible
 * text alternative. Plays once when scrolled into view; offers a replay button.
 *
 * With `prefers-reduced-motion` it renders the final solved state immediately
 * (no typing, no autoplay, no confetti).
 */

type Guess = { word: string; rank: number };

// Monotonically improving so each new guess is the best so far and can simply
// be prepended, no list re-ordering / layout animation required.
const GUESSES: Guess[] = [
  { word: "Computer", rank: 8420 },
  { word: "Meer", rank: 312 },
  { word: "Küste", rank: 47 },
  { word: "Sand", rank: 12 },
  { word: "Strand", rank: 1 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Closeness as a bar width in percent, log-scaled so rank 1 ≈ full, large ranks short. */
function barWidth(rank: number) {
  const v = 100 - Math.log10(rank) * 22;
  return Math.min(100, Math.max(6, Math.round(v)));
}

function rankColor(rank: number) {
  if (rank <= 300) return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (rank <= 1500) return { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" };
  return { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" };
}

function Row({ guess, animate }: { guess: Guess; animate: boolean }) {
  const color = rankColor(guess.rank);
  const isHit = guess.rank === 1;
  return (
    <m.div
      initial={animate ? { opacity: 0, y: -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "relative flex items-center justify-between gap-3 overflow-hidden rounded-md border px-3 py-2",
        isHit ? "border-emerald-500/60 bg-emerald-500/10" : "border-border bg-card",
      )}
    >
      <span
        className={cn("absolute inset-y-0 left-0", color.bar, "opacity-15")}
        style={{ width: `${barWidth(guess.rank)}%` }}
      />
      <span className="relative z-10 flex items-center gap-2 font-medium text-foreground">
        {isHit && <Trophy className="size-4 text-emerald-500" aria-hidden="true" />}
        {guess.word}
      </span>
      <span className={cn("relative z-10 tabular-nums text-sm font-semibold", color.text)}>
        {isHit ? "Treffer!" : guess.rank}
      </span>
    </m.div>
  );
}

export default function GameDemo({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });

  const [rows, setRows] = useState<Guess[]>([]);
  const [typing, setTyping] = useState("");
  const [done, setDone] = useState(false);
  const [runId, setRunId] = useState(0);
  const autoPlayed = useRef(false);

  // Static solved state for reduced-motion users.
  useEffect(() => {
    if (!reduce) return;
    setRows([...GUESSES].sort((a, b) => a.rank - b.rank));
    setTyping("");
    setDone(true);
  }, [reduce]);

  // Animated playthrough.
  useEffect(() => {
    if (reduce) return;
    const isAuto = runId === 0;
    if (isAuto && (!inView || autoPlayed.current)) return;
    if (isAuto) autoPlayed.current = true;

    let alive = true;
    setRows([]);
    setTyping("");
    setDone(false);

    (async () => {
      await sleep(400);
      for (const guess of GUESSES) {
        for (let c = 1; c <= guess.word.length; c++) {
          if (!alive) return;
          setTyping(guess.word.slice(0, c));
          await sleep(65);
        }
        await sleep(220);
        if (!alive) return;
        setRows((prev) => [guess, ...prev]);
        setTyping("");
        await sleep(520);
      }
      if (!alive) return;
      setDone(true);
      if (alive) await fireDemoBurst();
    })();

    return () => {
      alive = false;
    };
  }, [inView, reduce, runId]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "rounded-xl border border-border bg-muted/30 p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Beispiel · Zielwort „Strand“
        </span>
        {done && !reduce && (
          <button
            type="button"
            onClick={() => {
              setRows([]);
              setDone(false);
              setRunId((r) => r + 1);
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Erneut abspielen
          </button>
        )}
      </div>

      <div className="mb-3 flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm">
        {typing ? (
          <span className="text-foreground">
            {typing}
            <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-foreground align-middle" />
          </span>
        ) : (
          <span className="text-muted-foreground">Schreibe ein Wort …</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((g) => (
          <Row key={g.word} guess={g} animate={!reduce} />
        ))}
      </div>
    </div>
  );
}
