import { GuessResult, TipResult, GameInfo, Difficulty, RevealResult, PastGamesResponse, ClosestWordsResponse, InfiniteNextResponse, StatsData, LiveData, AdminLiveStreams, WordAtRankResult, DualNextResponse, DualGuessResult, SuddenDeathRound } from "./types";
import { SoloModeId } from "./solo-modes";
import { throwGuessNotFound } from "./guess-error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export type CreatorPlatform = "tiktok" | "youtube" | "twitch" | "instagram";
export interface CreatorSpot { platform: CreatorPlatform; channel_name: string; channel_url: string }
export interface CreatorSubmission {
  id: number; platform: CreatorPlatform; clip_url: string; channel_url: string;
  channel_name: string; email: string | null; status: "pending" | "approved" | "rejected" | "shown";
  submitted_at: string; eligible_date: string | null;
}

export async function getCreatorSpot(): Promise<CreatorSpot | null> {
  const res = await fetch(`${API_BASE}/creator-spot`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return (await res.json()).creator;
}

export async function submitCreatorClip(data: { clip_url: string; channel_url: string; channel_name: string; email?: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/creator-submissions`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "submission_failed");
}

export async function getCreatorSubmissions(token: string): Promise<{ submissions: CreatorSubmission[]; today_submission_id: number | null }> {
  const res = await fetch(`${API_BASE}/admin/creator-submissions`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function showCreatorToday(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/creator-submissions/${id}/show-today`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function reviewCreatorSubmission(token: string, id: number, approve: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/creator-submissions/${id}/review`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ approve }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

/** Build the `?game=…&infinite=true&mode=…` query shared by all game-scoped
 *  endpoints. `mode` only changes how the request is counted; the backend
 *  validates it against its own allow-list and falls back when it does not
 *  recognise the value. */
function gameQuery(game?: number | null, infinite?: boolean, mode?: SoloModeId): string {
  const params = new URLSearchParams();
  if (game) params.set("game", String(game));
  if (infinite) params.set("infinite", "true");
  if (mode) params.set("mode", mode);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** `first` marks the opening guess of a game so the server can count a started
 * game, which is what makes an abandoned one visible. It is a hint: the server
 * deduplicates the count per visitor and game anyway. */
export async function submitGuess(word: string, game?: number | null, infinite?: boolean, first?: boolean, mode?: SoloModeId): Promise<GuessResult> {
  const res = await fetch(`${API_BASE}/guess${gameQuery(game, infinite, mode)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, first: first ?? false }),
  });
  if (res.status === 404) await throwGuessNotFound(res);
  if (res.status === 422) throw new Error("stopword");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getTip(difficulty: Difficulty, bestRank: number, game?: number | null, guessedRanks?: number[], infinite?: boolean, mode?: SoloModeId): Promise<TipResult> {
  const params = new URLSearchParams({ difficulty, best_rank: String(bestRank) });
  if (game) params.set("game", String(game));
  if (infinite) params.set("infinite", "true");
  if (mode) params.set("mode", mode);
  if (guessedRanks && guessedRanks.length > 0) params.set("guessed_ranks", guessedRanks.join(","));
  const res = await fetch(`${API_BASE}/tip?${params.toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getGameInfo(): Promise<GameInfo> {
  const res = await fetch(`${API_BASE}/game`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function revealAnswer(game?: number | null, infinite?: boolean, mode?: SoloModeId): Promise<RevealResult> {
  const res = await fetch(`${API_BASE}/reveal${gameQuery(game, infinite, mode)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getPastGames(): Promise<PastGamesResponse> {
  const res = await fetch(`${API_BASE}/games`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getClosestWords(game?: number | null, infinite?: boolean): Promise<ClosestWordsResponse> {
  const res = await fetch(`${API_BASE}/closest${gameQuery(game, infinite)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/**
 * Fetch the next game for the endless ("Unendlich") mode. `played` is the set
 * of games already finished this session (so we avoid repeats until the pool is
 * exhausted) and `current` is the game in progress (never handed back). Throws
 * "no_games" when the pool holds nothing else to play.
 */
export async function getInfiniteGame(played: number[], current?: number | null): Promise<InfiniteNextResponse> {
  const params = new URLSearchParams();
  if (played.length > 0) params.set("exclude", played.join(","));
  if (current) params.set("current", String(current));
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/infinite/next${qs ? `?${qs}` : ""}`);
  if (res.status === 404) throw new Error("no_games");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- Solo modes (Leiter, Doppelziel, Sudden Death) ---

/**
 * The word at one exact rank, which is how the Leiter mode gets its opening
 * word. The backend refuses rank 1, so this can never return the solution.
 */
export async function getWordAtRank(rank: number, game: number): Promise<WordAtRankResult> {
  const res = await fetch(`${API_BASE}/word-at-rank?rank=${rank}&game=${game}&infinite=true`);
  if (res.status === 404) throw new Error("rank_out_of_range");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** The two independent targets of a Doppelziel round. */
export async function getDualNext(played: number[]): Promise<DualNextResponse> {
  const qs = played.length > 0 ? `?exclude=${played.join(",")}` : "";
  const res = await fetch(`${API_BASE}/dual/next${qs}`);
  if (res.status === 404) throw new Error("no_games");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** Rank one word against both Doppelziel targets in a single request. */
export async function submitDualGuess(word: string, games: number[], first?: boolean): Promise<DualGuessResult> {
  const res = await fetch(`${API_BASE}/dual/guess?games=${games.join(",")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, first: first ?? false }),
  });
  if (res.status === 404) await throwGuessNotFound(res);
  if (res.status === 422) throw new Error("stopword");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** A Sudden Death round: a game plus the words on ranks 2 to 6. */
export async function getSuddenDeath(played: number[]): Promise<SuddenDeathRound> {
  const qs = played.length > 0 ? `?exclude=${played.join(",")}` : "";
  const res = await fetch(`${API_BASE}/sudden-death${qs}`);
  if (res.status === 404) throw new Error("no_games");
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

export async function getAdminLiveStreams(token: string): Promise<AdminLiveStreams> {
  const res = await fetch(`${API_BASE}/admin/live-streams`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/**
 * Send a streamer a short note for their host page. Errors come back as the
 * server's codes: `bad_message`, `room_not_found` (the stream ended),
 * `too_many_pending` (the host page has not shown the last ones yet).
 */
export async function sendHostMessage(
  token: string,
  koopId: string,
  text: string
): Promise<number> {
  const res = await fetch(`${API_BASE}/admin/live-streams/${encodeURIComponent(koopId)}/message`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const code =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `API error: ${res.status}`;
    throw new Error(code);
  }
  const body = (await res.json()) as { id: number };
  return body.id;
}

/**
 * End a stream round: the chat stops counting and the overlay goes blank. The
 * board on the streamer's page stays. `room_not_found` means it already ended.
 */
export async function endLiveStream(token: string, koopId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/live-streams/${encodeURIComponent(koopId)}/end`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (res.status === 404) throw new Error("room_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function getAdminLive(token: string): Promise<LiveData> {
  const res = await fetch(`${API_BASE}/admin/live`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
