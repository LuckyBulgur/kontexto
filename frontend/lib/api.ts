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

// --- Admin (TOTP-protected statistics) ---

export async function adminLogin(code: string): Promise<string> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (res.status === 401) throw new Error("invalid_code");
  if (res.status === 429) throw new Error("rate_limited");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.token as string;
}

export async function getAdminStats(token: string): Promise<StatsData> {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
