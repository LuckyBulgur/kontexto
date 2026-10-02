"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The streamer's switch "Nächste Runde automatisch starten".
 *
 * Off by default: a streamer who talks about the word after a round needs the
 * board to stay. Once on, the result card counts down and the room moves on by
 * itself, so a long stream does not stop every time nobody is at the keyboard.
 *
 * One key for every live room on this browser, because it is a decision about
 * how somebody streams, not about one round. `useSyncExternalStore` keeps the
 * two copies of the sidebar (one per breakpoint) and the create form on the
 * same value. Storage can be blocked (private window, cleared site data), so
 * the value also lives in memory: the switch then still works for this tab.
 */

export const AUTO_NEXT_STORAGE_KEY = "kontexto_live_auto_next";
const AUTO_NEXT_CHANGE = "kontexto:live-auto-next-change";

/** How long the result stays before the next round starts by itself. */
export const AUTO_NEXT_DELAY_MS = 10_000;

/** Whole seconds left until `deadline`, rounded up so the card never reads 0
 *  while it is still waiting. Never negative. */
export function autoNextSecondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

let memory: boolean | null = null;

function readEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(AUTO_NEXT_STORAGE_KEY);
    if (stored !== null) return stored === "on";
  } catch {
    // Storage blocked: the value of this tab applies.
  }
  return memory ?? false;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === AUTO_NEXT_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTO_NEXT_CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTO_NEXT_CHANGE, onChange);
  };
}

const serverSnapshot = () => false;

export function useAutoNextSetting(): { enabled: boolean; setEnabled: (next: boolean) => void } {
  const enabled = useSyncExternalStore(subscribe, readEnabled, serverSnapshot);

  const setEnabled = useCallback((next: boolean) => {
    memory = next;
    try {
      if (next) window.localStorage.setItem(AUTO_NEXT_STORAGE_KEY, "on");
      else window.localStorage.removeItem(AUTO_NEXT_STORAGE_KEY);
    } catch {
      // Storage blocked: the switch holds for this tab only.
    }
    window.dispatchEvent(new Event(AUTO_NEXT_CHANGE));
  }, []);

  return { enabled, setEnabled };
}
