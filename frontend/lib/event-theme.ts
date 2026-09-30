/**
 * Seasonal event skins: the single source of truth for every limited-time
 * theme the site runs.
 *
 * An event is gated on the client by date alone and switches itself off when
 * its window closes, with no deploy. It is active when its class sits on
 * `<html>`; the class is set before hydration by {@link EVENT_THEME_SCRIPT}, so
 * the skin never flashes in after first paint. Every event style in
 * `app/globals.css` and every `halloween:` Tailwind variant hangs off that
 * class, which is what makes the whole skin disappear when the window closes.
 *
 * Windows are written as UTC timestamps so there is no time zone ambiguity.
 * The events are defined in Europe/Berlin, the site's calendar.
 *
 * The WM-2026 skin that introduced this mechanism ran 2026-06-11 to
 * 2026-07-19 and was removed on 2026-10-01; its opt-out and notice keys are
 * cleared by {@link clearRetiredEventStorage}.
 */

export type SeasonalEventId = "spooktober-2026";

export interface SeasonalEvent {
  id: SeasonalEventId;
  /** Class on `<html>` that switches the skin on. */
  className: string;
  /** Inclusive start, UTC milliseconds. */
  startMs: number;
  /** Exclusive end, UTC milliseconds. */
  endMs: number;
  /**
   * localStorage key whose value `"off"` records the player's opt-out. One key
   * per event: a player who switched one event off has not switched off the
   * next one.
   */
  optOutKey: string;
  /** Label of the switch in the settings dialog. */
  settingsLabel: string;
  /** One line under the switch. */
  settingsHint: string;
}

/**
 * Spooktober 2026, the whole of October in Berlin time.
 *   Start 2026-10-01 00:00 CEST (UTC+2) -> 2026-09-30 22:00 UTC
 *   End   2026-11-01 00:00 CET  (UTC+1) -> 2026-10-31 23:00 UTC (exclusive)
 * Daylight saving time ends on 2026-10-25, hence the different offsets.
 */
export const SPOOKTOBER_2026: SeasonalEvent = {
  id: "spooktober-2026",
  className: "event-halloween",
  startMs: Date.UTC(2026, 8, 30, 22, 0, 0),
  endMs: Date.UTC(2026, 9, 31, 23, 0, 0),
  optOutKey: "kontexto_event_off_spooktober_2026",
  settingsLabel: "Halloween-Design",
  settingsHint: "Gruseliges Aussehen, ein Kürbis voller Süßigkeiten und 13 Geheimnisse. Nur bis 31. Oktober.",
};

/** Every event the site knows, newest first. */
export const SEASONAL_EVENTS: readonly SeasonalEvent[] = [SPOOKTOBER_2026];

/**
 * QA override, deliberately undocumented in the UI. `"off"` suppresses every
 * event, an event id forces that event regardless of date and opt-out, and
 * `"on"` forces the newest event. The e2e suite sets `"off"` by default so a
 * run in October does not see a different site than a run in September.
 */
export const EVENT_FORCE_KEY = "kontexto_event_theme_force";

/**
 * Paths that never carry a skin. The admin dashboard is a tool, and the OBS
 * overlay must stay transparent over a stream: its page hides every child of
 * `<body>` but cannot hide a pseudo-element or a page background.
 */
export const EVENT_EXCLUDED_PATHS: readonly string[] = ["/admin", "/live/overlay"];

/** Keys the retired WM-2026 skin left in players' storage. */
const RETIRED_EVENT_KEYS = ["kontexto_event_theme", "kontexto_wm2026_notice"] as const;

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function isExcludedPath(pathname: string): boolean {
  return EVENT_EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

/**
 * The event forced by the QA override: an event, `null` for "forced off", or
 * `undefined` when there is no (recognised) override.
 */
function forcedEvent(): SeasonalEvent | null | undefined {
  const force = readKey(EVENT_FORCE_KEY);
  if (force === null) return undefined;
  if (force === "off") return null;
  if (force === "on") return SEASONAL_EVENTS[0] ?? null;
  return SEASONAL_EVENTS.find((e) => e.id === force);
}

function inWindow(event: SeasonalEvent, now: number): boolean {
  return now >= event.startMs && now < event.endMs;
}

/**
 * The event whose window is open (or that the override forces), regardless of
 * the player's opt-out. Decides whether the settings dialog offers the switch
 * at all, because a player must always be able to switch it back on.
 */
export function availableEvent(now: number = Date.now(), pathname: string = currentPath()): SeasonalEvent | null {
  if (typeof window === "undefined") return null;
  if (isExcludedPath(pathname)) return null;
  const forced = forcedEvent();
  if (forced !== undefined) return forced;
  return SEASONAL_EVENTS.find((e) => inWindow(e, now)) ?? null;
}

/**
 * The event whose skin is shown: its window is open and the player has not
 * switched it off. The override beats both.
 */
export function activeEvent(now: number = Date.now(), pathname: string = currentPath()): SeasonalEvent | null {
  if (typeof window === "undefined") return null;
  if (isExcludedPath(pathname)) return null;
  const forced = forcedEvent();
  if (forced !== undefined) return forced;
  const event = SEASONAL_EVENTS.find((e) => inWindow(e, now));
  if (!event) return null;
  return readKey(event.optOutKey) === "off" ? null : event;
}

/**
 * Whether an event's skin is showing in this page: its class sits on `<html>`.
 * The runtime source of truth for effects, because it also reflects a switch
 * whose storage write failed and a page the head script excluded.
 */
export function isSkinOn(event: SeasonalEvent): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains(event.className);
}

/**
 * Brings the classes on `<html>` in line with {@link activeEvent}. Called when
 * the player flips the switch and when a client-side navigation crosses into
 * or out of an excluded path.
 */
export function applyEventClass(pathname: string = currentPath(), now: number = Date.now()): void {
  if (typeof document === "undefined") return;
  const active = activeEvent(now, pathname);
  for (const event of SEASONAL_EVENTS) {
    document.documentElement.classList.toggle(event.className, active?.id === event.id);
  }
}

/** Removes the keys of retired events. Safe to call on every page load. */
export function clearRetiredEventStorage(storage: Pick<Storage, "removeItem">): void {
  for (const key of RETIRED_EVENT_KEYS) storage.removeItem(key);
}

/**
 * Self-contained IIFE that runs in `<head>` before hydration and puts the
 * active event's class on `<html>`. Built from the same constants as the
 * functions above (a module cannot be imported at that point), and it
 * implements exactly the rules of {@link activeEvent}; `lib/event-theme.test.ts`
 * holds the two against each other.
 */
export const EVENT_THEME_SCRIPT = `(function(){try{var p=location.pathname;var x=${JSON.stringify(
  EVENT_EXCLUDED_PATHS,
)};for(var i=0;i<x.length;i++){if(p===x[i]||p.indexOf(x[i]+"/")===0)return}var E=${JSON.stringify(
  SEASONAL_EVENTS.map((e) => ({ i: e.id, c: e.className, s: e.startMs, e: e.endMs, o: e.optOutKey })),
)};var f=localStorage.getItem("${EVENT_FORCE_KEY}");var h=document.documentElement.classList;if(f==="off")return;for(var j=0;j<E.length;j++){if(f===E[j].i||(f==="on"&&j===0)){h.add(E[j].c);return}}var n=Date.now();for(var k=0;k<E.length;k++){var v=E[k];if(n>=v.s&&n<v.e){if(localStorage.getItem(v.o)!=="off")h.add(v.c);return}}}catch(e){}})()`;
