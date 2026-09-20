"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import SourceSurvey from "@/components/SourceSurvey";

/**
 * The attribution survey as a modal, shown exactly once per visitor after a
 * finished game.
 *
 * It asks for a decision: while the question stands, the dialog does not close
 * on Escape, on a click outside or through a corner cross. That is deliberate
 * and bounded by two things: it happens once in a visitor's life, and one of the
 * choices is always the skip button, so nobody is trapped. Once an answer is in,
 * the dialog turns into the optional detail field and closes normally.
 */

const COPY = {
  title: "Woher kennst du Kontexto?",
  description: "Eine Frage, ein Klick. Wir fragen dich das nur dieses eine Mal.",
  thanksTitle: "Danke!",
  thanksDescription: "Magst du sagen, wo genau? Freiwillig, ein Wort reicht.",
  skip: "Überspringen",
  done: "Fertig",
};

export default function SourceSurveyDialog({
  open,
  onAnswered,
  onSkipped,
  onClose,
}: {
  open: boolean;
  /** An answer was sent. The dialog stays open for the optional detail field. */
  onAnswered: () => void;
  /** Skipped: no answer, and the dialog is done for good. */
  onSkipped: () => void;
  /** The dialog is closed after an answer. */
  onClose: () => void;
}) {
  const [answered, setAnswered] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Only an answered dialog may be closed by the usual means.
        if (!next && answered) onClose();
      }}
    >
      <DialogContent
        showCloseButton={answered}
        onEscapeKeyDown={(event) => {
          if (!answered) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (!answered) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (!answered) event.preventDefault();
        }}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{answered ? COPY.thanksTitle : COPY.title}</DialogTitle>
          <DialogDescription>
            {answered ? COPY.thanksDescription : COPY.description}
          </DialogDescription>
        </DialogHeader>

        <SourceSurvey
          hideQuestion
          className="border-0 bg-transparent p-0"
          onAnswered={() => {
            setAnswered(true);
            onAnswered();
          }}
        />

        {answered ? (
          <Button variant="outline" onClick={onClose} className="w-full">
            {COPY.done}
          </Button>
        ) : (
          <Button variant="ghost" onClick={onSkipped} className="w-full text-muted-foreground">
            {COPY.skip}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
