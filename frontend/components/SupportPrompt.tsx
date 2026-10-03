"use client";

import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SUPPORT_COPY, type SupportSource } from "@/lib/support";
import { openSupport } from "@/lib/support-dialog";

/**
 * One quiet line on the result card of a solved round.
 *
 * After the round, not before and not during it: a request made after the
 * service is accepted, one made before it reads as manipulative (Warren and
 * Hanson, University of Oregon and University of Richmond, on tip requests), and
 * the Guardian's strongest contribution channel is the note at the end of an
 * article. It is a line with a button and nothing more: no dialog opens by
 * itself, nothing animates, and it is never repeated elsewhere on the card.
 */
export default function SupportPrompt({
  source,
  className,
  onBeforeOpen,
}: {
  source: Extract<SupportSource, "result_kontexto" | "result_wordle">;
  className?: string;
  /** Wördle's result sits in a dialog itself; it closes first so two dialogs
   *  never compete for focus. */
  onBeforeOpen?: () => void;
}) {
  return (
    <div
      data-testid="support-prompt"
      className={cn(
        "flex flex-col gap-2 border-t border-border pt-3 text-small text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p>{SUPPORT_COPY.resultLine}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          onBeforeOpen?.();
          openSupport(source);
        }}
        className="shrink-0 gap-1.5 self-start sm:self-auto"
      >
        <Coffee className="h-4 w-4 text-primary" aria-hidden="true" />
        {SUPPORT_COPY.resultButton}
      </Button>
    </div>
  );
}
