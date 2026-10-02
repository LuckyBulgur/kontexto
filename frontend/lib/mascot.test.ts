import { describe, expect, it } from "vitest";
import { MASCOT_COOLDOWN_MS, MASCOT_FLIGHT_MS, MascotGate, matchMascot } from "./mascot";

describe("matchMascot", () => {
  it("knows the word for peanut in any case and normalisation", () => {
    expect(matchMascot("erdnuss")).toBe("peanut");
    expect(matchMascot("Erdnuss")).toBe("peanut");
    expect(matchMascot(" ERDNUSS ")).toBe("peanut");
  });

  it("ignores every other word", () => {
    expect(matchMascot("nuss")).toBeNull();
    expect(matchMascot("erdnussbutter")).toBeNull();
    expect(matchMascot("")).toBeNull();
  });
});

describe("MascotGate", () => {
  it("lets the first flight start", () => {
    expect(new MascotGate().admit("peanut", 1_000)).toBe(true);
  });

  it("holds the same mascot back for the cooldown", () => {
    const gate = new MascotGate();
    expect(gate.admit("peanut", 0)).toBe(true);
    expect(gate.admit("peanut", MASCOT_FLIGHT_MS + 1)).toBe(false);
    expect(gate.admit("peanut", MASCOT_COOLDOWN_MS - 1)).toBe(false);
    expect(gate.admit("peanut", MASCOT_COOLDOWN_MS)).toBe(true);
  });
});
