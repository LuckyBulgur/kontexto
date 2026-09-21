import { describe, it, expect, vi, afterEach } from "vitest";
import { createDuel, revealDuel } from "./duel-api";
import { createKoop, revealKoop } from "./koop-api";
import { createArena, revealArena } from "./arena-api";
import { createWordleDuel, revealWordleDuel } from "./wordle-api";

interface FetchCall {
  url: string;
  body?: string;
}

function stubFetch(status: number, body: unknown): FetchCall {
  const call: FetchCall = { url: "" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      call.url = url;
      call.body = typeof init?.body === "string" ? init.body : undefined;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      } as Response;
    }),
  );
  return call;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// The game number is the answer: /api/reveal serves the word for any number to
// anybody. So a room client asks for a kind of puzzle, never for a number, and
// reads the number back only from the reveal of a finished round.
describe("room creation names a kind of game, never a number", () => {
  it("createDuel sends game_source", async () => {
    const call = stubFetch(200, { duel_id: "ABC123", player_token: "t" });
    await createDuel("today", "Alice", true);
    expect(call.body).toBe(
      JSON.stringify({ game_source: "today", nickname: "Alice", tips_allowed: true }),
    );
    expect(call.body).not.toContain("game_number");
  });

  it("createKoop sends game_source", async () => {
    const call = stubFetch(200, { koop_id: "ABC123", player_token: "t" });
    await createKoop("random", "Alice", false);
    expect(call.body).toBe(
      JSON.stringify({ game_source: "random", nickname: "Alice", tips_allowed: false }),
    );
  });

  it("createArena sends game_source", async () => {
    const call = stubFetch(200, { arena_id: "ABC123", player_token: "t", mode: "royale" });
    await createArena("royale", "random", "Alice");
    expect(call.body).toBe(
      JSON.stringify({ mode: "royale", game_source: "random", nickname: "Alice" }),
    );
  });

  it("createWordleDuel sends game_source", async () => {
    const call = stubFetch(200, { duel_id: "ABC123", player_token: "t" });
    await createWordleDuel("Alice", "today");
    expect(call.body).toBe(JSON.stringify({ nickname: "Alice", game_source: "today" }));
  });
});

describe("a room reveal is token-scoped and refusable", () => {
  const reveals = [
    ["duel", (token: string) => revealDuel("ABC123", token), "/api/duel/ABC123/reveal"],
    ["koop", (token: string) => revealKoop("ABC123", token), "/api/koop/ABC123/reveal"],
    ["arena", (token: string) => revealArena("ABC123", token), "/api/arena/ABC123/reveal"],
    [
      "wordle duel",
      (token: string) => revealWordleDuel("ABC123", token),
      "/api/wordle/duel/ABC123/reveal",
    ],
  ] as const;

  for (const [mode, call, url] of reveals) {
    it(`${mode} sends the player token and reads word plus number`, async () => {
      const seen = stubFetch(200, { word: "apfel", game_number: 7, round: 2 });
      const result = await call("token-1");
      expect(seen.url).toBe(url);
      expect(seen.body).toBe(JSON.stringify({ player_token: "token-1" }));
      expect(result).toEqual({ word: "apfel", game_number: 7, round: 2 });
    });

    it(`${mode} turns a 409 into round_open`, async () => {
      stubFetch(409, { error: "round_open" });
      await expect(call("token-1")).rejects.toThrow("round_open");
    });
  }
});
