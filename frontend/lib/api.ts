import { GuessResult, TipResult, GameInfo, Difficulty, RevealResult, PastGamesResponse, ClosestWordsResponse, StatsData } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function submitGuess(word: string, game?: number | null): Promise<GuessResult> {
  const gameParam = game ? `?game=${game}` : "";
  const res = await fetch(`${API_BASE}/guess${gameParam}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
  if (res.status === 404) throw new Error("unknown_word");
  if (res.status === 422) throw new Error("stopword");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getTip(difficulty: Difficulty, bestRank: number, game?: number | null, guessedRanks?: number[]): Promise<TipResult> {
  const gameParam = game ? `&game=${game}` : "";
  const ranksParam = guessedRanks && guessedRanks.length > 0 ? `&guessed_ranks=${guessedRanks.join(",")}` : "";
  const res = await fetch(`${API_BASE}/tip?difficulty=${difficulty}&best_rank=${bestRank}${gameParam}${ranksParam}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getGameInfo(): Promise<GameInfo> {
  const res = await fetch(`${API_BASE}/game`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function revealAnswer(game?: number | null): Promise<RevealResult> {
  const gameParam = game ? `?game=${game}` : "";
  const res = await fetch(`${API_BASE}/reveal${gameParam}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getPastGames(): Promise<PastGamesResponse> {
  const res = await fetch(`${API_BASE}/games`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getClosestWords(game?: number | null): Promise<ClosestWordsResponse> {
  const gameParam = game ? `?game=${game}` : "";
  const res = await fetch(`${API_BASE}/closest${gameParam}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- Admin (WebAuthn/passkey-protected statistics) ---

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Log in with the registered passkey. Returns a session token.
export async function adminPasskeyLogin(): Promise<string> {
  const optRes = await postJson("/admin/webauthn/login/options", {});
  if (optRes.status === 429) throw new Error("rate_limited");
  if (optRes.status === 404) throw new Error("no_credential");
  if (!optRes.ok) throw new Error(`API error: ${optRes.status}`);
  const { options, challengeToken } = await optRes.json();

  const credential = await startAuthentication({ optionsJSON: options });

  const verifyRes = await postJson("/admin/webauthn/login/verify", {
    credential,
    challenge_token: challengeToken,
  });
  if (verifyRes.status === 429) throw new Error("rate_limited");
  if (!verifyRes.ok) throw new Error("auth_failed");
  const data = await verifyRes.json();
  return data.token as string;
}

// Register (or replace) the single passkey. Requires the break-glass enroll token.
export async function adminPasskeyRegister(enrollToken: string): Promise<void> {
  const optRes = await postJson("/admin/webauthn/register/options", { enroll_token: enrollToken });
  if (optRes.status === 403) throw new Error("forbidden");
  if (!optRes.ok) throw new Error(`API error: ${optRes.status}`);
  const { options, challengeToken } = await optRes.json();

  const credential = await startRegistration({ optionsJSON: options });

  const verifyRes = await postJson("/admin/webauthn/register/verify", {
    credential,
    challenge_token: challengeToken,
    enroll_token: enrollToken,
  });
  if (verifyRes.status === 403) throw new Error("forbidden");
  if (!verifyRes.ok) throw new Error("registration_failed");
}

export async function getAdminStats(token: string): Promise<StatsData> {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- Rating ---

export async function getBeaconToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/collect/token`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.token as string;
}

export async function submitRating(
  token: string,
  value: number,
): Promise<{ ratingValue: number; ratingCount: number }> {
  const res = await fetch(`${API_BASE}/rating`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, value }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
