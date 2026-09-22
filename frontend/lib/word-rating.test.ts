import { describe, expect, it } from "vitest";
import {
  RATED_HISTORY_MAX,
  RATING_REASONS,
  RATING_VERDICTS,
  hasRated,
  loadRatedGames,
  nextStep,
  rememberRated,
  saveRatedGames,
} from "./word-rating";

/**
 * The state machine behind the post-round rating.
 *
 * Two properties carry the whole design and are tested here rather than
 * assumed: the reason step only follows the "too hard" verdict, because the
 * other two are complete answers and asking anyway spends a tap on nothing; and
 * a throwing `localStorage` hides nothing and breaks nothing, because it throws
 * in private mode and the game must not care.
 */

function throwingStorage(): Storage {
  const reject = () => {
    throw new DOMException("denied", "SecurityError");
  };
  return {
    get length() {
      return 0;
    },
    clear: reject,
    getItem: reject,
    key: reject,
    removeItem: reject,
    setItem: reject,
  } as unknown as Storage;
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  } as unknown as Storage;
}

describe("the catalogue", () => {
  it("keeps the verdicts in scale order, because the order is the scale", () => {
    expect(RATING_VERDICTS.map((option) => option.id)).toEqual(["easy", "right", "hard"]);
  });

  it("puts the reason that decides the pool first", () => {
    expect(RATING_REASONS[0].id).toBe("unknown_word");
  });

  it("gives every entry a German label", () => {
    for (const option of [...RATING_VERDICTS, ...RATING_REASONS]) {
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("the step after a verdict", () => {
  it("asks first", () => {
    expect(nextStep(null)).toBe("verdict");
  });

  it("asks why only after the hard verdict", () => {
    expect(nextStep("hard")).toBe("reason");
  });

  it("is finished after the other two, which explain themselves", () => {
    expect(nextStep("easy")).toBe("done");
    expect(nextStep("right")).toBe("done");
  });
});

describe("the memory of what was already rated", () => {
  it("remembers a game once", () => {
    expect(rememberRated([1, 2], 2)).toEqual([1, 2]);
    expect(rememberRated([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("keeps only the most recent entries", () => {
    const many = Array.from({ length: RATED_HISTORY_MAX + 50 }, (_, i) => i);
    const next = rememberRated(many, 99999);
    expect(next).toHaveLength(RATED_HISTORY_MAX);
    expect(next.at(-1)).toBe(99999);
  });

  it("answers whether a game was rated", () => {
    expect(hasRated([4, 5], 5)).toBe(true);
    expect(hasRated([4, 5], 6)).toBe(false);
  });

  it("round-trips through storage", () => {
    const store = memoryStorage();
    saveRatedGames(store, [7, 8, 9]);
    expect(loadRatedGames(store)).toEqual([7, 8, 9]);
  });

  it("ignores a stored value that is not a list of numbers", () => {
    const store = memoryStorage();
    store.setItem("kontexto_word_rating_v1", '{"nope": true}');
    expect(loadRatedGames(store)).toEqual([]);
  });

  it("drops entries that are not numbers rather than the whole list", () => {
    const store = memoryStorage();
    store.setItem("kontexto_word_rating_v1", '[1, "zwei", 3]');
    expect(loadRatedGames(store)).toEqual([1, 3]);
  });
});

describe("a storage that throws", () => {
  it("reads as nothing rated instead of breaking the game", () => {
    expect(loadRatedGames(throwingStorage())).toEqual([]);
  });

  it("swallows the write, so the question simply comes back", () => {
    expect(() => saveRatedGames(throwingStorage(), [1])).not.toThrow();
  });

  it("survives the absence of storage entirely, as on the server", () => {
    expect(loadRatedGames(undefined)).toEqual([]);
    expect(() => saveRatedGames(undefined, [1])).not.toThrow();
  });
});
