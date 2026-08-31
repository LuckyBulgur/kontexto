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

/**
 * Fuer Specs, die sich eigene Kontexte bauen (duel-realtime braucht zwei
 * isolierte Spieler). Die context-Fixture unten greift dort nicht, weil ein
 * ueber `browser.newContext()` erzeugter Kontext an keiner Fixture haengt.
 */
export async function blockThirdParty(context: BrowserContext): Promise<void> {
  await context.route(THIRD_PARTY, (route) => route.abort());
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await blockThirdParty(context);
    await use(context);
  },
});

export { expect };
