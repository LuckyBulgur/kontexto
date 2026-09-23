/**
 * The visitor's decision about Adcash advertising, stored in this browser only.
 *
 * Why a consent record of our own and not a TCF string: Adcash is not listed in
 * the IAB Global Vendor List (checked against GVL v3, version 177, 2026-09-17),
 * and its script reads no consent signal (`__tcfapi` never appears in aclib.js).
 * A TCF CMP could not tell Adcash anything, so the only effective control is not
 * to load the script at all until the visitor has said yes.
 *
 * Storing the decision itself is strictly necessary for the service the visitor
 * asked for (remembering their answer), so it needs no consent of its own
 * (§ 25 Abs. 2 Nr. 2 TDDDG). The record holds the choice, the text version it
 * was given for and the time, and nothing that identifies the visitor.
 *
 * A decision is asked again only for a reason: when the consent text changes
 * (bump `AD_CONSENT_VERSION`) or after twelve months. A refusal is kept exactly
 * as long as a grant, so declining does not bring the banner back sooner, and a
 * refusal survives a version bump: a wider scope needs a new yes, but it cannot
 * turn a no into a question again (DSK guidance for digital services: after a
 * refusal the banner stays away for a reasonable time).
 */

export const AD_CONSENT_KEY = "kontexto_ad_consent";

/**
 * Version of the text the visitor agreed to. Bump it whenever the banner or the
 * privacy policy changes what is processed, by whom or for which purpose: a
 * consent covers only what the visitor was told.
 */
export const AD_CONSENT_VERSION = 2;

/** Twelve months, after which the question is asked again. */
export const AD_CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type AdConsentChoice = "granted" | "denied";

export interface AdConsentRecord {
  v: number;
  choice: AdConsentChoice;
  /** ISO timestamp of the decision. */
  at: string;
}

const CHANGE_EVENT = "kontexto:ad-consent";
const REOPEN_EVENT = "kontexto:ad-consent-reopen";

function isRecord(value: unknown): value is AdConsentRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.v === "number" &&
    (r.choice === "granted" || r.choice === "denied") &&
    typeof r.at === "string" &&
    !Number.isNaN(Date.parse(r.at))
  );
}

/**
 * Parses a stored value and returns it only while it is still valid: right
 * version, not in the future, not older than the maximum age. Anything else
 * counts as "no decision", which means Adcash stays unloaded.
 */
export function parseAdConsent(raw: string | null, now: number = Date.now()): AdConsentRecord | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v > AD_CONSENT_VERSION) return null;
  if (parsed.v < AD_CONSENT_VERSION && parsed.choice !== "denied") return null;
  const at = Date.parse(parsed.at);
  if (at > now || now - at > AD_CONSENT_MAX_AGE_MS) return null;
  return parsed;
}

/**
 * The decision of this page view, for a browser that refuses to store it. It
 * lets the banner close after a click; on the next visit the question comes
 * back, which is the correct outcome when nothing could be remembered.
 */
let pageViewRecord: AdConsentRecord | null = null;

export function readAdConsent(): AdConsentRecord | null {
  if (typeof window === "undefined") return null;
  let stored: AdConsentRecord | null = null;
  try {
    stored = parseAdConsent(window.localStorage.getItem(AD_CONSENT_KEY));
  } catch {
    stored = null;
  }
  return stored ?? (pageViewRecord && parseAdConsent(JSON.stringify(pageViewRecord)));
}

/**
 * Storage keys the Adcash script writes into this origin, observed on
 * 2026-09-23 against the live script with zone l8rhgb60kc. Removing them on
 * revocation is what makes a withdrawal reach the device and not only the
 * banner. Cookies Adcash sets on its own domains are out of reach for a page
 * script; the privacy policy says so.
 */
const ADCASH_LOCAL_KEY = /^(adcsh_|suv5_|vast-client-|__VASTStorage__)/;
const ADCASH_SESSION_KEYS = ["template"];

