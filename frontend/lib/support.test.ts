import { describe, expect, it } from "vitest";
import {
  RAIL_CAPACITY,
  isKeyboardPage,
  isSupportPinnedPage,
  splitSupporterRails,
} from "./support";

describe("splitSupporterRails", () => {
  it("keeps a short list in the left rail", () => {
    expect(splitSupporterRails(["Lena", "Max"])).toEqual({ left: ["Lena", "Max"], right: [], more: 0 });
    expect(splitSupporterRails([])).toEqual({ left: [], right: [], more: 0 });
  });

  it("deals a longer list alternately, newest first in both rails", () => {
    const names = Array.from({ length: 10 }, (_, i) => `n${i}`);
    const rails = splitSupporterRails(names);
    expect(rails.left).toEqual(["n0", "n2", "n4", "n6", "n8"]);
    expect(rails.right).toEqual(["n1", "n3", "n5", "n7", "n9"]);
    expect(rails.more).toBe(0);
  });

  it("counts what fits neither rail instead of dropping it", () => {
    const names = Array.from({ length: RAIL_CAPACITY * 2 + 5 }, (_, i) => `n${i}`);
    const rails = splitSupporterRails(names);
    expect(rails.left).toHaveLength(RAIL_CAPACITY);
    expect(rails.right).toHaveLength(RAIL_CAPACITY);
    expect(rails.more).toBe(5);
  });
});

describe("page rules", () => {
  it("pins only on the single-column game pages", () => {
    for (const path of ["/", "/wordle/", "/wordle", "/solo/leiter/", "/solo/kategorien/"]) {
      expect(isSupportPinnedPage(path)).toBe(true);
    }
    for (const path of ["/ueber/", "/wordle/duel/x/", "/koop/abc/", "/solostuff/"]) {
      expect(isSupportPinnedPage(path)).toBe(false);
    }
  });

  it("knows the pages with Wördle's keyboard", () => {
    expect(isKeyboardPage("/wordle/")).toBe(true);
    expect(isKeyboardPage("/wordle/duel/abc/")).toBe(true);
    expect(isKeyboardPage("/wordlex/")).toBe(false);
  });
});
