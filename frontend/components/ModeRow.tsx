"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * One row in a mode picker: badge, name, one line of pitch, an optional quiet
 * third line for a live figure, and a chevron.
 *
 * It exists as its own file because both games pick modes now, Kontexto in two
 * steps and Wordle in one flat list. Two dialogs that rebuild the same row are
 * two dialogs that slowly stop looking alike.
 *
 * The row is tight on purpose. This is a list somebody scans for a name, not a
 * set of cards to admire: eleven modes in three tabs, and the tallest tab has
 * to fit a phone without a scroll through the middle of it.
 *
 * The height comes out of the padding, never out of the type. Shrinking the
 * name and the pitch buys the same pixels and costs the thing the list is for,
 * which is reading a name at a glance; the padding buys them and costs nothing
 * anyone can name. So the name stays at `text-lead` and the pitch at
 * `text-small`, exactly as everywhere else, and the box around them is 10
 * pixels tall instead of 16.
 */

interface ModeRowProps {
  icon: LucideIcon;
  title: string;
  hint: string;
  /** A quiet third line, kept at its height even while empty so an arriving
   *  figure does not move the row under the finger about to tap it. */
  note?: string;
  reserveNote?: boolean;
  /** One word next to the title, for the mode this tab's players pick most.
   *  Empty for every other row: a mark that everything carries marks nothing. */
  badge?: string;
  href?: string;
  onClick?: () => void;
}

const ROW_CLASS =
  "flex w-full items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-accent focus-visible:border-primary";

/** The badged row carries the accent on its edge as well, so the leader is
 *  visible while scanning the list rather than only once the eye has reached
 *  the word. */
const ROW_CLASS_BADGED = `${ROW_CLASS} border-primary/40`;

export default function ModeRow({
  icon,
  title,
  hint,
  note,
  reserveNote,
  badge,
  href,
  onClick,
}: ModeRowProps) {
  const body = (
    <>
      <ModeBadge icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-lead font-bold">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-micro font-semibold text-primary-ink">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-small text-muted-foreground">{hint}</span>
        {(note || reserveNote) && (
          <span className="block min-h-[1lh] text-micro text-muted-foreground/80">{note}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );

  const className = badge ? ROW_CLASS_BADGED : ROW_CLASS;

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

/**
 * The glyph of a mode, on a filled accent tile.
 *
 * Filled, not tinted: on the pale tile it had before, an outline glyph in the
 * accent was two faint things on top of each other and the row read as empty.
 * lucide is a stroke set and has no filled cut, so the weight has to come from
 * the surface; filling the glyph itself is not an option, since `fill` turns
 * the target into a disc and the clock into a circle without hands.
 *
 * The stroke is lighter than the default 2, because a stroke that thick on a
 * dark surface closes its own counters at 20 pixels.
 */
export function ModeBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
