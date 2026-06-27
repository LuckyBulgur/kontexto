import { TipResult } from "./types";
import {
  KoopState,
  CreateKoopResponse,
  JoinKoopResponse,
  KoopGuessResult,
  KoopGuessEntry,
  NextGameResult,
} from "./koop-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function createKoop(
  gameNumber: number,
  nickname: string,
  tipsAllowed: boolean
): Promise<CreateKoopResponse> {
  const res = await fetch(`${API_BASE}/koop`, {
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

export async function joinKoop(
  koopId: string,
  nickname: string
): Promise<JoinKoopResponse> {
  const res = await fetch(`${API_BASE}/koop/${koopId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (res.status === 404) throw new Error("koop_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getKoopState(koopId: string): Promise<KoopState> {
  const res = await fetch(`${API_BASE}/koop/${koopId}`);
  if (res.status === 404) throw new Error("koop_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getKoopGuesses(koopId: string): Promise<KoopGuessEntry[]> {
  const res = await fetch(`${API_BASE}/koop/${koopId}/guesses`);
  if (res.status === 404) throw new Error("koop_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.guesses;
}

export async function submitKoopGuess(
  koopId: string,
  word: string,
  playerToken: string
): Promise<KoopGuessResult> {
  const res = await fetch(`${API_BASE}/koop/${koopId}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, player_token: playerToken }),
  });
  if (res.status === 404) throw new Error("unknown_word");
  if (res.status === 422) throw new Error("stopword");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getKoopTip(
  koopId: string,
  difficulty: string,
  playerToken: string
): Promise<TipResult> {
  const res = await fetch(
    `${API_BASE}/koop/${koopId}/tip?token=${playerToken}&difficulty=${difficulty}`
  );
  if (res.status === 403) throw new Error("tips_disabled");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function giveUpKoop(
  koopId: string,
  playerToken: string
): Promise<{ word: string }> {
  const res = await fetch(`${API_BASE}/koop/${koopId}/give-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (res.status === 404) throw new Error("koop_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function koopNextGame(
  koopId: string,
  playerToken: string
): Promise<NextGameResult> {
  const res = await fetch(`${API_BASE}/koop/${koopId}/next-game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (res.status === 404) throw new Error("no_games");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getKoopPlayerInfo(
  token: string
): Promise<{ koop_id: string; nickname: string }> {
  const res = await fetch(`${API_BASE}/koop/player-info?token=${token}`);
  if (res.status === 404) throw new Error("player_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
