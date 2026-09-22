"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  RATING_REASONS,
  RATING_VERDICTS,
  type WordRatingPrompt,
} from "@/lib/word-rating";

/**
 * „War das Wort fair?", asked on every finished round.
 *
 * The attribution survey next to it may be a dialog because it asks once in a
 * lifetime. This one asks daily, so it is a row and never an overlay, and it
 * never argues: there is no skip link, because the way to skip it is to ignore
 * it, and a skip link would turn ignoring it into a decision the player has to
 * make.
 *
 * The tally appears only after the visitor's own vote and only once the server
 * says there are enough of them. Shown earlier it would anchor the vote on the
 * majority, and a survey that reports its own majority stops measuring opinion.
 *
 * The decision of whether to show anything at all belongs to `useWordRating`;
 * this component only draws what it is handed.
 */

/** All visible copy in one place; the rest of the file stays free of prose. */
const COPY = {
  question: "War das Wort fair?",
  reasonQuestion: "Woran lag es?",
  thanks: "Danke.",
  tooFew: "Du bist unter den Ersten, die abgestimmt haben.",
  detailPlaceholder: "Magst du kurz sagen, warum?",
  send: "Senden",
  detailDone: "Danke, das lesen wir.",
  verdictLabels: {
    easy: "zu leicht",
    right: "genau richtig",
    hard: "zu schwer",
  },
};

// Only what the Button variant does not already carry: the 44 px touch target,
// and a label that may wrap on a narrow phone instead of overflowing.
const CHOICE_CLASS = "min-h-11 flex-1 whitespace-normal";

function Tally({ counts, total }: { counts: Record<string, number>; total: number }) {
  // Written as a sentence, not as three bars. A bar chart of three numbers is
  // decoration; the sentence is read in one pass and survives at 320 pixels.
  const parts = (["right", "hard", "easy"] as const)
    .map((id) => ({ id, share: Math.round((100 * (counts[id] ?? 0)) / total) }))
    .filter((part) => part.share > 0)
    .map((part) => `${part.share}% ${COPY.verdictLabels[part.id]}`);
  return <span>{parts.join(", ")}</span>;
}

export default function WordRating({
  prompt,
  className,
}: {
  prompt: WordRatingPrompt;
  className?: string;
}) {
  const [detail, setDetail] = useState("");

  if (!prompt.visible) return null;

  const surface = cn("rounded-lg border bg-muted/50 p-3 text-left", className);

  if (prompt.step === "verdict") {
    return (
      <fieldset className={surface}>
        <legend className="px-1 text-small font-medium">{COPY.question}</legend>
        <div className="flex gap-2 pt-1">
          {RATING_VERDICTS.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => prompt.chooseVerdict(option.id)}
              className={CHOICE_CLASS}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </fieldset>
    );
  }

  if (prompt.step === "reason") {
    return (
      <fieldset className={surface}>
        <legend className="px-1 text-small font-medium">{COPY.reasonQuestion}</legend>
        <div className="flex flex-wrap gap-2 pt-1">
          {RATING_REASONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => prompt.chooseReason(option.id)}
              className="min-h-11 whitespace-normal"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className={surface}>
      <p className="text-small text-muted-foreground">
        {COPY.thanks}{" "}
        {prompt.summary?.enough && prompt.summary.total > 0 ? (
          <Tally counts={prompt.summary.counts} total={prompt.summary.total} />
        ) : (
          COPY.tooFew
        )}
      </p>
      {prompt.detailSent ? (
        <p className="mt-2 text-micro text-muted-foreground">{COPY.detailDone}</p>
      ) : (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            prompt.sendDetail(detail);
          }}
        >
          <Input
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            maxLength={80}
            placeholder={COPY.detailPlaceholder}
            aria-label={COPY.detailPlaceholder}
            className="h-10"
          />
          <Button type="submit" size="sm" className="h-10 shrink-0" disabled={!detail.trim()}>
            {COPY.send}
          </Button>
        </form>
      )}
    </div>
  );
}
