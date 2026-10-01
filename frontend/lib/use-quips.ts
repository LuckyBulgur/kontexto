"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The player's switch for the quip layer (`lib/quips.ts`).
 *
 * Stored as an opt-out: the key is absent while the quips are on, which is the
 * default, and reads "off" once a player switched them off. One key for
 * Kontexto and Wordle, because it is one decision about how the game talks.
 *
 * `useSyncExternalStore` instead of state plus effect: the static export
 * renders the server snapshot (on), the client then reads storage, and every
 * consumer in the tab (the settings switch, the game, the result card) reads
 * the same value without threading a prop through the page clients. The
 * native `storage` event covers other tabs, a custom event covers this one.
 */

export const QUIPS_STORAGE_KEY = "kontexto_quips";
const QUIPS_CHANGE = "kontexto:quips-change";

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(QUIPS_STORAGE_KEY) !== "off";
  } catch {
    // Storage blocked: the default applies.
    return true;
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUIPS_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(QUIPS_CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(QUIPS_CHANGE, onChange);
  };
}

const serverSnapshot = () => true;

export function useQuips(): { enabled: boolean; setEnabled: (next: boolean) => void } {
  const enabled = useSyncExternalStore(subscribe, readEnabled, serverSnapshot);

  const setEnabled = useCallback((next: boolean) => {
    try {
      if (next) window.localStorage.removeItem(QUIPS_STORAGE_KEY);
      else window.localStorage.setItem(QUIPS_STORAGE_KEY, "off");
    } catch {
      // Storage blocked: nothing persists, and the switch keeps showing the default.
    }
    window.dispatchEvent(new Event(QUIPS_CHANGE));
  }, []);

  return { enabled, setEnabled };
}
