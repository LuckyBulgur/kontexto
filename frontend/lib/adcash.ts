/**
 * Adcash as the interim ad network until Google AdSense approves the site.
 *
 * Switch: `NEXT_PUBLIC_ADCASH_ENABLED`, inlined at build time. Anything but the
 * literal "false" leaves it on; the day AdSense approves, the deploy sets
 * "false" and the banner, the footer link, the slots and the loader disappear
 * together.
 *
 * Formats: display banners only, a 160x600 skyscraper on each side from `xl`
 * up and one 300x100 bar at the bottom below that (Adcash offers no 320x50).
 * Autotag is deliberately not run. Measured on 2026-09-23 against zone
 * l8rhgb60kc it rotates pop-under, interstitial, in-page push and a video
 * slider, and it loaded an advertiser landing page, with that page's cookies,
 * on page load without a click. Intrusive formats like these are what the
 * AdSense review rejects a site for.
 *
 * Scope: the same two single-player pages that the AdSense allowlist names.
 * The terms of use, the editorial principles and the FAQ promise exactly that.
 */

import { AD_ELIGIBLE_PATHS } from "@/lib/adsense";

export const ADCASH_ENABLED = process.env.NEXT_PUBLIC_ADCASH_ENABLED !== "false";

/**
 * The Autotag zone Adcash created during onboarding. It exists only so that
 * the site verification finds the snippet in the served HTML (see
 * `ADCASH_VERIFICATION_TAG`); it is never executed.
 */
export const ADCASH_AUTOTAG_ZONE_ID = "l8rhgb60kc";

export type AdcashSlot = "railLeft" | "railRight" | "bottomBar";

/**
 * Display zones, one per size, created in the Adcash dashboard (Zones, Add
 * Zone, "manage ad formats manually", Display). The dashboard offers that only
 * once the site is verified, so the ids are entered here after verification.
 * Kept in code rather than in build variables for the same reason as
 * `ADSENSE_CLIENT_ID`: they are public, and the e2e suite reads them to know
 * which slots to expect. `null` renders no slot and loads nothing.
 */
export const ADCASH_ZONES: Record<AdcashSlot, string | null> = {
  railLeft: "12211714",
  railRight: "12211722",
  bottomBar: "12211730",
};

export const ADCASH_SLOT_SIZES: Record<AdcashSlot, { width: number; height: number }> = {
  railLeft: { width: 160, height: 600 },
  railRight: { width: 160, height: 600 },
  bottomBar: { width: 300, height: 100 },
};

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
 * Normalises the trailing slash, because `usePathname()` in a static export
 * can report a route with or without it.
 */
export function isAdcashPath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== "string" || pathname.length === 0) return false;
  if (pathname.includes("?") || pathname.includes("#")) return false;
  const normalised = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return AD_ELIGIBLE_PATHS.some((path) => path === normalised);
}

interface AdcashLib {
  runBanner: (options: { zoneId: string; renderIn: string }) => void;
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
 * exposure is contained instead by loading only after consent and only on two
 * pages.
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
