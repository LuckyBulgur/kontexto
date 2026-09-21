import * as React from "react";

import { RevealWord } from "./RevealWord";
import { cn } from "@/lib/utils";

/**
 * The head of every result card.
 *
 * The card used to open with "Herzlichen Glückwunsch!" as its h2, which made
 * the loudest line on the screen the one line that carries no information. The
 * news is the word. So the word is the hero, the outcome is the supporting
 * line, and the celebration rides along in that line, where it belongs: a
 * success message may celebrate, an error message may not.
 */

export interface ResultHeroProps {
  /** Small line above the hero, e.g. "Das Wort war". Optional and quiet. */
  eyebrow?: React.ReactNode;
  /** The hero itself: the solved word, a placement, a score. */
  headline: React.ReactNode;
  /** One line under it, e.g. "Gelöst in 14 Versuchen und 2 Tipps." */
  support?: React.ReactNode;
  /** Renders the hero in the muted ink used for a lost round. */
  lost?: boolean;
  as?: "h1" | "h2";
  /** Builds the headline letter by letter. Only for a single solved word: on a
   *  sentence like "Niemand gewinnt" it would read as a typewriter gimmick. */
  reveal?: boolean;
  className?: string;
}

export function ResultHero({
  eyebrow,
  headline,
  support,
  lost,
  as = "h2",
  reveal,
  className,
}: ResultHeroProps) {
  const Heading = as;
  return (
    <div className={cn("flex flex-col items-center gap-1 text-center", className)}>
      {eyebrow ? (
        <p className="text-micro text-muted-foreground">{eyebrow}</p>
      ) : null}
      <Heading
        className={cn(
          "text-balance text-display leading-none break-words hyphens-auto",
          lost && "text-muted-foreground",
        )}
        lang="de"
      >
        {reveal && typeof headline === "string" ? (
          <RevealWord word={headline} delayMs={120} />
        ) : (
          headline
        )}
      </Heading>
      {support ? (
        <p className="mt-1 text-body text-muted-foreground">{support}</p>
      ) : null}
    </div>
  );
}
