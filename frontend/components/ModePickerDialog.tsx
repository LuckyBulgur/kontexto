"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Flame,
  Globe,
  Layers,
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
import { MULTIPLAYER_MODES, MULTIPLAYER_MODE_ORDER } from "@/lib/multiplayer-modes";
import { SOLO_MODES, SOLO_MODE_ORDER } from "@/lib/solo-modes";

/**
 * The mode picker.
 *
 * A dialog and not a page, because this is opened from inside a running game:
 * the player wants to be somewhere else in one or two taps, not to read.
 *
 * Two steps, because the first question a player actually has is not "which
 * mode" but "with whom". Ten modes times two ways in is twenty choices on one
 * screen; asking "with whom" first turns that into three, then four to six. It
 * also puts playing with friends on the same footing as playing alone, instead
 * of hiding it in a small link beside the mode.
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
  wordle_duel: Layers,
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

  // Reopening starts at the question again. Landing back on the list from three
  // sessions ago would be a small mystery every time.
  useEffect(() => {
    if (!open) setPath(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
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
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setPath(entry.id)}
                  className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:border-primary"
                >
                  <Badge icon={entry.icon} />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold">{entry.title}</span>
                    <span className="block text-sm text-muted-foreground">{entry.hint}</span>
                  </span>
                </button>
              ))
            : modesFor(path).map((mode) => (
                <Link
                  key={mode.href}
                  href={mode.href}
                  className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:border-primary"
                >
                  <Badge icon={MODE_ICONS[mode.id]} />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold">{mode.name}</span>
                    <span className="block text-sm text-muted-foreground">{mode.hook}</span>
                  </span>
                </Link>
              ))}

          <p className="pt-2 text-center text-xs text-muted-foreground">
            <Link href="/modi/" className="underline underline-offset-2 hover:no-underline">
              {"Regeln aller Modi nachlesen"}
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Badge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

/** The modes this path offers, and where each one leads. */
function modesFor(path: Path): { id: string; name: string; hook: string; href: string }[] {
  if (path === "solo") {
    return SOLO_MODE_ORDER.map((id) => {
      const mode = SOLO_MODES[id];
      return { id, name: mode.name, hook: mode.hook, href: `/solo/${mode.slug}/` };
    });
  }
  return MULTIPLAYER_MODE_ORDER.flatMap((id) => {
    const mode = MULTIPLAYER_MODES[id];
    const href = path === "friends" ? mode.createHref : `/suche/?modus=${mode.id}`;
    // A mode without an invite form simply does not appear under "with friends".
    return href ? [{ id, name: mode.name, hook: mode.hook, href }] : [];
  });
}
