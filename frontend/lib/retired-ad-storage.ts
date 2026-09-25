/**
 * Removes what the retired Adcash integration left in this origin's storage.
 *
 * Adcash ran on the game pages from 2026-09-23 to 2026-09-25, behind a consent
 * banner of our own, and was removed after Adcash rejected the site. Browsers
 * that answered the banner still hold the decision (`kontexto_ad_consent`), and
 * browsers that accepted may hold keys the Adcash script wrote under
 * kontexto.de. The privacy policy no longer names either, so they are deleted
 * on the next visit instead of being left behind unexplained.
 *
 * The key patterns are the ones observed against the live script on
 * 2026-09-23. Cookies Adcash set on its own domains are out of reach for a
 * page script.
 */

export const RETIRED_AD_CONSENT_KEY = "kontexto_ad_consent";

const RETIRED_ADCASH_LOCAL_KEY = /^(adcsh_|suv5_|vast-client-|__VASTStorage__)/;
const RETIRED_ADCASH_SESSION_KEYS = ["template"] as const;

type KeyedStorage = Pick<Storage, "length" | "key" | "removeItem">;

export function clearRetiredAdStorage(local: KeyedStorage, session: Pick<Storage, "removeItem">): void {
  const doomed: string[] = [RETIRED_AD_CONSENT_KEY];
  for (let i = 0; i < local.length; i += 1) {
    const key = local.key(i);
    if (key !== null && RETIRED_ADCASH_LOCAL_KEY.test(key)) doomed.push(key);
  }
  for (const key of doomed) local.removeItem(key);
  for (const key of RETIRED_ADCASH_SESSION_KEYS) session.removeItem(key);
}
