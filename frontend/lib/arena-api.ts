import {
  ArenaGuessResult,
  ArenaModeId,
  ArenaState,
  CreateArenaResponse,
  JoinArenaResponse,
} from "./arena-types";
import { DuelGuessHistoryEntry, NextGameResult } from "./duel-types";
import type { RoomGameSource, RoomRevealResult } from "./types";
import { throwGuessNotFound } from "./guess-error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function createArena(
  mode: ArenaModeId,
  gameSource: RoomGameSource,
  nickname: string
): Promise<CreateArenaResponse> {
  const res = await fetch(`${API_BASE}/arena`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, game_source: gameSource, nickname }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** The solution of an arena round, once the arena is finished.
 *
 *  409 means it is still running. The open /api/reveal used to serve this and
 *  would serve it to a player who is still guessing just as readily. */
export async function revealArena(
  arenaId: string,
  playerToken: string
): Promise<RoomRevealResult> {
  const res = await fetch(`${API_BASE}/arena/${arenaId}/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (res.status === 409) throw new Error("round_open");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function joinArena(arenaId: string, nickname: string): Promise<JoinArenaResponse> {
  const res = await fetch(`${API_BASE}/arena/${arenaId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (res.status === 404) throw new Error("arena_not_found");
  if (res.status === 409) throw new Error("arena_closed");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getArenaState(arenaId: string): Promise<ArenaState> {
  const res = await fetch(`${API_BASE}/arena/${arenaId}`);
  if (res.status === 404) throw new Error("arena_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function startArena(arenaId: string, playerToken: string): Promise<ArenaState> {
  const res = await fetch(`${API_BASE}/arena/${arenaId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (res.status === 409) throw new Error("cannot_start");
  if (res.status === 404) throw new Error("player_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/**
 * A refused guess comes back as 409 with the server's reason. The reasons are
 * distinct on purpose: "your time is up" and "you are out of this round" look
 * the same from the outside but mean different things to the player.
 */
export async function submitArenaGuess(
  arenaId: string,
  word: string,
  playerToken: string
): Promise<ArenaGuessResult> {
  const res = await fetch(`${API_BASE}/arena/${arenaId}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, player_token: playerToken }),
  });
  if (res.status === 404) await throwGuessNotFound(res);
  if (res.status === 422) throw new Error("stopword");
  if (res.status === 409) {
    const body = await res.json().catch(() => ({ error: "not_running" }));
    throw new Error(String(body.error ?? "not_running"));
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getArenaHistory(
  arenaId: string,
  token: string
): Promise<DuelGuessHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/arena/${arenaId}/history?token=${token}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.guesses;
}

export async function arenaNextGame(
  arenaId: string,
  playerToken: string
): Promise<NextGameResult> {
  const res = await fetch(`${API_BASE}/arena/${arenaId}/next-game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (res.status === 409) throw new Error("no_games");
  if (res.status === 404) throw new Error("player_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getArenaPlayerInfo(
  token: string
): Promise<{ arena_id: string; nickname: string }> {
  const res = await fetch(`${API_BASE}/arena/player-info?token=${token}`);
  if (res.status === 404) throw new Error("player_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
