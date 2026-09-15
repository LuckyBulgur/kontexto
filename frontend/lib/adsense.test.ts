import { describe, expect, it } from "vitest";
import { isAdEligiblePath } from "./adsense";

describe("AdSense route allowlist", () => {
  it("allows only the two designated single-player pages", () => {
    expect(isAdEligiblePath("/")).toBe(true);
    expect(isAdEligiblePath("/wordle/")).toBe(true);
    expect(isAdEligiblePath("/duel/")).toBe(false);
    expect(isAdEligiblePath("/koop/")).toBe(false);
    expect(isAdEligiblePath("/duel/create/")).toBe(false);
    expect(isAdEligiblePath("/duel/room-id/")).toBe(false);
  });

  it("does not treat missing or non-canonical paths as eligible", () => {
    expect(isAdEligiblePath(null)).toBe(false);
    expect(isAdEligiblePath(undefined)).toBe(false);
    expect(isAdEligiblePath("/wordle")).toBe(false);
    expect(isAdEligiblePath("/wordle/?game=2")).toBe(false);
  });
});
