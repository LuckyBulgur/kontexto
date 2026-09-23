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

/**
 * Records a refusal in the ad consent banner before any page script runs, so
 * the banner (fixed to the bottom of every page) does not cover what a spec
 * clicks. Only when nothing is stored yet, which keeps a spec that writes its
 * own decision, or clears storage and reloads, in control. The banner itself is
 * covered by `ad-consent.spec.ts`, which opts out through `adConsent: "unset"`.
 */
export async function presetAdConsent(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      if (window.localStorage.getItem("kontexto_ad_consent") === null) {
        window.localStorage.setItem(
          "kontexto_ad_consent",
          JSON.stringify({ v: 1, choice: "denied", at: new Date().toISOString() }),
        );
      }
    } catch {
      // Storage blocked: the banner then shows, which is the real behaviour.
    }
  });
}

export const test = base.extend<{ adConsent: "preset" | "unset" }>({
  adConsent: ["preset", { option: true }],
  context: async ({ context, adConsent }, use) => {
    await blockThirdParty(context);
    if (adConsent === "preset") await presetAdConsent(context);
    await use(context);
  },
});

export { expect };
export type { Page } from "@playwright/test";
