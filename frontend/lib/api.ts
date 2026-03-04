import { GuessResult, TipResult, GameInfo, Difficulty } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function submitGuess(word: string): Promise<GuessResult> {
  const res = await fetch(`${API_BASE}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
  if (res.status === 404) throw new Error("unknown_word");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getTip(difficulty: Difficulty, bestRank: number): Promise<TipResult> {
  const res = await fetch(`${API_BASE}/tip?difficulty=${difficulty}&best_rank=${bestRank}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getGameInfo(): Promise<GameInfo> {
  const res = await fetch(`${API_BASE}/game`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
