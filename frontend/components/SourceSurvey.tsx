"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitSurveyAnswer } from "@/lib/analytics";
import { SURVEY_OPTIONS, shuffleOptions, type SurveyOption } from "@/lib/survey";

/**
 * „Woher kennst du Kontexto?", one question, one tap.
 *
 * The chip tap already sends the answer, so the optional detail field below it
 * costs nothing if it is ignored. The order of the chips is shuffled once per
 * mount (`useMemo` with no dependencies), because the first entries of a fixed
 * list get picked disproportionately often and the result would then measure
 * the list instead of the channels.
 */

/** All visible copy in one place; the rest of the file stays free of prose. */
const COPY = {
  question: "Woher kennst du Kontexto?",
  skip: "Nicht jetzt",
  detailHeading: "Danke! Magst du sagen, wo genau?",
  detailHint: "Freiwillig, ein Wort reicht.",
  send: "Senden",
  done: "Danke, das hilft uns weiter.",
};

// Only what the Button variant does not already carry. The border, the surface,
// the hover and the focus ring come from `outline` and `link`; what is left is
// the 44 px touch target the survey sits behind on a phone, and the muted size
// of the skip link.
const CHIP_CLASS = "min-h-11 whitespace-normal";
/** Small and quiet, but still underlined: it is a control, not a caption. */
const LINK_CLASS = "h-auto px-1 py-0 text-micro";

export default function SourceSurvey({
  onAnswered,
  onSkipped,
  skipLabel = COPY.skip,
  hideQuestion = false,
  className,
}: {
  /** Called once an answer has been sent, so the caller can stop asking. */
  onAnswered: () => void;
  /** Called when the visitor declines. Surfaces without it render no skip link. */
  onSkipped?: () => void;
  skipLabel?: string;
  /** The surface carries question and thank-you in its own heading (dialog),
   * so this component renders the controls only. */
  hideQuestion?: boolean;
  className?: string;
}) {
  const options = useMemo(() => shuffleOptions(SURVEY_OPTIONS), []);
  const [chosen, setChosen] = useState<SurveyOption | null>(null);
  const [detail, setDetail] = useState("");
  const [detailSent, setDetailSent] = useState(false);
  const answeredRef = useRef(false);

  function choose(option: SurveyOption) {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setChosen(option);
    void submitSurveyAnswer(option.id);
    onAnswered();
  }

  function sendDetail() {
    if (!chosen || detailSent) return;
    const text = detail.trim();
    if (!text) return;
    setDetailSent(true);
    void submitSurveyAnswer(chosen.id, text);
  }

  if (chosen) {
    return (
      <div className={cn("rounded-lg border bg-muted/50 p-3 text-left", className)}>
        {detailSent ? (
          <p className="text-small text-muted-foreground">{COPY.done}</p>
        ) : (
          <>
            {!hideQuestion && <p className="mb-2 text-small font-medium">{COPY.detailHeading}</p>}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendDetail();
              }}
            >
              <Input
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                maxLength={80}
                placeholder={chosen.detailPrompt}
                aria-label={chosen.detailPrompt}
                className="h-10"
              />
              <Button type="submit" size="sm" className="h-10 shrink-0" disabled={!detail.trim()}>
                {COPY.send}
              </Button>
            </form>
            {!hideQuestion && (
              <p className="mt-2 text-micro text-muted-foreground">{COPY.detailHint}</p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <fieldset className={cn("rounded-lg border bg-muted/50 p-3 text-left", className)}>
      {/* In the dialog the title already carries the question; a second copy
          would read it twice to a screen reader. */}
      {!hideQuestion && <legend className="px-1 text-small font-medium">{COPY.question}</legend>}
      <div className="flex flex-wrap gap-2 pt-1">
        {options.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => choose(option)}
            className={CHIP_CLASS}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {onSkipped && (
        <div className="mt-2 flex justify-end">
          <Button type="button" variant="link" size="sm" onClick={onSkipped} className={LINK_CLASS}>
            {skipLabel}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
