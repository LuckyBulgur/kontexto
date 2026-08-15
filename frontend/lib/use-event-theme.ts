"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EVENT_CLASS,
  EVENT_END_MS,
  EVENT_FORCE_KEY,
  EVENT_OPTOUT_KEY,
  isEventActive,
  isEventAvailable,
} from "@/lib/event-theme";

/** Maximaler `setTimeout`-Wert (32-Bit-Signed-Millisekunden). */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Tab-internes Sync-Signal: das native `storage`-Event feuert nicht im Tab, der
 * die Änderung vorgenommen hat. Damit alle `useEventTheme`-Instanzen (Backdrop,
 * Banner, Einstellungen) im selben Tab sofort reagieren, broadcasten wir den
 * Toggle zusätzlich über dieses Custom-Event.
 */
const EVENT_CHANGE = "kontexto:event-theme-change";

interface EventThemeState {
  /** Event-Skin wird gerade angezeigt (Fenster läuft UND nicht abgewählt). */
  active: boolean;
  /** Event-Zeitfenster läuft. Steuert, ob der Opt-out-Schalter angeboten wird. */
  available: boolean;
  /** User-Präferenz: Event-Design eingeschaltet (nicht abgewählt). */
  enabled: boolean;
  /** Schaltet das Event-Design ein/aus und aktualisiert `<html>` live. */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Liest den Event-Status clientseitig und hält ihn mit `localStorage`
 * (auch tab-übergreifend via `storage`-Event) sowie dem Event-Ende synchron.
 *
 * Server und erster Client-Render liefern bewusst `active=false`, damit es
 * keinen Hydration-Mismatch gibt. Die rein CSS-getriebene Skin (Klasse auf
 * `<html>`) ist davon unberührt und bereits vor der Hydration sichtbar.
 */
export function useEventTheme(): EventThemeState {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    const sync = () => {
      setAvailable(isEventAvailable());
      let optedOut = false;
      try {
        optedOut = localStorage.getItem(EVENT_OPTOUT_KEY) === "off";
      } catch {
        optedOut = false;
      }
      setEnabledState(!optedOut);
    };
    sync();

    const onStorage = (e: StorageEvent) => {
      if (e.key === EVENT_OPTOUT_KEY || e.key === EVENT_FORCE_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_CHANGE, sync);

    // Läuft die Session über das Finale hinaus, deaktiviert sich die Skin selbst.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const untilEnd = EVENT_END_MS - Date.now();
    if (untilEnd > 0 && untilEnd <= MAX_TIMEOUT_MS) {
      timer = setTimeout(sync, untilEnd + 1000);
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_CHANGE, sync);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    try {
      if (next) localStorage.removeItem(EVENT_OPTOUT_KEY);
      else localStorage.setItem(EVENT_OPTOUT_KEY, "off");
    } catch {
      /* localStorage nicht verfügbar, UI-State unten genügt für diese Session */
    }
    setEnabledState(next);
    document.documentElement.classList.toggle(EVENT_CLASS, isEventActive());
    window.dispatchEvent(new Event(EVENT_CHANGE));
  }, []);

  return { active: available && enabled, available, enabled, setEnabled };
}
