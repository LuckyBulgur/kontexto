import { RoomGameSource, RoomRevealResult, TipResult } from "./types";
import {
  KoopState,
  CreateKoopResponse,
  JoinKoopResponse,
  KoopGuessResult,
  KoopGuessEntry,
  NextGameResult,
} from "./koop-types";
import { throwGuessNotFound } from "./guess-error";
import { CategorySetup, roomCategoryBody } from "./categories";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/** `categories` set means a random game from those fields (never the daily). */
export async function createKoop(
  gameSource: RoomGameSource,
  nickname: string,
  tipsAllowed: boolean,
  categories?: CategorySetup | null
): Promise<CreateKoopResponse> {
  const res = await fetch(`${API_BASE}/koop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_source: gameSource,
      nickname,
      tips_allowed: tipsAllowed,
      ...(categories ? roomCategoryBody(categories) : {}),
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

/** The solution of a koop round, once the team has solved or given up.
 *
 *  409 means the round is still open. The open /api/reveal is not a substitute,
 *  because it answers for any game number without asking who is calling. */
export async function revealKoop(
  koopId: string,
  playerToken: string
): Promise<RoomRevealResult> {
  const res = await fetch(`${API_BASE}/koop/${koopId}/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (res.status === 409) throw new Error("round_open");
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
  if (res.status === 404) await throwGuessNotFound(res);
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
): Promise<RoomRevealResult> {
  const res = await fetch(`${API_BASE}/koop/${koopId}/give-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (res.status === 404) throw new Error("koop_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/**
 * Starts the next round for the whole room. `fromRound` is the round this page
 * is on: the server advances only from that round and answers 409
 * `round_changed` when somebody else was faster, so a manual click racing the
 * live room's automatic start, or two tabs, never skip a round.
 */
export async function koopNextGame(
  koopId: string,
  playerToken: string,
  fromRound?: number
): Promise<NextGameResult> {
  const res = await fetch(`${API_BASE}/koop/${koopId}/next-game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      fromRound === undefined
        ? { player_token: playerToken }
        : { player_token: playerToken, round: fromRound }
    ),
  });
  if (res.status === 409) throw new Error("round_changed");
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
