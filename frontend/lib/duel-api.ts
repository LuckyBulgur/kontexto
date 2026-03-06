import { GuessResult, TipResult } from "./types";
import {
  DuelState,
  CreateDuelResponse,
  JoinDuelResponse,
  DuelGuessHistoryEntry,
} from "./duel-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function createDuel(
  gameNumber: number,
  nickname: string,
  tipsAllowed: boolean
): Promise<CreateDuelResponse> {
  const res = await fetch(`${API_BASE}/duel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_number: gameNumber,
      nickname,
      tips_allowed: tipsAllowed,
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function joinDuel(
  duelId: string,
  nickname: string
): Promise<JoinDuelResponse> {
  const res = await fetch(`${API_BASE}/duel/${duelId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (res.status === 404) throw new Error("duel_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getDuelState(duelId: string): Promise<DuelState> {
  const res = await fetch(`${API_BASE}/duel/${duelId}`);
  if (res.status === 404) throw new Error("duel_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function submitDuelGuess(
  duelId: string,
  word: string,
  playerToken: string
): Promise<GuessResult> {
  const res = await fetch(`${API_BASE}/duel/${duelId}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, player_token: playerToken }),
  });
  if (res.status === 404) throw new Error("unknown_word");
  if (res.status === 422) throw new Error("stopword");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getDuelHistory(
  duelId: string,
  token: string
): Promise<DuelGuessHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/duel/${duelId}/history?token=${token}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.guesses;
}

export async function getDuelTip(
  duelId: string,
  difficulty: string,
  bestRank: number,
  guessedRanks?: number[]
): Promise<TipResult> {
  const ranksParam = guessedRanks?.length
    ? `&guessed_ranks=${guessedRanks.join(",")}`
    : "";
  const res = await fetch(
    `${API_BASE}/duel/${duelId}/tip?difficulty=${difficulty}&best_rank=${bestRank}${ranksParam}`
  );
  if (res.status === 403) throw new Error("tips_disabled");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getPlayerInfo(
  token: string
): Promise<{ duel_id: string; nickname: string }> {
  const res = await fetch(`${API_BASE}/duel/player-info?token=${token}`);
  if (res.status === 404) throw new Error("player_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
