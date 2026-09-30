"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  EVENT_FORCE_KEY,
  SEASONAL_EVENTS,
  applyEventClass,
  availableEvent,
  type SeasonalEvent,
} from "@/lib/event-theme";

/** Largest `setTimeout` delay (signed 32-bit milliseconds). */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * In-tab sync signal. The native `storage` event does not fire in the tab that
 * made the change, so every `useEventTheme` instance in the same tab (runtime,
 * settings, header) listens to this custom event as well.
 */
const EVENT_CHANGE = "kontexto:event-theme-change";

interface EventThemeState {
  /** The event whose window is open, whether or not the player switched it off. */
  event: SeasonalEvent | null;
  /** The skin is showing: window open and not switched off. */
  active: boolean;
  /** An event window is open. Decides whether the switch is offered. */
  available: boolean;
  /** Player preference for the open event: not switched off. */
  enabled: boolean;
  /** Switches the open event on or off and updates `<html>` at once. */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Reads the event state on the client and keeps it in sync with localStorage
 * (across tabs through the `storage` event), with the end of the window and
 * with client-side navigation into an excluded path.
 *
 * The server and the first client render deliberately return an inactive
 * state so there is no hydration mismatch. The CSS skin (class on `<html>`) is
 * unaffected by that: it is already visible before hydration.
 */
export function useEventTheme(): EventThemeState {
  const pathname = usePathname();
  const [event, setEvent] = useState<SeasonalEvent | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    // The class on `<html>` is what the player sees, so it is also what the
    // switch reports. Storage decides the class; a blocked storage then still
    // yields a switch that matches the page.
    const sync = () => {
      const ev = availableEvent(Date.now(), window.location.pathname);
      setEvent(ev);
      setActive(ev !== null && document.documentElement.classList.contains(ev.className));
    };
    applyEventClass(window.location.pathname);
    sync();

    const onStorage = (e: StorageEvent) => {
      if (e.key === EVENT_FORCE_KEY || SEASONAL_EVENTS.some((ev) => ev.optOutKey === e.key)) {
        applyEventClass();
        sync();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_CHANGE, sync);

    // A session that outlives the window switches the skin off by itself, and
    // one that is open when the window opens switches it on.
    const now = Date.now();
    const boundaries = SEASONAL_EVENTS.flatMap((e) => [e.startMs, e.endMs]).filter((t) => t > now);
    const next = boundaries.length > 0 ? Math.min(...boundaries) : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (next !== null && next - now <= MAX_TIMEOUT_MS) {
      timer = setTimeout(() => {
        applyEventClass();
        sync();
      }, next - now + 1000);
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_CHANGE, sync);
      if (timer) clearTimeout(timer);
    };
  }, [pathname]);

  const setEnabled = useCallback(
    (next: boolean) => {
      if (!event) return;
      try {
        if (next) localStorage.removeItem(event.optOutKey);
        else localStorage.setItem(event.optOutKey, "off");
      } catch {
        // Storage blocked: the class below still applies for this page view.
      }
      document.documentElement.classList.toggle(event.className, next);
      window.dispatchEvent(new Event(EVENT_CHANGE));
    },
    [event],
  );

  return {
    event,
    active,
    available: event !== null,
    enabled: active,
    setEnabled,
  };
}
