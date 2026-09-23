// Lightweight, cookieless pageview beacon. Sends only the page path + a signed
// token to the backend; identity/device/geo are derived server-side. No PII,
// no cookies, no third party.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// Refresh the token comfortably before the server's 30-minute window expires.
const TOKEN_MAX_AGE_MS = 25 * 60 * 1000;

let token: string | null = null;
let tokenFetchedAt = 0;

async function ensureToken(): Promise<string | null> {
  if (token && Date.now() - tokenFetchedAt < TOKEN_MAX_AGE_MS) return token;
  try {
    const res = await fetch(`${API_BASE}/collect/token`);
    if (!res.ok) return null;
    const data = await res.json();
    token = data.token;
    tokenFetchedAt = Date.now();
    return token;
  } catch {
    return null;
  }
}

// `share` carries the marker of a shared result link (?s=<game>). It is the only
// way to see word of mouth: a link pasted into a messenger arrives without any
// referrer. The server counts it per page and never stores it per visitor.
export async function trackPageview(page: string, share?: string | null): Promise<void> {
  try {
    const t = await ensureToken();
    if (!t) return;
    const referrer = typeof document !== "undefined" ? document.referrer || null : null;
    await fetch(`${API_BASE}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, token: t, referrer, share: share ?? null }),
      keepalive: true,
    });
  } catch {
    // Analytics must never disrupt the user experience.
  }
}

// Live-presence heartbeat. Sent on a short interval while a page is open so the
// admin dashboard can show how many people currently have the site open. Carries
// only the page path + the same signed token as the pageview beacon; identity is
// derived server-side. Fire-and-forget, never disrupts the user experience.
// `visible` decides whether this beat also counts as attention time. A
// backgrounded tab keeps the visitor in the live count but earns no reading time.
export async function sendHeartbeat(page: string, visible = false): Promise<void> {
  try {
    const t = await ensureToken();
    if (!t) return;
    await fetch(`${API_BASE}/collect/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, token: t, visible }),
      keepalive: true,
    });
  } catch {
    // Analytics must never disrupt the user experience.
  }
}

import type { CompletionPayload } from "./types";
import type { SurveySource } from "./survey";
import type { RatingReason, RatingSummary, RatingVerdict } from "./word-rating";

// Reports a finished game (solved or given up) to feed the server-side
// distribution histograms (attempts, time-to-solve, give-up rank). Only
// aggregate buckets are stored; the report is token-gated, deduplicated and
// clamped server-side, and never affects the authoritative solve/reveal counts.
export async function reportCompletion(payload: CompletionPayload): Promise<void> {
  try {
    const t = await ensureToken();
    if (!t) return;
    await fetch(`${API_BASE}/stats/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, token: t }),
      keepalive: true,
    });
  } catch {
    // Analytics must never disrupt the user experience.
  }
}

// Sends one answer of the attribution survey. Called twice at most: once on the
// chip tap, once more if the optional free text is filled in afterwards. The
// server dedups per fingerprint, so the enrichment can never inflate the count.
export async function submitSurveyAnswer(
  source: SurveySource,
  detail?: string,
): Promise<void> {
  try {
    const t = await ensureToken();
    if (!t) return;
    await fetch(`${API_BASE}/survey/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: t,
        survey: "source_v1",
        source,
        detail: detail?.trim() ? detail.trim().slice(0, 80) : null,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must never disrupt the user experience.
  }
}

// Counts a press of the share button. Client-reported by necessity: a copy to
// the clipboard produces no server hit. Together with the arrivals through
// shared links it gives the ratio that actually describes word of mouth.
export async function reportShare(mode: "kontexto" | "infinite" | "wordle"): Promise<void> {
  try {
    const t = await ensureToken();
    if (!t) return;
    await fetch(`${API_BASE}/collect/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t, mode }),
      keepalive: true,
    });
  } catch {
    // Analytics must never disrupt the user experience.
  }
}

/** Mirror of analytics.AD_CONSENT_KINDS; the backend rejects anything else. */
export type AdConsentEvent = "shown" | "required" | "granted" | "denied" | "regranted" | "revoked";

// One event of the ad consent banner: the first ask was on screen, it was
// answered, or the answer was changed later. Nothing is read from or written to
// the device for it; the server counts each kind once per fingerprint.
export async function reportAdConsent(kind: AdConsentEvent): Promise<void> {
  try {
    const t = await ensureToken();
    if (!t) return;
    await fetch(`${API_BASE}/collect/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t, kind }),
      keepalive: true,
    });
  } catch {
    // Analytics must never disrupt the user experience.
  }
}

// One vote on how a solution word played. Called up to three times for the same
// round: the verdict, the reason behind a "too hard", and the optional free
// text. The server dedups per fingerprint and game, so only the first call
// counts and the later ones can only add the reason and the comment.
export async function submitWordRating(vote: {
  gameNumber: number;
  verdict: RatingVerdict;
  reason?: RatingReason;
  detail?: string;
}): Promise<void> {
  try {
    const t = await ensureToken();
    if (!t) return;
    await fetch(`${API_BASE}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: t,
        game_number: vote.gameNumber,
        verdict: vote.verdict,
        reason: vote.reason ?? null,
        detail: vote.detail?.trim() ? vote.detail.trim().slice(0, 80) : null,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must never disrupt the user experience.
  }
}

// How the others voted. Returns null when the round is unknown or the server is
// unreachable; the card then shows nothing rather than an empty bar chart.
export async function fetchWordRatingSummary(
  gameNumber: number,
  infinite = false,
): Promise<RatingSummary | null> {
  try {
    const query = new URLSearchParams({ game: String(gameNumber) });
    if (infinite) query.set("infinite", "true");
    const res = await fetch(`${API_BASE}/rating?${query.toString()}`);
    if (!res.ok) return null;
    return (await res.json()) as RatingSummary;
  } catch {
    return null;
  }
}
