import { describe, expect, it } from "vitest";
import {
  CANDIES,
  MAX_SOLVES,
  PROGRESS_KEY,
  SECRETS,
  candyCounts,
  candyFor,
  emptyProgress,
  isComplete,
  isSpookyWordleWord,
  loadProgress,
  matchSpookyWord,
  parseProgress,
  recordSecret,
  recordSolve,
  saveProgress,
  secretForEffect,
} from "./spooktober";

describe("catalogue", () => {
  it("holds exactly thirteen secrets with unique ids", () => {
    expect(SECRETS).toHaveLength(13);
    expect(new Set(SECRETS.map((s) => s.id)).size).toBe(13);
  });

  it("gives every secret a name, a found line and a hint", () => {
    for (const s of SECRETS) {
      expect(s.name.length).toBeGreaterThan(2);
      expect(s.found.length).toBeGreaterThan(10);
      expect(s.hint.length).toBeGreaterThan(10);
    }
  });
});

describe("matchSpookyWord", () => {
  it.each([
    ["geist", "ghost"],
    ["Gespenster", "ghost"],
    ["  SPINNE ", "spider"],
    ["fledermäuse", "bats"],
    ["fledermaeuse", "bats"],
    ["kuerbis", "candy"],
    ["kürbisse", "candy"],
    ["kuerbisse", "candy"],
    ["suessigkeit", "candy"],
    ["süßigkeiten", "candy"],
    ["hexe", "witch"],
    ["zombie", "bones"],
    ["taschenlampe", "flashlight"],
    ["katze", "cat"],
  ])("%s wakes %s", (word, kind) => {
    expect(matchSpookyWord(word)).toBe(kind);
  });

  it.each(["hund", "blut", "", "geistreich", "nebel"])("%s wakes nothing", (word) => {
    expect(matchSpookyWord(word)).toBeNull();
  });

  it("maps the secret-bearing effects and leaves the extras free", () => {
    expect(secretForEffect("ghost")).toBe("ghost");
    expect(secretForEffect("flashlight")).toBe("flashlight");
    expect(secretForEffect("cat")).toBeNull();
    expect(secretForEffect("candy")).toBeNull();
  });
});

describe("isSpookyWordleWord", () => {
  it("accepts the spooky rows in any case", () => {
    expect(isSpookyWordleWord("GEIST")).toBe(true);
    expect(isSpookyWordleWord("nebel")).toBe(true);
    expect(isSpookyWordleWord("HAUSE")).toBe(false);
  });
});

describe("candy", () => {
  it("is deterministic per round", () => {
    expect(candyFor("kontexto:512")).toEqual(candyFor("kontexto:512"));
  });

  it("spreads over every kind", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(candyFor(`kontexto:${i}`).id);
    expect(seen.size).toBe(CANDIES.length);
  });

  it("pays a round once", () => {
    const first = recordSolve(emptyProgress(), "wordle:40");
    expect(first.isNew).toBe(true);
    const again = recordSolve(first.progress, "wordle:40");
    expect(again.isNew).toBe(false);
    expect(again.progress).toBe(first.progress);
    const counts = candyCounts(again.progress);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(1);
    expect(counts[first.candy.id]).toBe(1);
  });

  it("keeps at most the newest rounds", () => {
    let progress = emptyProgress();
    for (let i = 0; i < MAX_SOLVES + 5; i += 1) progress = recordSolve(progress, `k:${i}`).progress;
    expect(progress.solves).toHaveLength(MAX_SOLVES);
    expect(progress.solves[0]).toBe("k:5");
  });
});

describe("secrets", () => {
  it("records once and completes at thirteen", () => {
    let progress = emptyProgress();
    for (const s of SECRETS) {
      expect(isComplete(progress)).toBe(false);
      const result = recordSecret(progress, s.id);
      expect(result.isNew).toBe(true);
      progress = result.progress;
    }
    expect(isComplete(progress)).toBe(true);
    expect(recordSecret(progress, "ghost").isNew).toBe(false);
  });
});

describe("parseProgress", () => {
  it.each([null, "", "{", "[]", "42", '{"v":2,"secrets":["ghost"]}', "null"])("starts over on %s", (raw) => {
    expect(parseProgress(raw)).toEqual(emptyProgress());
  });

  it("drops unknown ids, duplicates and malformed keys", () => {
    const raw = JSON.stringify({
      v: 1,
      secrets: ["ghost", "ghost", "toString", 7, "lost"],
      solves: ["a:1", "a:1", 3, "", "x".repeat(201), "b:2"],
      announced: "yes",
    });
    expect(parseProgress(raw)).toEqual({ v: 1, secrets: ["ghost", "lost"], solves: ["a:1", "b:2"], announced: false });
  });

  it("round-trips through storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const progress = { ...recordSecret(emptyProgress(), "spider").progress, announced: true };
    saveProgress(storage, progress);
    expect(store.has(PROGRESS_KEY)).toBe(true);
    expect(loadProgress(storage)).toEqual(progress);
  });

  it("tolerates a storage that throws", () => {
    const throwing = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadProgress(throwing)).toEqual(emptyProgress());
    expect(() => saveProgress(throwing, emptyProgress())).not.toThrow();
    expect(loadProgress(null)).toEqual(emptyProgress());
  });
});
