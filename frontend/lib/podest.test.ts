import { describe, expect, it } from "vitest";
import { PODEST_ERROR_MIN_MS, podestErrorRemaining } from "./podest";

describe("podestErrorRemaining", () => {
  it("holds a fresh refusal for the full time", () => {
    expect(podestErrorRemaining(1000, 1000)).toBe(PODEST_ERROR_MIN_MS);
  });

  it("holds only the rest of the time once part of it has passed", () => {
    expect(podestErrorRemaining(1000, 2000)).toBe(PODEST_ERROR_MIN_MS - 1000);
  });

  it("lets the next word in at once after the time is up", () => {
    expect(podestErrorRemaining(1000, 1000 + PODEST_ERROR_MIN_MS)).toBe(0);
    expect(podestErrorRemaining(1000, 1000 + PODEST_ERROR_MIN_MS * 4)).toBe(0);
  });

  it("never returns more than the full time for a clock that went backwards", () => {
    expect(podestErrorRemaining(5000, 4000)).toBe(PODEST_ERROR_MIN_MS);
  });
});
