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
  previous: { word: string; result: TileColor[] }[] = []
): Promise<WordleGuessResponse> {
  return request("/wordle/guess", {
    method: "POST",
    body: JSON.stringify({
      word,
      game_number: gameNumber,
      hard_mode: hardMode,
      previous,
    }),
  });
}

export async function revealWordleAnswer(gameNumber: number): Promise<WordleRevealResponse> {
  return request(`/wordle/reveal?game_number=${gameNumber}`);
}

export async function createWordleDuel(
  nickname: string,
  gameNumber: number
): Promise<{ duel_id: string; player_token: string }> {
  return request("/wordle/duel", {
    method: "POST",
    body: JSON.stringify({ nickname, game_number: gameNumber }),
  });
}

export async function joinWordleDuel(
  duelId: string,
  nickname: string
): Promise<{ player_token: string; nickname: string; players: WordleDuelState["players"]; game_number: number }> {
  return request(`/wordle/duel/${duelId}/join`, {
    method: "POST",
    body: JSON.stringify({ nickname }),
  });
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
