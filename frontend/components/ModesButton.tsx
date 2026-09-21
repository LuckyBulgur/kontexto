"use client";

import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFeatureDiscovery } from "@/lib/feature-discovery";

/**
 * The door to the modes, as a button in the header rather than a line in the
 * menu.
 *
 * It sits where the endless-mode icon used to sit and it is shown at every
 * width, because it is the only way into the other ten modes that a player can
 * see without opening something first. Endless mode kept its menu entry: it is
 * one mode, and one mode does not need the most visible control on the page.
 *
 * On a first visit the button explains itself once. A grid of four squares is a
 * shape, not a sentence, and the modes were the part players did not find. The
 * hint is the project's tooltip, arrow included, rather than a bubble of its
 * own: it points at the button it is about, and it stays a hint rather than
 * becoming a small dialog that has to be answered.
 */

interface ModesButtonProps {
  onOpen: () => void;
  /** localStorage key remembering that the hint has been read. */
  hintKey: string;
  /** Whether this page may show the hint at all. A room or a running solo
   *  round is not the place for an unasked-for bubble. */
  hintEnabled?: boolean;
}

/** Long enough that the page has settled, short enough to be part of arriving. */
const HINT_DELAY_MS = 900;
/** A hint nobody reacts to goes away by itself rather than sitting there. */
const HINT_LIFETIME_MS = 12_000;

export default function ModesButton({ onOpen, hintKey, hintEnabled }: ModesButtonProps) {
  const { highlight, dismiss } = useFeatureDiscovery(hintKey);
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    if (!highlight || !hintEnabled) return;
    const show = setTimeout(() => setHintOpen(true), HINT_DELAY_MS);
    const hide = setTimeout(() => setHintOpen(false), HINT_DELAY_MS + HINT_LIFETIME_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [highlight, hintEnabled]);

  // Any first touch on the page counts as having seen it. A tooltip carries no
  // button to press, so something else has to end it, and the player reaching
  // for the board is that something.
  useEffect(() => {
    if (!hintOpen) return;
    const end = () => {
      setHintOpen(false);
      dismiss();
    };
    window.addEventListener("pointerdown", end, { capture: true, once: true });
    window.addEventListener("keydown", end, { once: true });
    return () => {
      window.removeEventListener("pointerdown", end, { capture: true });
      window.removeEventListener("keydown", end);
    };
  }, [hintOpen, dismiss]);

  return (
    <TooltipProvider>
      <Tooltip open={hintOpen || undefined}>
        <TooltipTrigger asChild>
          {/* Ghost, like every other lone glyph in this header, but in the
              accent ink rather than in the text colour: it sits next to a kebab
              of the same size, and two grey glyphs read as a pair rather than
              as an invitation. The ink and not `--primary`, which is a fill and
              measures 2,9:1 against the dark page. */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 text-primary-ink hover:text-primary-ink"
            aria-label="Spielmodi"
            onClick={() => {
              setHintOpen(false);
              if (highlight) dismiss();
              onOpen();
            }}
          >
            <LayoutGrid className="h-6! w-6!" />
            {highlight && (
              <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-ink opacity-75 motion-reduce:hidden" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-ink" />
              </span>
            )}
          </Button>
        </TooltipTrigger>
        {/* pointer-events-none: the bubble hangs over the board, and a hint
            that swallows the first tap at the word field costs more than it
            explains. The tap dismisses it instead. */}
        <TooltipContent align="end" sideOffset={6} className="max-w-56 pointer-events-none">
          {"Alle Spielmodi: allein, mit Freunden oder gegen Fremde"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
