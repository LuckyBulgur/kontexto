import { test as base, expect, type BrowserContext } from "@playwright/test";

/**
 * Shared test base: every third-party request is aborted.
 *
 * The app loads nothing from outside on its own (fonts ship in the export), so
 * a request that does not go to the local e2e proxy is always a third party:
 * the Ko-fi frame behind the support button, a Twitch badge, a link a test
 * follows by accident. Letting one through ties a spec to that service's
 * uptime, and an external resource in the initial response delays the load
 * event that page.goto waits for. That class of failure has cost a CI run
 * before, back when the AdSense loader sat in <head>.
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

/** The opt-out key of lib/use-quips.ts, QUIPS_STORAGE_KEY. */
export const QUIPS_KEY = "kontexto_quips";

/**
 * Quips stay off unless a spec asks for them (e2e/quips.spec.ts).
 *
 * They are on by default for players, but every other spec asserts the plain
 * copy ("Wort bereits geraten", "Genial!", "Danke."), which is what the game
 * shows with the switch off. Written only when the key is absent, so a spec
 * sets it to "on" in a later init script and keeps that across reloads.
 */
export async function disableQuips(context: BrowserContext): Promise<void> {
  await context.addInitScript((key) => {
    try {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, "off");
    } catch {
      // Storage blocked: the quips show, and only quips.spec.ts relies on either.
    }
  }, QUIPS_KEY);
}

/** The QA switch of lib/easter-eggs/play.ts, EGGS_FORCE_KEY. Not a player setting. */
export const EGGS_FORCE_KEY = "kontexto_eggs_force";

/**
 * Easter eggs stay off unless a spec asks for them (e2e/easter-eggs.spec.ts).
 *
 * Some two thousand words carry one, so ordinary specs would type into flying
 * pictures, air horns and a shaking page, and every screenshot would depend on
 * which word a spec happened to use. Written only when the key is absent, so a
 * spec that removes it in a later init script keeps the eggs.
 */
export async function disableEasterEggs(context: BrowserContext): Promise<void> {
  await context.addInitScript((key) => {
    try {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, "off");
    } catch {
      // Storage blocked: the eggs play, and only easter-eggs.spec.ts relies on either.
    }
  }, EGGS_FORCE_KEY);
}

/**
 * For specs that build their own contexts (duel-realtime needs two isolated
 * players). The context fixture below does not reach those, because a context
 * made through `browser.newContext()` hangs off no fixture.
 */
export async function prepareContext(context: BrowserContext): Promise<void> {
  await context.route(THIRD_PARTY, (route) => route.abort());
  await disableSeasonalEvents(context);
  await disableQuips(context);
  await disableEasterEggs(context);
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await prepareContext(context);
    await use(context);
  },
});

export { expect };
export type { Page } from "@playwright/test";