export function clearAdcashStorage(): void {
  try {
    const local = window.localStorage;
    const doomed: string[] = [];
    for (let i = 0; i < local.length; i += 1) {
      const key = local.key(i);
      if (key !== null && ADCASH_LOCAL_KEY.test(key)) doomed.push(key);
    }
    for (const key of doomed) local.removeItem(key);
    for (const key of ADCASH_SESSION_KEYS) window.sessionStorage.removeItem(key);
  } catch {
    // Storage blocked: then the script could not have written anything either.
  }
}

/**
 * Stores a decision and tells every listener in this tab. Other tabs learn
 * about it through the native `storage` event.
 */
export function writeAdConsent(choice: AdConsentChoice, now: Date = new Date()): AdConsentRecord {
  const record: AdConsentRecord = { v: AD_CONSENT_VERSION, choice, at: now.toISOString() };
  pageViewRecord = record;
  try {
    window.localStorage.setItem(AD_CONSENT_KEY, JSON.stringify(record));
  } catch {
    // Storage blocked or full: `pageViewRecord` carries the decision for this
    // page view.
  }
  if (choice === "denied") clearAdcashStorage();
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  return record;
}

/**
 * What a decision in the banner means for the consent counter: the answer to
 * the first ask, a change of mind, or nothing, when a reopened banner is
 * confirmed with the choice it already had.
 */
export function adConsentEvent(
  previous: AdConsentChoice | "unset",
  next: AdConsentChoice,
): "granted" | "denied" | "regranted" | "revoked" | null {
  if (previous === "unset") return next;
  if (previous === next) return null;
  return next === "granted" ? "regranted" : "revoked";
}

export function subscribeAdConsent(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === AD_CONSENT_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * From how many finished rounds on the first visit the banner asks for a
 * decision. A returning player (a round on an earlier day) is asked from the
 * first page of the visit.
 */
export const AD_CONSENT_REQUIRED_AFTER_ROUNDS = 3;

/**
 * Whether an unanswered banner should now require a decision.
 *
 * A first visit is never interrupted: most visitors come from search, and a
 * blocking dialog in front of a game they have not seen yet costs them. Someone
 * who played on an earlier day, or finished a few rounds today, knows what the
 * page is and will not leave over one click.
 *
 * Read from the statistics the games already keep in this browser (no key of
 * its own, nothing new stored before consent): the days played of Kontexto's
 * streak and of Wördle, and the finished rounds of both. `today` is compared as
 * the earlier of the local and the UTC date, because the Kontexto streak writes
 * the local day and Wördle the UTC one; only a day before both counts as earlier.
 */
export function isAdConsentRequired(storage: Pick<Storage, "getItem">, now: Date = new Date()): boolean {
  const read = (key: string): Record<string, unknown> | null => {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const days = (record: Record<string, unknown> | null): string[] =>
    Array.isArray(record?.datesPlayed)
      ? record.datesPlayed.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [];
  const count = (record: Record<string, unknown> | null): number =>
    typeof record?.played === "number" && Number.isFinite(record.played) ? Math.max(0, record.played) : 0;

  const streak = read("kontexto_streak");
  const kontexto = read("kontexto_stats");
  const wordle = read("wordle_stats");

  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const utc = now.toISOString().slice(0, 10);
  const today = local < utc ? local : utc;
  if ([...days(streak), ...days(wordle)].some((day) => day < today)) return true;

  return count(kontexto) + count(wordle) >= AD_CONSENT_REQUIRED_AFTER_ROUNDS;
}

/** Opens the banner again, for the "Cookie-Einstellungen" link in the footer. */
export function reopenAdConsent(): void {
  window.dispatchEvent(new CustomEvent(REOPEN_EVENT));
}

export function subscribeAdConsentReopen(onReopen: () => void): () => void {
  window.addEventListener(REOPEN_EVENT, onReopen);
  return () => window.removeEventListener(REOPEN_EVENT, onReopen);
}
