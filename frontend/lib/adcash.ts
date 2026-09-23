/**
 * Adcash as the interim ad network until Google AdSense approves the site.
 *
 * Switch: `NEXT_PUBLIC_ADCASH_ENABLED`, inlined at build time. Anything but the
 * literal "false" leaves it on; the day AdSense approves, the deploy sets
 * "false" and the banner, the footer link, the slots and the loader disappear
 * together.
 *
 * Formats: display banners and the video slider, nothing else. A 160x600
 * skyscraper on each side from 1280px, a 728x90 bar at the bottom from 768px,
 * a 300x100 bar below that (Adcash offers no 320x50), a 300x250 rectangle
 * under the result of a finished round on every width, and the video slider,
 * a small muted video in a bottom corner with a close button, run once per
 * document on every width. Autotag is deliberately not run. Measured on
 * 2026-09-23 against zone l8rhgb60kc it rotates pop-under, interstitial,
 * in-page push and a video slider, and it loaded an advertiser landing page,
 * with that page's cookies, on page load without a click. Intrusive formats
 * like these are what the AdSense review rejects a site for.
 *
 * The legal pages and the consent banner describe these as categories
 * (banners and closable, muted video windows in marked areas; never pop-under,
 * full screen or a redirect without a click), not as a list of sizes, so a new
 * display zone or a moved area needs no new consent. A format outside those
 * categories does: bump `AD_CONSENT_VERSION` and rewrite the texts.
 *
 * Scope: every page a round is played on (`ADCASH_GAME_PATHS`,
 * `ADCASH_ROOM_PREFIXES`). Content, legal and admin pages stay free, and so
 * does the stream mode. The terms of use, the editorial principles, the FAQ,
 * the privacy policy and the cookie page state exactly that scope. It is
 * wider than the AdSense allowlist in `lib/adsense.ts` on purpose: that list
 * is what the AdSense review sees and stays at the two single-player pages.
 */

export const ADCASH_ENABLED = process.env.NEXT_PUBLIC_ADCASH_ENABLED !== "false";

/**
 * The Autotag zone Adcash created during onboarding. It exists only so that
 * the site verification finds the snippet in the served HTML (see
 * `ADCASH_VERIFICATION_TAG`); it is never executed.
 */
export const ADCASH_AUTOTAG_ZONE_ID = "l8rhgb60kc";

export type AdcashSlot = "railLeft" | "railRight" | "leaderboard" | "bottomBar" | "result";

/**
 * Display zones, one per size, created in the Adcash dashboard (Zones, Add
 * Zone, "manage ad formats manually", Display). The dashboard offers that only
 * once the site is verified, so the ids are entered here after verification.
 * Kept in code rather than in build variables for the same reason as
 * `ADSENSE_CLIENT_ID`: they are public, and the e2e suite reads them to know
 * which slots to expect. `null` renders no slot and loads nothing.
 *
 * Each id's size was read from Adcash itself (the `width`/`height` that
 * banner.php returns for the zone, 2026-09-23), not from the order the ids
 * were copied in: a 300x100 zone in a 160x600 slot was live once. The
 * leaderboard and result zones were created on 2026-09-24 and answered with
 * the empty 204 of a zone without a matching ad on that day, so their sizes
 * are the ones chosen in the dashboard and still have to be read back once
 * they serve.
 */
export const ADCASH_ZONES: Record<AdcashSlot, string | null> = {
  railLeft: "12211730", // 160x600
  railRight: "12211722", // 160x600
  leaderboard: "12212934", // 728x90
  bottomBar: "12211714", // 300x100
  result: "12212922", // 300x250
};

export const ADCASH_SLOT_SIZES: Record<AdcashSlot, { width: number; height: number }> = {
  railLeft: { width: 160, height: 600 },
  railRight: { width: 160, height: 600 },
  leaderboard: { width: 728, height: 90 },
  bottomBar: { width: 300, height: 100 },
  result: { width: 300, height: 250 },
};

/**
 * The video slider zone. It is not a slot: Adcash places the player itself,
 * fixed in a bottom corner above the page, and decides on its own when it
 * shows and whether it comes back after being closed (aclib.js asked
 * slider.php three times in twelve seconds in a probe on 2026-09-24).
 * `null` switches it off.
 */
export const ADCASH_VIDEO_SLIDER_ZONE: string | null = "12212898";

/**
 * Explicit https instead of the protocol-relative URL from the Adcash snippet:
 * the site is https only.
 */
export const ADCASH_SCRIPT_SRC = "https://acscdn.com/script/aclib.js";

