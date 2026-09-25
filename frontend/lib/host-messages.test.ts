import { describe, expect, it } from "vitest";
import {
  HOST_MESSAGE_MAX_MS,
  HOST_MESSAGE_MIN_MS,
  freshHostMessages,
  hostMessageDurationMs,
  needsAckRetry,
} from "./host-messages";
import type { LiveHostMessage } from "./live-types";

const note = (id: number, text = `note ${id}`): LiveHostMessage => ({
  id,
  text,
  sent_at: "2026-09-25T18:00:00Z",
});

describe("hostMessageDurationMs", () => {
  it("never goes below the minimum", () => {
    expect(hostMessageDurationMs("")).toBe(HOST_MESSAGE_MIN_MS);
    expect(hostMessageDurationMs("Danke")).toBeGreaterThan(HOST_MESSAGE_MIN_MS);
  });

  it("grows with the text and stops at the cap", () => {
    expect(hostMessageDurationMs("x".repeat(40))).toBeGreaterThan(hostMessageDurationMs("x".repeat(10)));
    expect(hostMessageDurationMs("x".repeat(280))).toBe(HOST_MESSAGE_MAX_MS);
  });

  it("counts characters, not UTF-16 units", () => {
    expect(hostMessageDurationMs("\u{1F600}")).toBe(hostMessageDurationMs("a"));
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
