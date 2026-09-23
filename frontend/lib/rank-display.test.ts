import { describe, expect, it } from "vitest";

import { getBarWidth, getRankColor } from "./types";

describe("getRankColor", () => {
  it("follows the original game's bands", () => {
    expect(getRankColor(1)).toBe("green");
    expect(getRankColor(300)).toBe("green");
    expect(getRankColor(301)).toBe("yellow");
    expect(getRankColor(1500)).toBe("yellow");
    expect(getRankColor(1501)).toBe("red");
  });
});

describe("getBarWidth", () => {
  it("fills the bar for the solution", () => {
    expect(getBarWidth(1)).toBe(100);
  });

  it("falls off like the original's curve, exp(-distance / 800)", () => {
    for (const rank of [2, 100, 300, 1500]) {
      expect(getBarWidth(rank)).toBeCloseTo(100 * Math.exp(-(rank - 1) / 800), 1);
    }
  });

  it("tells close guesses apart, which the linear bar did not", () => {
    // Ranks 38 and 402 both drew at 97 percent against the old scale.
    expect(getBarWidth(38) - getBarWidth(402)).toBeGreaterThan(30);
  });

  it("never draws less than a sliver", () => {
    expect(getBarWidth(20000)).toBe(5);
    expect(getBarWidth(56712)).toBe(5);
  });

  it("only ever narrows as the rank grows", () => {
    let previous = getBarWidth(1);
    for (let rank = 2; rank <= 5000; rank += 7) {
      const width = getBarWidth(rank);
      expect(width).toBeLessThanOrEqual(previous);
      previous = width;
    }
  });
});
