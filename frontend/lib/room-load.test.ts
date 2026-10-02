import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadAbortedError, isFinalLoadError, isNotFound, loadWithRetry } from "./room-load";

describe("isFinalLoadError", () => {
  it.each(["koop_not_found", "duel_not_found", "arena_not_found", "player_not_found", "API error: 404", "API error: 403", "API error: 422"])(
    "takes %j as the server's final answer",
    (message) => {
      expect(isFinalLoadError(new Error(message))).toBe(true);
    },
  );

  it.each(["API error: 502", "API error: 503", "API error: 500", "API error: 429", "API error: 408", "Failed to fetch", "Load failed"])(
    "retries on %j, the server being away",
    (message) => {
      expect(isFinalLoadError(new Error(message))).toBe(false);
    },
  );

  it("retries on a network failure and on anything that is not an Error", () => {
    expect(isFinalLoadError(new TypeError("NetworkError when attempting to fetch resource."))).toBe(false);
    expect(isFinalLoadError("boom")).toBe(false);
    expect(isFinalLoadError(null)).toBe(false);
  });
});

describe("isNotFound", () => {
  it("reads both spellings of a 404 and nothing else", () => {
    expect(isNotFound(new Error("koop_not_found"))).toBe(true);
    expect(isNotFound(new Error("API error: 404"))).toBe(true);
    expect(isNotFound(new Error("API error: 403"))).toBe(false);
    expect(isNotFound(new Error("API error: 502"))).toBe(false);
  });
});

describe("loadWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits through a restarting server and returns the room", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new Error("API error: 502"))
      .mockResolvedValueOnce("room");
    const result = loadWithRetry(load, new AbortController().signal, [10, 20]);
    await vi.advanceTimersByTimeAsync(30);
    await expect(result).resolves.toBe("room");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("stops at once on a final answer", async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("koop_not_found"));
    await expect(loadWithRetry(load, new AbortController().signal, [10, 20])).rejects.toThrow("koop_not_found");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("gives up with the last error once the retries run out", async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("API error: 503"));
    const result = loadWithRetry(load, new AbortController().signal, [10, 20]);
    const settled = expect(result).rejects.toThrow("API error: 503");
    await vi.advanceTimersByTimeAsync(30);
    await settled;
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("stops waiting when the page moves on", async () => {
    const controller = new AbortController();
    const load = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("API error: 502"));
    const result = loadWithRetry(load, controller.signal, [10_000]);
    const settled = expect(result).rejects.toBeInstanceOf(LoadAbortedError);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await settled;
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("drops an answer that lands after the page moved on", async () => {
    const controller = new AbortController();
    let answer: (value: string) => void = () => undefined;
    const load = vi.fn(() => new Promise<string>((resolve) => (answer = resolve)));
    const result = loadWithRetry(load, controller.signal, []);
    controller.abort();
    answer("room");
    await expect(result).rejects.toBeInstanceOf(LoadAbortedError);
  });
});
