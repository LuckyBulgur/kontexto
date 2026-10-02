"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  BUILD_ID,
  CHECK_INTERVAL_MS,
  DEV_BUILD_ID,
  INITIAL_UPDATE_STATE,
  OUTAGE_INTERVAL_MS,
  RELOAD_DELAY_MS,
  type CheckResult,
  type UpdateState,
  nextUpdateState,
  parseVersion,
} from "@/lib/update-check";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Keeps an open tab on the deployed version (`lib/update-check.ts`).
 *
 * Asks `/version.json` every CHECK_INTERVAL_MS while the tab is visible, at
 * once when it becomes visible or the browser comes back online, and every
 * OUTAGE_INTERVAL_MS while the server is away. When an update runs or a new
 * version is there, a notice stands in the middle of the screen until the page
 * reloads: it has no close button on purpose, because the page behind it is
 * about to be replaced. A new version reloads the page only once `/api` answers
 * as well, so a room page does not come back into a backend still starting. Off for a local or e2e build, which carry no build id.
 */
async function check(): Promise<CheckResult> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    const build = response.ok ? parseVersion(await response.json()) : null;
    if (!build) return { kind: "failed", online: navigator.onLine };
    // nginx serves the new version.json before the API workers have loaded
    // their data. A reload in that window met a 502 on every room load, so a
    // new version counts only once the API answers too; until then the check
    // reads as the server being away and the notice keeps waiting.
    if (build !== BUILD_ID && !(await apiReady())) return { kind: "failed", online: navigator.onLine };
    return { kind: "ok", build };
  } catch {
    return { kind: "failed", online: navigator.onLine };
  }
}

async function apiReady(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/game?t=${Date.now()}`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export default function UpdateWatcher() {
  const [state, setState] = useState<UpdateState>(INITIAL_UPDATE_STATE);
  const stateRef = useRef(state);

  useEffect(() => {
    if (BUILD_ID === DEV_BUILD_ID) return;
    let timer: number | undefined;
    let running = false;
    let stopped = false;

    const schedule = () => {
      window.clearTimeout(timer);
      if (stopped || stateRef.current.phase === "reloading") return;
      if (stateRef.current.phase === "updating") {
        timer = window.setTimeout(run, OUTAGE_INTERVAL_MS);
      } else if (document.visibilityState === "visible") {
        timer = window.setTimeout(run, CHECK_INTERVAL_MS);
      }
    };

    const run = async () => {
      if (running || stopped) return;
      running = true;
      const result = await check();
      running = false;
      if (stopped) return;
      const next = nextUpdateState(stateRef.current, result);
      stateRef.current = next;
      setState(next);
      if (next.phase === "reloading") {
        window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
        return;
      }
      schedule();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
      else schedule();
    };
    const onOnline = () => void run();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    schedule();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (state.phase === "idle") return null;
  const reloading = state.phase === "reloading";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-4">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl bg-card px-6 py-7 text-center shadow-lg"
      >
        <Loader2 aria-hidden="true" className="size-8 animate-spin text-primary" />
        <p className="font-display text-h3 text-foreground">
          {reloading ? "Neue Version ist da" : "Kontexto wird gerade aktualisiert"}
        </p>
        <p className="text-body text-muted-foreground">
          {reloading
            ? "Die Seite lädt in wenigen Sekunden neu."
            : "Einen Moment, gleich geht es weiter. Die Seite lädt dann von selbst neu."}
        </p>
      </div>
    </div>
  );
}
