import { describe, expect, it } from "vitest";
import { AUTO_NEXT_DELAY_MS, autoNextSecondsLeft } from "./live-auto-next";

describe("autoNextSecondsLeft", () => {
  it("starts at the full delay", () => {
    expect(autoNextSecondsLeft(AUTO_NEXT_DELAY_MS, 0)).toBe(10);
  });

  it("rounds up, so the card never reads 0 while it still waits", () => {
    expect(autoNextSecondsLeft(10_000, 9_001)).toBe(1);
    expect(autoNextSecondsLeft(10_000, 9_999)).toBe(1);
    expect(autoNextSecondsLeft(10_000, 500)).toBe(10);
  });

  it("is 0 at and after the deadline, never negative", () => {
    expect(autoNextSecondsLeft(10_000, 10_000)).toBe(0);
    expect(autoNextSecondsLeft(10_000, 75_000)).toBe(0);
  });
});
