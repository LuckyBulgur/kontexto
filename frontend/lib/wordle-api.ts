import type { RoomGameSource, RoomRevealResult } from "./types";
import type {
  TileColor,
  WordleGuessResponse,
  WordleGameResponse,
  WordleRevealResponse,
  WordleDuelState,
  WordleDuelGuessEntry,
} from "./wordle-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }
  return resp.json();
}

export async function getWordleGame(): Promise<WordleGameResponse> {
  return request("/wordle/game");
}

export async function submitWordleGuess(
  word: string,
  gameNumber: number,
  hardMode: boolean = false,
  previous: { word: string; result: TileColor[] }[] = [],
  /** Opening guess of this game: lets the server count a started game, which is
   * the only way an abandoned one becomes visible. Deduplicated server-side. */
  first: boolean = false,
): Promise<WordleGuessResponse> {
  return request("/wordle/guess", {
    method: "POST",
    body: JSON.stringify({
      word,
      game_number: gameNumber,
      hard_mode: hardMode,
      previous,
      first,
    }),
  });
}

export async function revealWordleAnswer(gameNumber: number): Promise<WordleRevealResponse> {
  return request(`/wordle/reveal?game_number=${gameNumber}`);
}

export async function createWordleDuel(
  nickname: string,
  gameSource: RoomGameSource
): Promise<{ duel_id: string; player_token: string }> {
  return request("/wordle/duel", {
    method: "POST",
    body: JSON.stringify({ nickname, game_source: gameSource }),
  });
}

export async function joinWordleDuel(
  duelId: string,
  nickname: string
): Promise<{ player_token: string; nickname: string; players: WordleDuelState["players"]; round: number }> {
  return request(`/wordle/duel/${duelId}/join`, {
    method: "POST",
    body: JSON.stringify({ nickname }),
  });
}

/** The solution of a Wordle duel round, for a player who has no move left.
 *
 *  409 means the round is still open for this player; the plain reveal endpoint
 *  is not an alternative here, because it would answer for any game number. */
export async function revealWordleDuel(
  duelId: string,
  playerToken: string
): Promise<RoomRevealResult> {
  const res = await fetch(`${API_BASE}/wordle/duel/${duelId}/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (res.status === 409) throw new Error("round_open");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getWordleDuelState(duelId: string): Promise<WordleDuelState> {
  return request(`/wordle/duel/${duelId}`);
}

export async function submitWordleDuelGuess(
  duelId: string,
  word: string,
  playerToken: string
): Promise<WordleGuessResponse> {
  return request(`/wordle/duel/${duelId}/guess`, {
    method: "POST",
    body: JSON.stringify({ word, player_token: playerToken }),
  });
}

export async function getWordleDuelHistory(
  duelId: string,
  token: string
): Promise<{ guesses: WordleDuelGuessEntry[] }> {
  return request(`/wordle/duel/${duelId}/history?token=${token}`);
}

export async function wordleDuelNextGame(
  duelId: string,
  playerToken: string
): Promise<{ round: number; total: number }> {
  return request(`/wordle/duel/${duelId}/next-game`, {
    method: "POST",
    body: JSON.stringify({ player_token: playerToken }),
  });
}
