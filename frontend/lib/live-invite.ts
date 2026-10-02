/**
 * The guest link of a live room: `/live/<id>/#mitraten=<secret>`.
 *
 * The host screen is on stream, so the link is never printed anywhere. The
 * host's header button copies it, and that is the only way it leaves the page.
 * The secret rides in the fragment, which the browser never sends: it reaches
 * no access log, no proxy and no Referer header. The guest page takes it out of
 * the address bar on arrival (`takeInviteFromLocation`), so a guest who streams
 * too does not show it either.
 *
 * The server holds the matching secret on the koop row (`koops.join_secret`)
 * and refuses a join without it with the same 404 as an unknown room.
 */

/** The fragment parameter. German, because a guest reads it in the address
 *  bar of the link they were sent. */
export const INVITE_PARAM = "mitraten";

/** What the server hands out (`token_urlsafe`) and what older rooms got from
 *  the migration (hex). Anything else in the fragment is not a link of ours. */
const SECRET_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

/** The smallest piece of the Web Storage API these helpers need, so the tests
 *  can hand in a map and a page can hand in a storage that throws. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function buildInviteUrl(origin: string, koopId: string, secret: string): string {
  return `${origin}/live/${encodeURIComponent(koopId)}/#${INVITE_PARAM}=${encodeURIComponent(secret)}`;
}

/** The secret in a location hash, or null when there is none or it is not ours. */
export function readInviteFromHash(hash: string): string | null {
  const raw = new URLSearchParams(hash.replace(/^#/, "")).get(INVITE_PARAM);
  return raw !== null && SECRET_PATTERN.test(raw) ? raw : null;
}

export function hasInviteParam(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, "")).has(INVITE_PARAM);
}

/** The hash with the invite removed: "" when nothing else was in it. */
export function hashWithoutInvite(hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  params.delete(INVITE_PARAM);
  const rest = params.toString();
  return rest ? `#${rest}` : "";
}

/** Where a guest's own seat lives. Not the host's key (`kontexto_koop_<id>`):
 *  the live page decides who is the host by that key. */
export function guestTokenKey(koopId: string): string {
  return `kontexto_live_guest_${koopId}`;
}

/** Where an invite waits between arrival and the join, for this tab only. */
export function pendingInviteKey(koopId: string): string {
  return `kontexto_live_invite_${koopId}`;
}

export function readStored(store: KeyValueStore | null, key: string): string | null {
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(store: KeyValueStore | null, key: string, value: string | null): void {
  if (!store) return;
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    // Storage blocked: the page keeps the value in its own state for this visit.
  }
}

/** `window.sessionStorage`, or null where even reading the property throws. */
export function sessionStore(): KeyValueStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function localStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The invite this tab holds for the room: the one in the address, which is
 * then removed from it, or one an earlier load of this tab put aside.
 */
export function takeInviteFromLocation(koopId: string): string | null {
  const fromHash = readInviteFromHash(window.location.hash);
  if (fromHash !== null) {
    writeStored(sessionStore(), pendingInviteKey(koopId), fromHash);
  }
  // A malformed value goes too: whatever stood there is not for the address
  // bar. A hash without the parameter (an anchor) is left exactly as it is.
  if (hasInviteParam(window.location.hash)) {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search + hashWithoutInvite(window.location.hash)
    );
  }
  return fromHash ?? readStored(sessionStore(), pendingInviteKey(koopId));
}
