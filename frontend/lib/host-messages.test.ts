import { describe, expect, it } from "vitest";
import { HOST_MESSAGE_DURATION_MS, freshHostMessages, needsAckRetry } from "./host-messages";
import type { LiveHostMessage } from "./live-types";

const note = (id: number, text = `note ${id}`): LiveHostMessage => ({
  id,
  text,
  sent_at: "2026-09-25T18:00:00Z",
});

describe("HOST_MESSAGE_DURATION_MS", () => {
  it("is five seconds", () => {
    expect(HOST_MESSAGE_DURATION_MS).toBe(5000);
  });
});

describe("freshHostMessages", () => {
  it("drops what is already known and orders by id", () => {
    const fresh = freshHostMessages([note(5), note(3), note(4)], new Set([4]));
    expect(fresh.map((m) => m.id)).toEqual([3, 5]);
  });

  it("returns nothing for a poll that only repeats known notes", () => {
    expect(freshHostMessages([note(1), note(2)], new Set([1, 2]))).toEqual([]);
  });
});

describe("needsAckRetry", () => {
  it("asks again when a shown note is still handed out", () => {
    expect(needsAckRetry([note(2), note(3)], 2)).toBe(true);
  });

  it("stays quiet when nothing shown is pending", () => {
    expect(needsAckRetry([note(3)], 2)).toBe(false);
    expect(needsAckRetry([], 2)).toBe(false);
    expect(needsAckRetry([note(1)], 0)).toBe(false);
  });
});
