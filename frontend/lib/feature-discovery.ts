"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Einmalige Feature-Discovery-Hinweise (z. B. „NEU"-Markierungen für neue
 * Spielmodi), persistiert in localStorage.
 *
 * Die Persistenz-Helfer sind pur und nehmen das `Storage` als Parameter, damit
 * sie ohne DOM (node-Vitest-Umgebung) getestet werden können. Alle Zugriffe
 * sind in try/catch gekapselt: Im Privatmodus oder bei deaktivierten Cookies
 * kann `localStorage` werfen, dann fällt der Hinweis still auf „nicht
 * hervorgehoben" zurück, statt die App zu brechen.
 */

const DISCOVERED_VALUE = "1";

export function isFeatureDiscovered(storage: Storage | undefined, key: string): boolean {
  try {
    return storage?.getItem(key) === DISCOVERED_VALUE;
  } catch {
    return false;
  }
}

export function markFeatureDiscovered(storage: Storage | undefined, key: string): void {
  try {
    storage?.setItem(key, DISCOVERED_VALUE);
  } catch {
    // Persistenz ist optional, der Hinweis ist für diese Session bereits ausgeblendet.
  }
}

/**
 * Liefert `highlight` (ob der Hinweis gezeigt werden soll) und `dismiss` (um ihn
 * dauerhaft auszublenden).
 *
 * Start-State ist bewusst `false`, damit wiederkehrende (bereits informierte)
 * User beim Static-Export-Hydration kein Aufblitzen sehen. Erst der Effect liest
 * localStorage und hebt den Hinweis für noch-nicht-informierte User an.
 */
export function useFeatureDiscovery(key: string): {
  highlight: boolean;
  dismiss: () => void;
} {
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    const storage = typeof window === "undefined" ? undefined : window.localStorage;
    setHighlight(!isFeatureDiscovered(storage, key));
  }, [key]);

  const dismiss = useCallback(() => {
    setHighlight(false);
    const storage = typeof window === "undefined" ? undefined : window.localStorage;
    markFeatureDiscovered(storage, key);
  }, [key]);

  return { highlight, dismiss };
}
