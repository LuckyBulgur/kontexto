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

export async function trackPageview(page: string): Promise<void> {
  try {
    const t = await ensureToken();
    if (!t) return;
    const referrer = typeof document !== "undefined" ? document.referrer || null : null;
    await fetch(`${API_BASE}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, token: t, referrer }),
      keepalive: true,
    });
  } catch {
    // Analytics must never disrupt the user experience.
  }
}

import type { CompletionPayload } from "./types";

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
