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
 */

interface ModeRowProps {
  icon: LucideIcon;
  title: string;
  hint: string;
  /** A quiet third line, kept at its height even while empty so an arriving
   *  figure does not move the row under the finger about to tap it. */
  note?: string;
  reserveNote?: boolean;
  href?: string;
  onClick?: () => void;
}

const ROW_CLASS =
  "flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:border-primary";

export default function ModeRow({
  icon,
  title,
  hint,
  note,
  reserveNote,
  href,
  onClick,
}: ModeRowProps) {
  const body = (
    <>
      <ModeBadge icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lead font-bold">{title}</span>
        <span className="block text-small text-muted-foreground">{hint}</span>
        {(note || reserveNote) && (
          <span className="block min-h-[1lh] text-micro text-muted-foreground/80">{note}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={ROW_CLASS}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={ROW_CLASS}>
      {body}
    </button>
  );
}

export function ModeBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}
