import { describe, expect, it } from "vitest";
import { EggGate, LIVE_COOLDOWN_MS, OWN_COOLDOWN_MS } from "./gate";

describe("EggGate", () => {
  it("lets different words play one after the other without a pause", () => {
    const gate = new EggGate();
    expect(gate.admit("hund", "own", 0)).toBe(true);
    expect(gate.admit("katze", "own", 1)).toBe(true);
    expect(gate.admit("mlg", "live", 2)).toBe(true);
    expect(gate.admit("geist", "live", 3)).toBe(true);
  });

  it("holds the same word back for its cooldown", () => {
    const gate = new EggGate();
    expect(gate.admit("hund", "own", 0)).toBe(true);
    expect(gate.admit("hund", "own", OWN_COOLDOWN_MS - 1)).toBe(false);
    expect(gate.admit("hund", "own", OWN_COOLDOWN_MS)).toBe(true);
  });

  it("swallows the second call of a typed word when the server returns it", () => {
    const gate = new EggGate();
    expect(gate.admit("katze", "own", 1_000)).toBe(true);
    expect(gate.admit("katze", "own", 1_300)).toBe(false);
  });

  it("waits longer for a word a stream chat repeats", () => {
    const gate = new EggGate();
    expect(gate.admit("pizza", "live", 0)).toBe(true);
    expect(gate.admit("pizza", "live", OWN_COOLDOWN_MS)).toBe(false);
    expect(gate.admit("pizza", "live", LIVE_COOLDOWN_MS)).toBe(true);
  });

  it("forgets the oldest words on a long stream instead of growing forever", () => {
    const gate = new EggGate();
    for (let i = 0; i < 600; i++) gate.admit(`w${i}`, "live", 0);
    expect(gate.admit("w0", "live", 1)).toBe(true);
    expect(gate.admit("w599", "live", 1)).toBe(false);
  });
});
