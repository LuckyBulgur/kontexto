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
 * It is a labelled pill, not a lone glyph, because a glyph next to a glyph
 * reads as a pair of tools rather than as an invitation. Colour alone did not
 * fix that: the button was still the third icon in a row of icons. So it gets
 * two things that make a control its own object, a filled surface and a word.
 *
 * The word disappears below 380 pixels, not below `sm:`. A phone is where the
 * modes were hardest to find, so the label has to survive one; 640 would have
 * hidden it on every phone there is. 380 is where the widest header still fits,
 * the one carrying a back arrow, the wordmark, the share button and the kebab
 * next to the pill.
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
          {/* A tinted surface in the accent, and the glyph in the accent ink
              rather than in `--primary`, which is a fill and measures 2,9:1
              against the dark page. The tint is faint enough that the header
              stays quiet, and it is the shape, not the colour, that does the
              work. */}
          <Button
            variant="ghost"
            className="relative h-10 gap-1.5 rounded-full bg-primary/10 px-2.5 text-primary-ink hover:bg-primary/15 hover:text-primary-ink dark:hover:bg-primary/20 min-[380px]:px-3.5"
            aria-label="Spielmodi"
            onClick={() => {
              setHintOpen(false);
              if (highlight) dismiss();
              onOpen();
            }}
          >
            <LayoutGrid className="h-5! w-5!" />
            <span className="hidden font-semibold min-[380px]:inline">Modi</span>
            {highlight && (
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5" aria-hidden>
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
