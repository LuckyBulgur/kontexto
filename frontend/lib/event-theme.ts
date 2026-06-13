/**
 * WM-2026-Event-Skin — Single Source of Truth für das zeitlich begrenzte
 * Fußball-WM-Event (FIFA World Cup 2026, 11.06.–19.07.2026).
 *
 * Das Event ist rein clientseitig datums-gegatet und schaltet sich nach dem
 * Finale von selbst ab — ohne Deploy. Aktivierung = Klasse `event-wm` auf
 * `<html>`, vor der Hydration durch {@link EVENT_THEME_SCRIPT} gesetzt, damit
 * kein Flash entsteht. Sämtliche Event-Styles in `globals.css` und alle
 * `event:`-Tailwind-Varianten hängen an dieser Klasse, sodass die komplette
 * Skin nach Ablauf automatisch verschwindet.
 *
 * Zeitfenster in UTC ausgedrückt (Europe/Berlin = CEST/UTC+2 im Sommer),
 * damit es keine Zeitzonen-Mehrdeutigkeit gibt:
 *   Start  11.06.2026 00:00 Berlin → 10.06.2026 22:00 UTC
 *   Ende   20.07.2026 00:00 Berlin → 19.07.2026 22:00 UTC (exklusiv)
 */
export const EVENT_START_MS = Date.UTC(2026, 5, 10, 22, 0, 0);
export const EVENT_END_MS = Date.UTC(2026, 6, 19, 22, 0, 0);

/** localStorage-Keys. */
export const EVENT_OPTOUT_KEY = "kontexto_event_theme"; // Wert "off" = User-Opt-out
export const EVENT_FORCE_KEY = "kontexto_event_theme_force"; // "on"/"off" — QA-Override, undokumentiert
export const EVENT_NOTICE_KEY = "kontexto_wm2026_notice"; // Wert "dismissed" = Banner ausgeblendet

/** CSS-Klasse, die das Event aktiviert. */
export const EVENT_CLASS = "event-wm";

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Ob das Event-Zeitfenster läuft — unabhängig vom User-Opt-out. Steuert, ob der
 * „WM-Design"-Schalter in den Einstellungen überhaupt angeboten wird (sonst
 * könnte sich der User aussperren). Berücksichtigt den QA-Force-Override.
 */
export function isEventAvailable(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  const force = readKey(EVENT_FORCE_KEY);
  if (force === "on") return true;
  if (force === "off") return false;
  return now >= EVENT_START_MS && now < EVENT_END_MS;
}

/**
 * Ob die Event-Skin tatsächlich angezeigt werden soll: Zeitfenster läuft UND
 * der User hat nicht abgewählt. Force-Override schlägt beides.
 */
export function isEventActive(now: number = Date.now()): boolean {
  const force = readKey(EVENT_FORCE_KEY);
  if (force === "on") return true;
  if (force === "off") return false;
  return isEventAvailable(now) && readKey(EVENT_OPTOUT_KEY) !== "off";
}

/**
 * Selbst-enthaltener IIFE-String, der vor der Hydration in `<head>` läuft und
 * `event-wm` an `<html>` hängt. Wird per Template-Literal aus denselben
 * Konstanten gebaut (DRY) — kein Import zur Laufzeit möglich.
 */
export const EVENT_THEME_SCRIPT = `(function(){try{var f=localStorage.getItem("${EVENT_FORCE_KEY}");var a;if(f==="on"){a=true}else if(f==="off"){a=false}else{var n=Date.now();a=n>=${EVENT_START_MS}&&n<${EVENT_END_MS}&&localStorage.getItem("${EVENT_OPTOUT_KEY}")!=="off"}if(a){document.documentElement.classList.add("${EVENT_CLASS}")}}catch(e){}})()`;