/**
 * The onboarding snippet as it appears in the static HTML of every page: the
 * Adcash verification looks for it there. `type="text/plain"` is the blocking
 * pattern consent tools use. A browser neither fetches nor runs a script whose
 * type is not JavaScript (HTML spec, "prepare the script element": an
 * unsupported type returns before anything is fetched), so no visitor contacts
 * Adcash through it; `e2e/ad-consent.spec.ts` holds that. The library tag keeps
 * `id="aclib"` like the original, because aclib.js looks itself up by that id,
 * and `loadAdcash` replaces it with the live script after consent.
 */
export const ADCASH_VERIFICATION_TAG = {
  id: "aclib",
  src: "//acscdn.com/script/aclib.js",
  autotag: `aclib.runAutoTag({ zoneId: '${ADCASH_AUTOTAG_ZONE_ID}' });`,
} as const;

/**
 * Single-player pages and the two matchmaking queues, matched exactly.
 * Changing this list changes what the consent covers: bump
 * `AD_CONSENT_VERSION` and update the pages named at the top of this file.
 */
export const ADCASH_GAME_PATHS = [
  "/",
  "/wordle/",
  "/solo/leiter/",
  "/solo/limit/",
  "/solo/doppelziel/",
  "/solo/sudden-death/",
  "/suche/",
  "/wordle/suche/",
] as const;

/**
 * Multiplayer routes, matched with everything below them: the mode's landing
 * page, its create form and every room (`/duel/<id>/`). `/live/` is left out
 * deliberately. The host's board and the overlay are captured into a stream,
 * so an ad there is an impression for an audience that never saw the page,
 * which ad networks treat as invalid traffic.
 */
export const ADCASH_ROOM_PREFIXES = ["/duel/", "/koop/", "/arena/", "/wordle/duel/"] as const;

/**
 * Normalises the trailing slash, because `usePathname()` in a static export
 * can report a route with or without it.
 */
export function isAdcashPath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== "string" || pathname.length === 0) return false;
  if (pathname.includes("?") || pathname.includes("#")) return false;
  const normalised = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (ADCASH_GAME_PATHS.some((path) => path === normalised)) return true;
  return ADCASH_ROOM_PREFIXES.some((prefix) => normalised.startsWith(prefix));
}

interface AdcashLib {
  runBanner: (options: { zoneId: string; renderIn: string }) => void;
  runVideoSlider: (options: { zoneId: string }) => void;
}

declare global {
  interface Window {
    aclib?: AdcashLib;
  }
}

let loading: Promise<AdcashLib> | null = null;

/** Whether the live script was put into this document, which only a reload undoes. */
export function isAdcashLoaded(): boolean {
  return loading !== null;
}

/**
 * Loads aclib.js once per document. Callers guarantee consent and an eligible
 * path; this function guarantees idempotence, so a re-render or a Strict Mode
 * double effect never injects the script twice.
 *
 * No Subresource Integrity: Adcash updates aclib.js in place without versioned
 * URLs, so a pinned hash would switch the ads off on the next release. The
 * exposure is contained instead by loading only after consent and only on
 * the game pages.
 */
export function loadAdcash(): Promise<AdcashLib> {
  if (loading) return loading;
  loading = new Promise<AdcashLib>((resolve, reject) => {
    document.getElementById(ADCASH_VERIFICATION_TAG.id)?.remove();
    const script = document.createElement("script");
    script.id = "aclib";
    script.src = ADCASH_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.aclib) resolve(window.aclib);
      else reject(new Error("adcash_missing"));
    };
    // Blocked by an ad blocker or a DNS filter: the game must not notice.
    script.onerror = () => reject(new Error("adcash_blocked"));
    document.head.appendChild(script);
  });
  loading.catch(() => undefined);
  return loading;
}

/** Renders one display zone into the element with the given id. */
export async function runAdcashBanner(zoneId: string, elementId: string): Promise<void> {
  const lib = await loadAdcash();
  lib.runBanner({ zoneId, renderIn: `#${elementId}` });
}

let sliderStarted = false;

/**
 * Starts the video slider, at most once per document. Adcash keeps the player
 * alive across client-side navigation between game pages, and a second call
 * would stack a second player; leaving the game pages is a full reload
 * (`components/AdConsent.tsx`), which is what ends it.
 */
export async function runAdcashVideoSlider(zoneId: string): Promise<void> {
  if (sliderStarted) return;
  sliderStarted = true;
  const lib = await loadAdcash();
  lib.runVideoSlider({ zoneId });
}
