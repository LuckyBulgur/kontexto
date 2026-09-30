"use client";

import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CANDIES, SECRETS, candyCounts, isComplete } from "@/lib/events/spooktober";
import { CandyGlyph, GhostGlyph } from "./art";
import { closeBag } from "./controller";
import { COPY } from "./copy";
import { useStage } from "./stage-store";

/**
 * The player's Spooktober haul: one candy per solved round and the thirteen
 * secrets, found ones named, hidden ones as a hint that points the way without
 * giving it away. Everything here lives in this browser only.
 */
export default function CandyBagDialog() {
  const { bagOpen, progress } = useStage();
  const counts = candyCounts(progress);
  const total = progress.solves.length;
  const found = new Set(progress.secrets);
  const complete = isComplete(progress);

  return (
    <Dialog open={bagOpen} onOpenChange={(open) => { if (!open) closeBag(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-spook text-h1 text-primary-ink">{COPY.bag.title}</DialogTitle>
          <DialogDescription>{COPY.bag.description}</DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin max-h-[60vh] space-y-6 overflow-y-auto">
          <section className="space-y-3" aria-labelledby="bag-candy">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="bag-candy" className="text-small font-semibold">{COPY.bag.candyHeading}</h3>
              <span className="text-micro text-muted-foreground" data-numeric>{COPY.bag.pieces(total)}</span>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {CANDIES.map((candy) => (
                <li
                  key={candy.id}
                  className="flex flex-col items-center gap-1 rounded-lg border bg-muted/40 px-2 py-3 text-center"
                >
                  <CandyGlyph
                    candy={candy.id}
                    className={counts[candy.id] > 0 ? "h-8 w-10" : "h-8 w-10 opacity-30 grayscale"}
                  />
                  <span className="text-micro leading-tight">{candy.name}</span>
                  <span className="font-display text-h3 font-bold" data-numeric>{counts[candy.id]}</span>
                </li>
              ))}
            </ul>
            {complete && (
              <p className="flex items-center gap-3 rounded-lg border px-3 py-2 text-small">
                <CandyGlyph candy="golden" className="h-8 w-10 shrink-0" />
                {COPY.bag.golden}
              </p>
            )}
            {total === 0 && <p className="text-small text-muted-foreground">{COPY.bag.empty}</p>}
          </section>

          <section className="space-y-3" aria-labelledby="bag-secrets">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="bag-secrets" className="text-small font-semibold">{COPY.bag.secretsHeading}</h3>
              <span className="text-micro text-muted-foreground" data-numeric>
                {COPY.bag.secretsCount(found.size, SECRETS.length)}
              </span>
            </div>
            <ol className="divide-y rounded-lg border">
              {SECRETS.map((secret) => {
                const isFound = found.has(secret.id);
                return (
                  <li key={secret.id} className="flex items-start gap-3 px-3 py-2.5" data-secret={secret.id} data-found={isFound}>
                    {isFound ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
                    ) : (
                      <GhostGlyph className="mt-0.5 h-4 w-4 shrink-0 opacity-50" />
                    )}
                    <div className="min-w-0">
                      <p className="text-small font-medium">
                        {isFound ? secret.name : COPY.bag.hidden}
                        {isFound && <span className="sr-only">{COPY.bag.foundSuffix}</span>}
                      </p>
                      <p className="text-micro text-muted-foreground">{isFound ? secret.found : secret.hint}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
