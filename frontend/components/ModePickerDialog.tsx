"use client";

import Link from "next/link";
import {
  Clock,
  Flame,
  Layers,
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
import { MULTIPLAYER_MODES, MULTIPLAYER_MODE_ORDER } from "@/lib/multiplayer-modes";
import { SOLO_MODES, SOLO_MODE_ORDER } from "@/lib/solo-modes";

/**
 * The mode picker.
 *
 * A dialog and not a page, because this is reached from inside a running game:
 * the player wants to be somewhere else in one tap, not to read. Every tile
 * therefore leads straight into a round. For multiplayer that is the queue, not
 * the invite form: somebody who opens this menu mid-game has nobody to invite,
 * and the small link underneath covers the case where they do.
 *
 * The long version of all this lives on /modi/, for search engines and for
 * anyone who actually wants to compare the modes.
 */

const MULTIPLAYER_ICONS: Record<string, LucideIcon> = {
  duel: Swords,
  koop: Users,
  wordle_duel: Layers,
  royale: Flame,
  blitz: Timer,
  timerush: Clock,
};

const SOLO_ICONS: Record<string, LucideIcon> = {
  leiter: Target,
  limit: Timer,
  doppel: Shuffle,
  suddendeath: Flame,
};

interface ModePickerDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ModePickerDialog({ open, onClose }: ModePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{"Noch eine Runde?"}</DialogTitle>
          <DialogDescription className="sr-only">
            Alle Spielmodi von Kontexto, zum direkten Starten
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pt-1">
          <Group label="Gegen andere">
            {MULTIPLAYER_MODE_ORDER.map((id) => {
              const mode = MULTIPLAYER_MODES[id];
              return (
                <Tile
                  key={id}
                  icon={MULTIPLAYER_ICONS[id]}
                  name={mode.name}
                  hook={mode.hook}
                  href={`/suche/?modus=${mode.id}`}
                  aside={mode.createHref ? { href: mode.createHref, label: "Mit Freunden" } : undefined}
                />
              );
            })}
          </Group>

          <Group label="Allein">
            {SOLO_MODE_ORDER.map((id) => {
              const mode = SOLO_MODES[id];
              return (
                <Tile
                  key={id}
                  icon={SOLO_ICONS[id]}
                  name={mode.name}
                  hook={mode.hook}
                  href={`/solo/${mode.slug}/`}
                />
              );
            })}
          </Group>

          <p className="pb-1 text-center text-xs text-muted-foreground">
            <Link href="/modi/" className="underline underline-offset-2 hover:no-underline">
              Alle Regeln nachlesen
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <ul className="list-none space-y-1.5">{children}</ul>
    </section>
  );
}

function Tile({
  icon: Icon,
  name,
  hook,
  href,
  aside,
}: {
  icon: LucideIcon;
  name: string;
  hook: string;
  href: string;
  /** The second, quieter way in: a private room with an invite link. */
  aside?: { href: string; label: string };
}) {
  return (
    <li className="relative flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent focus-within:border-primary">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        {/* The stretched link makes the whole tile the target without nesting
            interactive elements, so the invite link beside it stays reachable. */}
        <Link href={href} className="text-sm font-semibold after:absolute after:inset-0">
          {name}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">{hook}</span>
      </span>
      {aside && (
        <Link
          href={aside.href}
          className="relative z-10 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground hover:no-underline"
        >
          {aside.label}
        </Link>
      )}
    </li>
  );
}
