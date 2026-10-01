import { describe, expect, it } from "vitest";
import {
  PROGRESS_KEY,
  SECRETS,
  emptyProgress,
  isComplete,
  isSpookyWordleWord,
  loadProgress,
  matchSpookyWord,
  parseProgress,
  recordSecret,
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
    ["werwolf", "wolf"],
    ["woelfe", "wolf"],
    ["eule", "owl"],
    ["Rabe", "owl"],
    ["nebel", "fog"],
    ["vollmond", "moon"],
    ["zaubertrank", "bubbles"],
    ["kessel", "bubbles"],
  ])("%s wakes %s", (word, kind) => {
    expect(matchSpookyWord(word)).toBe(kind);
  });

  it.each(["hund", "blut", "", "geistreich", "nebelig"])("%s wakes nothing", (word) => {
    expect(matchSpookyWord(word)).toBeNull();
  });

  it("maps the secret-bearing effects and leaves the extras free", () => {
    expect(secretForEffect("ghost")).toBe("ghost");
    expect(secretForEffect("flashlight")).toBe("flashlight");
    expect(secretForEffect("cat")).toBeNull();
    expect(secretForEffect("candy")).toBeNull();
    for (const extra of ["wolf", "owl", "fog", "moon", "bubbles"] as const) expect(secretForEffect(extra)).toBeNull();
  });
});

describe("isSpookyWordleWord", () => {
  it("accepts the spooky rows in any case", () => {
    expect(isSpookyWordleWord("GEIST")).toBe(true);
    expect(isSpookyWordleWord("nebel")).toBe(true);
    expect(isSpookyWordleWord("HAUSE")).toBe(false);
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

  it("drops unknown ids, duplicates and malformed entries", () => {
    const raw = JSON.stringify({
      v: 1,
      secrets: ["ghost", "ghost", "toString", 7, "lost"],
      announced: "yes",
    });
    expect(parseProgress(raw)).toEqual({ v: 1, secrets: ["ghost", "lost"], announced: false });
  });

  it("reads an entry of the first October build, with candy and the graveyard secret", () => {
    const raw = JSON.stringify({
      v: 1,
      secrets: ["pumpkin", "tombstone", "spider"],
      solves: ["kontexto:512", "wordle:daily:40"],
      announced: true,
    });
    expect(parseProgress(raw)).toEqual({ v: 1, secrets: ["pumpkin", "spider"], announced: true });
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
