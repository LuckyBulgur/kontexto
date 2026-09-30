"use client";

import { useState } from "react";
import { knockTombstone } from "@/lib/events/hooks";
import { cn } from "@/lib/utils";
import { TombstoneGlyph } from "./art";
import { COPY } from "./copy";

/**
 * A small graveyard at the top of the footer, for the jokes every Kontexto
 * player gets: rank 2, the lost streak, the word that was "zu allgemein".
 *
 * In the static markup on every page and shown by the `halloween:` variant,
 * because the footer is on screen at load on short pages and a strip that
 * mounted after hydration would push it down. The first stone is a button;
 * knock three times and its tenant waves (secret "Ruhestörung").
 */
export default function Graveyard() {
  const [wobble, setWobble] = useState(0);
  const [first, ...rest] = COPY.graveyard.stones;

  const knock = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setWobble((n) => n + 1);
    knockTombstone(rect.left + rect.width / 2);
  };

  const stone = (s: { top: string; bottom: string }) => (
    <span className="relative flex h-24 w-24 flex-col items-center justify-center px-2 pt-4 text-center">
      <TombstoneGlyph className="absolute inset-0 h-full w-full" />
      <span className="relative font-display text-micro font-bold leading-tight text-foreground">{s.top}</span>
      <span className="relative text-micro leading-tight text-muted-foreground">{s.bottom}</span>
    </span>
  );

  return (
    <div
      role="group"
      aria-label={COPY.graveyard.label}
      className="mx-auto hidden max-w-6xl items-end gap-3 px-4 pt-6 sm:px-6 halloween:flex"
    >
      <button
        type="button"
        onClick={knock}
        aria-label={`${COPY.graveyard.knockLabel}: ${first.top}, ${first.bottom}`}
        data-testid="spook-tombstone"
        className="rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span key={wobble} className={cn("inline-flex origin-bottom", wobble > 0 && "spook-wobble")}>
          {stone(first)}
        </span>
      </button>
      {rest.map((s) => (
        <span key={s.top} className="inline-flex">
          {stone(s)}
        </span>
      ))}
    </div>
  );
}
