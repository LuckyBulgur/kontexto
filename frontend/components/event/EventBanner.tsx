"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { EVENT_NOTICE_KEY } from "@/lib/event-theme";
import { useEventTheme } from "@/lib/use-event-theme";

/**
 * Schlanker, schließbarer Hinweis auf die zeitlich begrenzte WM-2026-Skin.
 * Schwebt unten zentriert (stört das Layout nicht), erscheint erst nach Mount
 * (kein Hydration-Mismatch) und bleibt nach dem Schließen verborgen
 * (`localStorage`). Während des Events sichtbar, sofern nicht abgewählt.
 */
export default function EventBanner() {
  const { active } = useEventTheme();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(EVENT_NOTICE_KEY) === "dismissed");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!mounted || !active || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(EVENT_NOTICE_KEY, "dismissed");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-3 z-40 mx-auto flex w-[min(92%,30rem)] items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg"
      style={{ borderColor: "var(--event-gold)" }}
    >
      <span
        aria-hidden="true"
        className="font-event grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-normal tracking-wide text-white"
        style={{ backgroundColor: "var(--event-green)" }}
      >
        26
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-event text-base leading-tight tracking-wide" style={{ color: "var(--event-green)" }}>
          Kontexto im WM-Fieber
        </p>
        <p className="text-xs text-muted-foreground">
          Zeitlich begrenztes WM-2026-Design. In den Einstellungen abschaltbar.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="WM-Hinweis schließen"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </m.div>
  );
}
