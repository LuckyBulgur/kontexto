"use client";

import { useEffect } from "react";
import { reportLostPage } from "@/lib/events/hooks";
import { GhostGlyph } from "./art";
import { COPY } from "./copy";

/**
 * The 404 page during Spooktober: a ghost and one line, shown by the
 * `halloween:` variant so it stands from the first paint. Landing here is
 * secret "Verirrt"; the hook does nothing outside the event.
 */
export default function HauntedNotFound() {
  useEffect(() => {
    reportLostPage();
  }, []);

  return (
    <div className="hidden flex-col items-center gap-3 halloween:flex">
      <GhostGlyph className="h-20 w-20" />
      <p className="font-spook text-h2 text-primary-ink">{COPY.lost.line}</p>
    </div>
  );
}
