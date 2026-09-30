"use client";

import { useEffect, useRef, useState } from "react";
import { knockPumpkin } from "@/lib/events/hooks";
import { cn } from "@/lib/utils";
import { PumpkinGlyph } from "./art";
import { COPY } from "./copy";

/**
 * The pumpkin in the header. A knock bursts candy out of it; now and then it
 * plays a trick instead; the thirteenth knock empties it for a minute.
 *
 * Always in the markup and shown by the `halloween:` variant, so it stands in
 * the header from the first paint without a layout shift and is simply not
 * there (display: none, out of the accessibility tree) outside the event. The
 * behaviour behind it is loaded on the first knock.
 *
 * A real button: reachable by keyboard, named for what it does. The wobble is
 * bound to the knock (M13), not to hover (M6).
 */
export default function PumpkinButton({ className }: { className?: string }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [wobble, setWobble] = useState(0);
  const [empty, setEmpty] = useState(false);
  const emptyTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(emptyTimer.current), []);

  const knock = async () => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const result = await knockPumpkin(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (result === null || result === "throttled") return;
    setWobble((n) => n + 1);
    if (result === "empty") {
      setEmpty(true);
      window.clearTimeout(emptyTimer.current);
      emptyTimer.current = window.setTimeout(() => setEmpty(false), 60_000);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={knock}
      aria-label={empty ? COPY.pumpkinEmptyLabel : COPY.pumpkinLabel}
      data-testid="spook-pumpkin"
      className={cn(
        "hidden h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 halloween:inline-flex",
        className,
      )}
    >
      <span key={wobble} className={cn("inline-flex", wobble > 0 && "spook-wobble", empty && "spook-pumpkin-empty")}>
        <PumpkinGlyph className="h-7 w-7" />
      </span>
    </button>
  );
}
