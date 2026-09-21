"use client";

import { CalendarDays, Dices, Globe, Swords } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ModeRow from "@/components/ModeRow";
import { loadSentence } from "@/lib/matchmaking-rules";
import { MULTIPLAYER_MODES } from "@/lib/multiplayer-modes";
import { useMatchmakingLive } from "@/lib/use-matchmaking-live";

/**
 * Wordle picks its own modes.
 *
 * Kontexto asks "with whom" first and then shows four to five modes per answer.
 * Wordle has one round to play alone, one duel with a friend and the same duel
 * against a stranger, so the same question would cost a step per single entry.
 * One flat list under three headings says the same thing in one screen.
 */

interface WordleModeDialogProps {
  open: boolean;
  onClose: () => void;
  /** Starts a random round on the page that owns one. The duel page does not,
   *  and there the entry is simply absent rather than leading somewhere else. */
  onRandom?: () => void;
}

export default function WordleModeDialog({ open, onClose, onRandom }: WordleModeDialogProps) {
  // Only the queue line depends on who else is here, and only while open.
  const live = useMatchmakingLive(open);
  const duel = MULTIPLAYER_MODES.wordle_duel;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">Wie willst du spielen?</DialogTitle>
          <DialogDescription className="sr-only">
            {"Wördle-Modus auswählen und direkt starten"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pt-1">
          <section className="space-y-2">
            <GroupLabel>Allein</GroupLabel>
            <ModeRow
              icon={CalendarDays}
              title="Tägliches Wördle"
              hint="Ein Wort für alle, jeden Tag neu"
              href="/wordle/"
            />
            {onRandom && (
              <ModeRow
                icon={Dices}
                title="Zufallsspiel"
                hint="Sofort noch eine Runde, unabhängig vom Tag"
                onClick={() => {
                  onClose();
                  onRandom();
                }}
              />
            )}
          </section>

          <section className="space-y-2">
            <GroupLabel>Mit Freunden</GroupLabel>
            <ModeRow
              icon={Swords}
              title={duel.name}
              hint="Link teilen, gleiches Wördle, zwei Bretter"
              href={duel.createHref ?? "/wordle/duel/create/"}
            />
          </section>

          <section className="space-y-2">
            <GroupLabel>Gegen Fremde</GroupLabel>
            <ModeRow
              icon={Globe}
              title={duel.name}
              hint="Wir suchen dir einen Gegner"
              href={duel.queueHref}
              reserveNote
              note={loadSentence(live?.modes.wordle_duel)}
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-micro font-medium text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
