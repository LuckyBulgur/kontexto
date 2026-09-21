"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Flame,
  Infinity as InfinityIcon,
  LayoutGrid,
  MessagesSquare,
  Shuffle,
  Swords,
  Target,
  Timer,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ModeRow from "@/components/ModeRow";
import { loadSentence, totalSentence } from "@/lib/matchmaking-rules";
import { QueueModeId } from "@/lib/matchmaking-types";
import {
  KONTEXTO_MULTIPLAYER_ORDER,
  KONTEXTO_QUEUE_ORDER,
  MULTIPLAYER_MODES,
} from "@/lib/multiplayer-modes";
import { SOLO_MODES, SOLO_MODE_ORDER } from "@/lib/solo-modes";
import { useMatchmakingLive } from "@/lib/use-matchmaking-live";

/**
 * The mode picker.
 *
 * A dialog and not a page, because this is opened from inside a running game:
 * the player wants to be somewhere else in one or two taps, not to read.
 *
 * "With whom" is the first question a player has, so it stays the first thing
 * on the screen, but as three tabs rather than as a first step. As a step it
 * cost a tap, a back arrow and the knowledge that anything followed at all,
 * and it read as a menu: players chose a row and were surprised by a second
 * list. Three tabs say "there are three of these" while showing one of them.
 *
 * Kontexto only. The Wordle duel is offered by the Wordle header, because it is
 * a round of the other game and this dialog opens on a Kontexto board.
 *
 * The long version, with the rules of every mode, is /modi/.
 */

type Path = "solo" | "friends" | "strangers";

const TAB_ORDER: Path[] = ["solo", "friends", "strangers"];

const TAB_LABELS: Record<Path, string> = {
  solo: "Allein",
  friends: "Mit Freunden",
  strangers: "Gegen Fremde",
};

/** One line under the tabs, so the chosen tab says what it promises. */
const TAB_LEADS: Record<Path, string> = {
  solo: "Sofort los, niemand wartet auf dich.",
  friends: "Du bekommst einen Link zum Teilen.",
  strangers: "Wir suchen dir Mitspieler.",
};

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
  infinite: InfinityIcon,
  live: MessagesSquare,
};

/** A mode added to the catalogue without an icon still gets a row rather than
 *  crashing the dialog, which is what an undefined component does here. */
const FALLBACK_ICON = LayoutGrid;

/** Marker on the home URL that starts endless mode on arrival. */
export const INFINITE_PARAM = "unendlich";

interface ModePickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Endless mode runs on the board this dialog may be sitting on. Where that
   *  board exists the entry starts it; everywhere else it links home and the
   *  round starts there. */
  onInfiniteStart?: () => void;
}

export default function ModePickerDialog({
  open,
  onClose,
  onInfiniteStart,
}: ModePickerDialogProps) {
  const [path, setPath] = useState<Path>("solo");

  // The queue figures are the only thing here that depends on who else is
  // around, so the dialog asks while it is open and stops when it closes.
  const live = useMatchmakingLive(open);

  // Reopening starts at the first tab. Landing on the list from three sessions
  // ago would be a small mystery every time.
  useEffect(() => {
    if (!open) setPath("solo");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">Wie willst du spielen?</DialogTitle>
          <DialogDescription className="sr-only">
            {"Spielmodus auswählen und direkt starten"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={path} onValueChange={(next) => setPath(next as Path)}>
          {/* The vendored list is a 36 pixel strip and its trigger is sized
              against that height, which in a three-column grid left the active
              pill hanging over the edge. Both heights come from the content
              here, hence the important modifier: the strip height is written
              as a group variant that an ordinary utility does not beat. The
              active surface is a solid token, not the translucent one the dark
              variant ships, which read as glass on a card. The labels wrap:
              at 320 pixels "Mit Freunden" does not fit a third of the row on
              one line, and a clipped label is worse than a second line. */}
          <TabsList className="grid h-auto! w-full grid-cols-3 gap-1 bg-muted p-1">
            {TAB_ORDER.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                className="h-auto! px-1 py-2.5 text-small leading-tight font-semibold whitespace-normal data-[state=active]:bg-card data-[state=active]:text-foreground dark:data-[state=active]:border-border dark:data-[state=active]:bg-card"
              >
                {TAB_LABELS[id]}
              </TabsTrigger>
            ))}
          </TabsList>

          {TAB_ORDER.map((id) => (
            <TabsContent key={id} value={id}>
              <p className="pb-2 text-small text-muted-foreground">
                {id === "strangers" && live ? totalSentence(live) : TAB_LEADS[id]}
              </p>

              <div className="scrollbar-thin max-h-[60vh] space-y-2 overflow-y-auto">
                {modesFor(id, onInfiniteStart).map((mode) => (
                  <ModeRow
                    key={mode.id}
                    icon={MODE_ICONS[mode.id] ?? FALLBACK_ICON}
                    title={mode.name}
                    hint={mode.hook}
                    href={mode.href}
                    onClick={
                      mode.onSelect
                        ? () => {
                            onClose();
                            mode.onSelect?.();
                          }
                        : undefined
                    }
                    // Same reserved line as on /suche/: the figure arrives a
                    // moment after the list and must not move it.
                    reserveNote={Boolean(mode.queueId)}
                    note={mode.queueId ? loadSentence(live?.modes[mode.queueId]) : undefined}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <p className="text-center text-micro text-muted-foreground">
          <Link href="/modi/" className="underline underline-offset-2 hover:no-underline">
            {"Regeln aller Modi nachlesen"}
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}

interface PickerEntry {
  id: string;
  name: string;
  hook: string;
  href?: string;
  /** Set where the mode starts on the page this dialog is open on. */
  onSelect?: () => void;
  /** Set only where a load figure means anything, so on the strangers tab. */
  queueId?: QueueModeId;
}

/** The modes this tab offers, and where each one leads. */
function modesFor(path: Path, onInfiniteStart?: () => void): PickerEntry[] {
  if (path === "solo") {
    const modes: PickerEntry[] = SOLO_MODE_ORDER.map((id) => {
      const mode = SOLO_MODES[id];
      return { id, name: mode.name, hook: mode.hook, href: `/solo/${mode.slug}/` };
    });
    // Endless mode belongs with the other four: it is a way of playing alone,
    // and it used to be findable only as an icon on a wide screen.
    modes.push({
      id: "infinite",
      name: "Unendlich-Modus",
      hook: "Ein Spiel nach dem anderen",
      ...(onInfiniteStart ? { onSelect: onInfiniteStart } : { href: `/?${INFINITE_PARAM}=1` }),
    });
    return modes;
  }
  if (path === "friends") {
    return KONTEXTO_MULTIPLAYER_ORDER.flatMap((id) => {
      const mode = MULTIPLAYER_MODES[id];
      // A mode without an invite form simply does not appear here.
      if (!mode.createHref) return [];
      // An invite link needs no queue figure: a friend who has the link is
      // coming regardless of how many strangers are around.
      return [{ id, name: mode.name, hook: mode.hook, href: mode.createHref }];
    });
  }
  return KONTEXTO_QUEUE_ORDER.flatMap((id) => {
    const mode = MULTIPLAYER_MODES[id];
    if (!mode.queueHref) return [];
    return [{ id, name: mode.name, hook: mode.hook, href: mode.queueHref, queueId: id }];
  });
}
