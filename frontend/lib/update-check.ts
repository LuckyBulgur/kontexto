/**
 * Notices a deploy in an open tab and brings the page up to date.
 *
 * Every image carries its commit as `NEXT_PUBLIC_BUILD_ID` (Dockerfile, set by
 * deploy.yml) and serves it again as `/version.json` (`app/version.json/route.ts`).
 * The open page asks for that file now and then; a different id means a new
 * version is live, and the page reloads. Without this a tab opened before a
 * push kept running the old code until somebody reloaded it by hand, and its
 * next chunk request could point at a file the new image no longer has.
 *
 * While the container is being replaced the server does not answer for a few
 * seconds. Two failed checks in a row with the browser online read as that, and
 * the page says an update is running instead of looking broken; the notice
 * stays until the server answers again, then the page reloads, or the notice
 * goes away when the answer carries the old id (it was a blip, not a deploy).
 *
 * This file is the decision only, no DOM and no clock, so it is testable;
 * `components/UpdateWatcher.tsx` drives it.
 */

/** The id a local or e2e build carries. The watcher stays off for it. */
export const DEV_BUILD_ID = "dev";

export const BUILD_ID: string = process.env.NEXT_PUBLIC_BUILD_ID || DEV_BUILD_ID;

/** How often a visible tab asks, and how often while the server is away. */
export const CHECK_INTERVAL_MS = 20_000;
export const OUTAGE_INTERVAL_MS = 3_000;
/** How long "Neue Version" stands before the reload, so it can be read. */
export const RELOAD_DELAY_MS = 2_500;
/** Failed checks in a row before the page says an update is running. */
export const FAILURES_FOR_NOTICE = 2;

export type UpdatePhase =
  /** Nothing to say. */
  | "idle"
  /** The server is away, most likely a deploy. The notice shows. */
  | "updating"
  /** A new version answered. The notice shows and the page reloads. */
  | "reloading";

export interface UpdateState {
  phase: UpdatePhase;
  failures: number;
}

export const INITIAL_UPDATE_STATE: UpdateState = { phase: "idle", failures: 0 };

export type CheckResult =
  | { kind: "ok"; build: string }
  /** No answer, or an answer that was not a version (a 502 page from the proxy). */
  | { kind: "failed"; online: boolean };

export function nextUpdateState(state: UpdateState, result: CheckResult, current: string = BUILD_ID): UpdateState {
  if (state.phase === "reloading") return state;
  if (result.kind === "ok") {
    if (result.build !== current) return { phase: "reloading", failures: 0 };
    return INITIAL_UPDATE_STATE;
  }
  // Offline is the player's own network, not a deploy: say nothing.
  if (!result.online) return { phase: state.phase === "updating" ? "updating" : "idle", failures: 0 };
  const failures = state.failures + 1;
  return { phase: failures >= FAILURES_FOR_NOTICE ? "updating" : state.phase, failures };
}

/** Reads the body of `/version.json`; anything else counts as a failed check. */
export function parseVersion(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const build = (body as { build?: unknown }).build;
  return typeof build === "string" && build.length > 0 && build.length <= 100 ? build : null;
}
