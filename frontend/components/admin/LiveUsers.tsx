"use client";

import { useEffect, useState } from "react";
import { getAdminLive } from "@/lib/api";
import type { LiveData } from "@/lib/types";
import { formatNumber } from "@/lib/format";

// How often the badge re-polls the live count. The server presence window is
// wider than this, so the displayed number changes smoothly rather than flickering.
const POLL_MS = 10_000;

const PAGE_LABELS: Record<string, string> = {
  "/": "Startseite",
  "/wordle": "Wördle",
  "/duel": "Kontexto-Duell",
  "/wordle/duel": "Wördle-Duell",
  other: "Sonstige",
};

/**
 * Always-visible "currently online" badge for the admin dashboard. Polls a
 * lightweight, session-protected endpoint on an interval so the figure updates
 * in near real time, independent of the (one-shot) full stats load.
 */
export function LiveUsers({ token, initial }: { token: string; initial?: LiveData | null }) {
  const [live, setLive] = useState<LiveData | null>(initial ?? null);

  useEffect(() => {
    let cancelled = false;
    const tick = () =>
      getAdminLive(token)
        .then((data) => { if (!cancelled) setLive(data); })
        .catch(() => { /* keep the last value on a transient failure */ });
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [token]);

  const count = live?.active_now ?? 0;
  const active = count > 0;
  const breakdown = live
    ? Object.entries(live.by_page)
        .map(([page, n]) => `${PAGE_LABELS[page] ?? page}: ${formatNumber(n)}`)
        .join(" · ")
    : "";

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm shadow-sm"
      title={active && breakdown ? breakdown : undefined}
      aria-label={`${count} Besucher gerade online`}
    >
      <span className="relative inline-flex h-2.5 w-2.5" aria-hidden>
        {active && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/70" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active ? "bg-green-500" : "bg-muted-foreground/40"}`}
        />
      </span>
      <span className="font-semibold tabular-nums">{formatNumber(count)}</span>
      <span className="text-muted-foreground">gerade aktiv</span>
    </div>
  );
}
