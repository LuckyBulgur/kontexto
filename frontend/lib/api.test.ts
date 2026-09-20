import { describe, it, expect, vi, afterEach } from "vitest";
import { getInfiniteGame, submitGuess, getTip, revealAnswer } from "./api";

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

describe("infinite-mode API query building", () => {
  it("getInfiniteGame sends played set + current game", async () => {
    const call = stubFetch(200, { gameNumber: 9, total: 144, totalGames: 200 });
    const res = await getInfiniteGame([2, 5], 7);
    expect(res.gameNumber).toBe(9);
    expect(call.url).toContain("/api/infinite/next?");
    expect(call.url).toContain("exclude=2%2C5");
    expect(call.url).toContain("current=7");
  });

  it("getInfiniteGame omits params when empty", async () => {
    const call = stubFetch(200, { gameNumber: 1, total: 144, totalGames: 200 });
    await getInfiniteGame([], null);
    expect(call.url).toBe("/api/infinite/next");
  });

  it("getInfiniteGame maps a 404 to the no_games error", async () => {
    stubFetch(404, { error: "no_games" });
    await expect(getInfiniteGame([1], 2)).rejects.toThrow("no_games");
  });

  it("submitGuess appends game + infinite flags", async () => {
    const call = stubFetch(200, { word: "fisch", rank: 1, total: 144 });
    await submitGuess("fisch", 3, true);
    expect(call.url).toBe("/api/guess?game=3&infinite=true");
  });

  it("submitGuess for the daily game carries no query", async () => {
    const call = stubFetch(200, { word: "fisch", rank: 1, total: 144 });
    await submitGuess("fisch");
    expect(call.url).toBe("/api/guess");
  });

  it("submitGuess marks the opening guess so a started game is countable", async () => {
    const call = stubFetch(200, { word: "fisch", rank: 400, total: 144 });
    await submitGuess("fisch", null, false, true);
    expect(JSON.parse(call.body ?? "{}")).toEqual({ word: "fisch", first: true });
  });

  it("submitGuess flags every later guess as not-first", async () => {
    const call = stubFetch(200, { word: "vogel", rank: 20, total: 144 });
    await submitGuess("vogel");
    expect(JSON.parse(call.body ?? "{}")).toEqual({ word: "vogel", first: false });
  });

  it("getTip includes infinite + guessed ranks", async () => {
    const call = stubFetch(200, { word: "vogel", rank: 3 });
    await getTip("easy", 1000, 3, [4, 5], true);
    expect(call.url).toContain("difficulty=easy");
    expect(call.url).toContain("game=3");
    expect(call.url).toContain("infinite=true");
    expect(call.url).toContain("guessed_ranks=4%2C5");
  });

  it("revealAnswer carries the infinite flag", async () => {
    const call = stubFetch(200, { word: "fisch" });
    await revealAnswer(3, true);
    expect(call.url).toBe("/api/reveal?game=3&infinite=true");
  });
});
