// verify-language-fixture: the patterns below match German UI copy on purpose.
import { describe, expect, it } from "vitest";
import {
  PLAIN,
  QUIPS,
  kontextoResultOccasion,
  pickQuip,
  ratingOccasion,
  refusalText,
  soloResultOccasion,
  wordleWinOccasion,
  type QuipOccasion,
  type RefusalKind,
} from "./quips";

const OCCASIONS = Object.keys(QUIPS) as QuipOccasion[];
const ALL_LINES = OCCASIONS.flatMap((occasion) => QUIPS[occasion]);

/** Each refusal kind must still say what happened, in whatever words. */
const FACTS: Record<RefusalKind, RegExp> = {
  refusalDuplicate: /schon/i,
  refusalUnknown: /kenn/i,
  refusalStopword: /allgemein|zählt nicht/i,
  wordleTooShort: /Buchstaben/,
  wordleNotInList: /Wörterbuch|kenn/i,
  wordleHardMode: /Hard Mode/,
};

describe("quip catalogue", () => {
  it("has at least three lines for every occasion", () => {
    for (const occasion of OCCASIONS) {
      expect(QUIPS[occasion].length, occasion).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every refusal informative", () => {
    for (const [kind, fact] of Object.entries(FACTS) as [RefusalKind, RegExp][]) {
      for (const line of QUIPS[kind]) expect(line, kind).toMatch(fact);
    }
  });

  it("holds the house typography", () => {
    for (const line of ALL_LINES) {
      expect(line).not.toMatch(/[\u2014\u2015]/);
      expect(line).not.toMatch(/\s\u2013\s/);
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(line).not.toMatch(/["']/);
      expect(line, "du, never the formal address").not.toMatch(/\b(Sie|Ihnen|Ihr)\b/);
      expect(line.trim()).toBe(line);
    }
  });

  it("has no line twice within one occasion", () => {
    for (const occasion of OCCASIONS) {
      expect(new Set(QUIPS[occasion]).size, occasion).toBe(QUIPS[occasion].length);
    }
  });
});

describe("pickQuip", () => {
  it("is deterministic for a seed", () => {
    expect(pickQuip("kontextoGiveUp", 42)).toBe(pickQuip("kontextoGiveUp", 42));
    expect(pickQuip("refusalDuplicate", "haus")).toBe(pickQuip("refusalDuplicate", "haus"));
  });

  it("reaches every line of an occasion over many seeds", () => {
    for (const occasion of OCCASIONS) {
      const seen = new Set<string>();
      for (let seed = 0; seed < 400; seed++) seen.add(pickQuip(occasion, seed));
      expect(seen.size, occasion).toBe(QUIPS[occasion].length);
    }
  });
});

describe("refusalText", () => {
  it("returns the old copy verbatim when switched off", () => {
    expect(refusalText("refusalDuplicate", false, "x")).toBe("Wort bereits geraten");
    expect(refusalText("refusalUnknown", false, "x")).toBe("Dieses Wort kenne ich leider nicht");
    expect(refusalText("refusalStopword", false, "x")).toBe("Dieses Wort zählt nicht, es ist zu allgemein");
    expect(refusalText("wordleTooShort", false, "x")).toBe("Nicht genug Buchstaben");
    expect(refusalText("wordleNotInList", false, "x")).toBe("Nicht im Wörterbuch");
    expect(PLAIN.wordleWin).toEqual(["Genial!", "Großartig!", "Stark!", "Gut!", "Knapp!", "Gerade so!"]);
  });

  it("returns a catalogue line when switched on", () => {
    expect(QUIPS.refusalUnknown).toContain(refusalText("refusalUnknown", true, "qwrtz"));
  });
});

describe("occasion selection", () => {
  it("buckets a Kontexto result by guesses, tips first", () => {
    expect(kontextoResultOccasion(false, 12, 0)).toBe("kontextoGiveUp");
    expect(kontextoResultOccasion(true, 1, 0)).toBe("kontextoWinFirst");
    expect(kontextoResultOccasion(true, 10, 0)).toBe("kontextoWinFast");
    expect(kontextoResultOccasion(true, 11, 2)).toBe("kontextoWinSolid");
    expect(kontextoResultOccasion(true, 80, 0)).toBe("kontextoWinSlow");
    expect(kontextoResultOccasion(true, 81, 0)).toBe("kontextoWinMarathon");
    expect(kontextoResultOccasion(true, 5, 3)).toBe("kontextoWinTips");
  });

  it("maps solo, Wordle and rating occasions onto the catalogue", () => {
    expect(soloResultOccasion("suddendeath", false)).toBe("suddendeathLost");
    expect(soloResultOccasion("categories", true)).toBe("categoriesWon");
    expect(wordleWinOccasion(0)).toBe("wordleWin1");
    expect(wordleWinOccasion(6)).toBe("wordleWin6");
    expect(wordleWinOccasion(9)).toBe("wordleWin6");
    expect(ratingOccasion("hard")).toBe("ratingHard");
  });
});
