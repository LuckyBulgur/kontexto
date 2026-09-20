import { describe, expect, it } from "vitest";
import {
  DEFAULT_SURVEY_STATE,
  MAX_INLINE_VIEWS,
  SURVEY_OPTIONS,
  SURVEY_STORAGE_KEY,
  loadSurveyState,
  markAnswered,
  markDialogShown,
  markDialogSkipped,
  markDismissed,
  markInlineView,
  saveSurveyState,
  shouldShowDialog,
  shouldShowInline,
  shuffleOptions,
} from "./survey";

const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

function throwingStorage(): Storage {
  return {
    get length(): number {
      throw new Error("blocked");
    },
    clear: () => { throw new Error("blocked"); },
    getItem: () => { throw new Error("blocked"); },
    key: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
  } as Storage;
}

describe("shuffleOptions", () => {
  it("keeps every option exactly once", () => {
    const shuffled = shuffleOptions(SURVEY_OPTIONS, () => 0.42);
    expect(shuffled).toHaveLength(SURVEY_OPTIONS.length);
    expect(new Set(shuffled.map((o) => o.id))).toEqual(new Set(SURVEY_OPTIONS.map((o) => o.id)));
  });

  it("pins the two catch-all answers to the end", () => {
    for (const random of [() => 0, () => 0.5, () => 0.999]) {
      const ids = shuffleOptions(SURVEY_OPTIONS, random).map((o) => o.id);
      expect(ids.slice(-2)).toEqual(["random", "other"]);
    }
  });

  it("actually reorders the concrete options", () => {
    // random() === 0 swaps every position with the first one, so the result is
    // a different permutation and the shuffle is proven to run at all.
    const ids = shuffleOptions(SURVEY_OPTIONS, () => 0).map((o) => o.id);
    const original = SURVEY_OPTIONS.map((o) => o.id);
    expect(ids).not.toEqual(original);
  });
});

describe("persistence", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    const state = markDialogShown(DEFAULT_SURVEY_STATE, NOW);
    saveSurveyState(storage, state);
    expect(loadSurveyState(storage)).toEqual(state);
  });

  it("falls back to the default state on junk", () => {
    const storage = memoryStorage({ [SURVEY_STORAGE_KEY]: "{not json" });
    expect(loadSurveyState(storage)).toEqual(DEFAULT_SURVEY_STATE);
  });

  it("falls back to the default state on a structurally wrong value", () => {
    const storage = memoryStorage({ [SURVEY_STORAGE_KEY]: JSON.stringify({ status: "maybe" }) });
    expect(loadSurveyState(storage)).toEqual(DEFAULT_SURVEY_STATE);
  });

  it("survives a storage that throws (private mode)", () => {
    const storage = throwingStorage();
    expect(loadSurveyState(storage)).toEqual(DEFAULT_SURVEY_STATE);
    expect(() => saveSurveyState(storage, DEFAULT_SURVEY_STATE)).not.toThrow();
  });

  it("survives an undefined storage (server render)", () => {
    expect(loadSurveyState(undefined)).toEqual(DEFAULT_SURVEY_STATE);
  });
});

describe("the one-time dialog", () => {
  it("opens for a fresh visitor", () => {
    expect(shouldShowDialog(DEFAULT_SURVEY_STATE)).toBe(true);
  });

  it("never opens a second time, not even after a skip", () => {
    const shown = markDialogShown(DEFAULT_SURVEY_STATE, NOW);
    expect(shouldShowDialog(shown)).toBe(false);
    expect(shouldShowDialog(markDialogSkipped(shown, NOW + 1000))).toBe(false);
  });

  it("never opens for an answered or dismissed visitor", () => {
    expect(shouldShowDialog(markAnswered(DEFAULT_SURVEY_STATE, NOW))).toBe(false);
    expect(shouldShowDialog(markDismissed(DEFAULT_SURVEY_STATE, NOW))).toBe(false);
  });

  it("blocks the inline fallback until it has been shown", () => {
    expect(shouldShowInline(DEFAULT_SURVEY_STATE)).toBe(false);
  });
});

describe("the inline fallback", () => {
  const skipped = markDialogSkipped(markDialogShown(DEFAULT_SURVEY_STATE, NOW), NOW);

  it("asks after a skipped dialog", () => {
    expect(shouldShowInline(skipped)).toBe(true);
  });

  it("stops after the view cap", () => {
    let state = skipped;
    for (let i = 0; i < MAX_INLINE_VIEWS; i++) {
      expect(shouldShowInline(state)).toBe(true);
      state = markInlineView(state, NOW + i);
    }
    expect(shouldShowInline(state)).toBe(false);
  });

  it("stops at once when it is declined", () => {
    expect(shouldShowInline(markDismissed(skipped, NOW))).toBe(false);
  });

  it("stops once an answer is in", () => {
    expect(shouldShowInline(markAnswered(skipped, NOW))).toBe(false);
  });

  it("keeps the first timestamp across views", () => {
    const first = markInlineView(skipped, NOW + 1000);
    const second = markInlineView(first, NOW + 5000);
    expect(second.firstSeenAt).toBe(NOW);
    expect(second.lastSeenAt).toBe(NOW + 5000);
  });
});
