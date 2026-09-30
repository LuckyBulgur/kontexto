import { test as base, expect, type BrowserContext } from "@playwright/test";

/**
 * Gemeinsame Test-Basis: Drittanbieter-Requests werden abgewiesen.
 *
 * Warum das noetig ist: Der AdSense-Loader steht seit August 2026 als echtes
 * <script async> im <head> (Googles Anleitung verlangt den Anzeigencode dort,
 * und vorher stand er ueberhaupt nicht im ausgelieferten HTML). Ein externes
 * Script in der initialen Antwort zaehlt zum load-Ereignis, und page.goto
 * wartet darauf. Damit haengt ohne diese Sperre jeder einzelne Test an der
 * Erreichbarkeit von pagead2.googlesyndication.com: Ist Google langsam, laeuft
 * die Navigation in ihren 30-Sekunden-Timeout, voellig unabhaengig von der
 * getesteten Aenderung. Genau diese Klasse Fehlschlag hat schon einen CI-Lauf
 * gekostet.
 *
 * Die Sperre ist bewusst breit: alles, was nicht an den lokalen E2E-Proxy geht,
 * wird abgebrochen. Die Anwendung selbst laedt nichts von aussen (Schriften
 * liegen im Export), ein Treffer ist also immer ein Drittanbieter.
 */
const THIRD_PARTY = /^https?:\/\/(?!127\.0\.0\.1|localhost)/;

/** The QA override of lib/event-theme.ts, EVENT_FORCE_KEY. */
export const EVENT_FORCE_KEY = "kontexto_event_theme_force";

/**
 * Seasonal skins stay off unless a spec asks for one.
 *
 * An event is gated by date alone, so without this a run in October would
 * test a different site than a run in September: another palette, a pumpkin
 * in the header, toasts over the page. The override is only written when the
 * key is absent, so a spec that wants an event sets its own value in a later
 * init script (see e2e/halloween.spec.ts) and keeps it across reloads.
 */
export async function disableSeasonalEvents(context: BrowserContext): Promise<void> {
  await context.addInitScript((key) => {
    try {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, "off");
    } catch {
      // Storage blocked: then no override can be read either, and the calendar decides.
    }
  }, EVENT_FORCE_KEY);
}

/**
 * For specs that build their own contexts (duel-realtime needs two isolated
 * players). The context fixture below does not reach those, because a context
 * made through `browser.newContext()` hangs off no fixture.
 */
export async function prepareContext(context: BrowserContext): Promise<void> {
  await context.route(THIRD_PARTY, (route) => route.abort());
  await disableSeasonalEvents(context);
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await prepareContext(context);
    await use(context);
  },
});

export { expect };
export type { Page } from "@playwright/test";
