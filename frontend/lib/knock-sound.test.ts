import { describe, expect, it } from "vitest";
import { isKnockWord } from "./knock-sound";

describe("the knock word", () => {
  it.each(["klopfen", "Klopfen", "KLOPFEN", "  klopfen  "])("knocks on %j", (input) => {
    expect(isKnockWord(input)).toBe(true);
  });

  it.each(["klopf", "anklopfen", "klopfend", "klopfen klopfen", ""])("stays quiet on %j", (input) => {
    expect(isKnockWord(input)).toBe(false);
  });
});
