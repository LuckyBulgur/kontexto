import { GuessResult, TipResult, GameInfo, Difficulty, RevealResult, PastGamesResponse } from "./types";

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
