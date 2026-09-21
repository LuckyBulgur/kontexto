"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Flame,
  Globe,
  Link2,
  Shuffle,
  Swords,
  Target,
  Timer,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ModeRow from "@/components/ModeRow";
import { loadSentence, totalSentence } from "@/lib/matchmaking-rules";
import { QueueModeId } from "@/lib/matchmaking-types";
import { KONTEXTO_MULTIPLAYER_ORDER, MULTIPLAYER_MODES } from "@/lib/multiplayer-modes";
import { SOLO_MODES, SOLO_MODE_ORDER } from "@/lib/solo-modes";
import { useMatchmakingLive } from "@/lib/use-matchmaking-live";

/**
 * The mode picker.
 *
 * A dialog and not a page, because this is opened from inside a running game:
 * the player wants to be somewhere else in one or two taps, not to read.
 *
 * Two steps, because the first question a player actually has is not "which
 * mode" but "with whom". Nine modes times two ways in is eighteen choices on
 * one screen; asking "with whom" first turns that into three, then four to
 * five. It also puts playing with friends on the same footing as playing alone,
 * instead of hiding it in a small link beside the mode.
 *
 * Kontexto only. The Wordle duel is offered by the Wordle header, because it is
 * a round of the other game and this dialog opens on a Kontexto board.
 *
 * The long version, with the rules of every mode, is /modi/.
 */

type Path = "solo" | "friends" | "strangers";

const PATHS: {
  id: Path;
  icon: LucideIcon;
  title: string;
  hint: string;
}[] = [
  { id: "solo", icon: User, title: "Allein", hint: "Vier Modi, sofort los" },
  { id: "friends", icon: Link2, title: "Mit Freunden", hint: "Link teilen, zusammen spielen" },
  { id: "strangers", icon: Globe, title: "Gegen Fremde", hint: "Wir suchen dir Mitspieler" },
];

const MODE_ICONS: Record<string, LucideIcon> = {
  duel: Swords,
  koop: Users,
  royale: Flame,
  blitz: Timer,
  timerush: Clock,
  leiter: Target,
  limit: Timer,
  doppel: Shuffle,
  suddendeath: Flame,
};

const STEP_TITLES: Record<Path, string> = {
  solo: "Allein spielen",
  friends: "Mit Freunden spielen",
  strangers: "Gegen Fremde spielen",
};

interface ModePickerDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ModePickerDialog({ open, onClose }: ModePickerDialogProps) {
  const [path, setPath] = useState<Path | null>(null);

  // "Gegen Fremde" is the only path whose answer depends on who else is here,
  // so the dialog asks while it is open and stops when it closes.
  const live = useMatchmakingLive(open);

  // Reopening starts at the question again. Landing back on the list from three
  // sessions ago would be a small mystery every time.
  useEffect(() => {
    if (!open) setPath(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-h3">
            {path && (
              <button
                type="button"
                onClick={() => setPath(null)}
                aria-label="Zurück zur Auswahl"
                className="-ml-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <span>{path ? STEP_TITLES[path] : "Wie willst du spielen?"}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {"Spielmodus auswählen und direkt starten"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-2 overflow-y-auto pt-1">
          {path === null
            ? PATHS.map((entry) => (
                <ModeRow
                  key={entry.id}
                  icon={entry.icon}
                  title={entry.title}
                  hint={entry.id === "strangers" && live ? totalSentence(live) : entry.hint}
                  onClick={() => setPath(entry.id)}
                />
              ))
            : modesFor(path).map((mode) => (
                <ModeRow
                  key={mode.href}
                  icon={MODE_ICONS[mode.id]}
                  title={mode.name}
                  hint={mode.hook}
                  href={mode.href}
                  // Same reserved line as on /suche/: the figure arrives a
                  // moment after the list and must not move it.
                  reserveNote={Boolean(mode.queueId)}
                  note={mode.queueId ? loadSentence(live?.modes[mode.queueId]) : undefined}
                />
              ))}

          <p className="pt-2 text-center text-micro text-muted-foreground">
            <Link href="/modi/" className="underline underline-offset-2 hover:no-underline">
              {"Regeln aller Modi nachlesen"}
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PickerEntry {
  id: string;
  name: string;
  hook: string;
  href: string;
  /** Set only where a load figure means anything, so on the strangers path. */
  queueId?: QueueModeId;
}

/** The modes this path offers, and where each one leads. */
function modesFor(path: Path): PickerEntry[] {
  if (path === "solo") {
    return SOLO_MODE_ORDER.map((id) => {
      const mode = SOLO_MODES[id];
      return { id, name: mode.name, hook: mode.hook, href: `/solo/${mode.slug}/` };
    });
  }
  return KONTEXTO_MULTIPLAYER_ORDER.flatMap((id) => {
    const mode = MULTIPLAYER_MODES[id];
    const href = path === "friends" ? mode.createHref : mode.queueHref;
    // A mode without an invite form simply does not appear under "with friends".
    if (!href) return [];
    // An invite link needs no queue, and a friend who has the link is coming
    // regardless of how many strangers are around.
    return [{ id, name: mode.name, hook: mode.hook, href, queueId: path === "strangers" ? id : undefined }];
  });
}
