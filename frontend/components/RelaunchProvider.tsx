"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useFeatureDiscovery } from "@/lib/feature-discovery";

/**
 * Gemeinsamer Zustand des Relaunch-Hinweises. Die Floating-Card ist global in
 * `app/layout.tsx` gemountet, der Menü-Eintrag liegt per-Page im `Header` – beide
 * lesen denselben Zustand über diesen Context, statt Props durch jede Seite zu
 * fädeln.
 *
 * Discovery (einmal-pro-Browser) läuft über `useFeatureDiscovery`; der Schlüssel
 * ist versioniert (`_v1`), damit eine künftige Ankündigung mit `_v2` usw. den
 * Hinweis erneut hervorhebt.
 */

const STORAGE_KEY = "kontexto_relaunch_notice_v1";

interface RelaunchContextValue {
  /** Noch nicht gesehen → NEU-Markierung anzeigen. */
  highlight: boolean;
  /** Desktop: Card ausgeklappt (true) vs. zum Button minimiert (false). */
  expanded: boolean;
  /** Mobile: Dialog offen. Wird nie automatisch gesetzt. */
  mobileOpen: boolean;
  /** Desktop: Card aus dem Button ausklappen. */
  expand: () => void;
  /** Desktop: Card zum Button minimieren und als gesehen markieren. */
  minimize: () => void;
  /** Mobile: Dialog öffnen (per Menü-Eintrag). */
  openMobile: () => void;
  /** Mobile: Dialog schließen und als gesehen markieren. */
  closeMobile: () => void;
}

const RelaunchContext = createContext<RelaunchContextValue | null>(null);

export function RelaunchProvider({ children }: { children: ReactNode }) {
  const { highlight, dismiss } = useFeatureDiscovery(STORAGE_KEY);
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Erstbesuch (noch nicht gesehen): Desktop-Card automatisch ausklappen. Start-State
  // ist bewusst `false`, damit wiederkehrende User beim Static-Export-Hydration kein
  // Aufblitzen sehen – erst dieser Effect (nach localStorage-Lesen) klappt aus.
  useEffect(() => {
    if (highlight) setExpanded(true);
  }, [highlight]);

  const expand = useCallback(() => setExpanded(true), []);
  const minimize = useCallback(() => {
    setExpanded(false);
    dismiss();
  }, [dismiss]);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    dismiss();
  }, [dismiss]);

  const value = useMemo<RelaunchContextValue>(
    () => ({ highlight, expanded, mobileOpen, expand, minimize, openMobile, closeMobile }),
    [highlight, expanded, mobileOpen, expand, minimize, openMobile, closeMobile],
  );

  return <RelaunchContext.Provider value={value}>{children}</RelaunchContext.Provider>;
}

export function useRelaunch(): RelaunchContextValue {
  const ctx = useContext(RelaunchContext);
  if (!ctx) {
    throw new Error("useRelaunch muss innerhalb von <RelaunchProvider> verwendet werden.");
  }
  return ctx;
}
