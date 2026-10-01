import { describe, expect, it } from "vitest";
import { isKnockWord, knocksForArrival } from "./knock-sound";

describe("the knock word", () => {
  it.each(["klopfen", "Klopfen", "KLOPFEN", "  klopfen  "])("knocks on %j", (input) => {
    expect(isKnockWord(input)).toBe(true);
  });

  it.each(["klopf", "anklopfen", "klopfend", "klopfen klopfen", ""])("stays quiet on %j", (input) => {
    expect(isKnockWord(input)).toBe(false);
  });
});

describe("a knock from somebody else", () => {
  it("knocks for a teammate's or a chat's word", () => {
    expect(knocksForArrival({ word: "klopfen", by: "Mara42", isTip: false }, "Host")).toBe(true);
    expect(knocksForArrival({ word: "Klopfen", by: "Mara42", isTip: false }, null)).toBe(true);
  });

  it("does not knock twice for your own word", () => {
    expect(knocksForArrival({ word: "klopfen", by: "Host", isTip: false }, "Host")).toBe(false);
  });

  it("stays quiet for a tip and for any other word", () => {
    expect(knocksForArrival({ word: "klopfen", by: "Mara42", isTip: true }, "Host")).toBe(false);
    expect(knocksForArrival({ word: "apfel", by: "Mara42", isTip: false }, "Host")).toBe(false);
  });
});
