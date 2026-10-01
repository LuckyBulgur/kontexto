// verify-language-fixture: the labels under test are the German UI strings.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  CategorySetup,
  DEFAULT_CATEGORY_SETUP,
  categoryQuery,
  fetchCategories,
  loadCategorySetup,
  normalizeSetup,
  roomCategoryBody,
  saveCategorySetup,
  setupLabel,
  showsCategory,
} from "./categories";
import {
  CATEGORY_PLAYED_LIMIT,
  categoryApplyGuess,
  categoryApplyTip,
  categoryGiveUp,
  categoryPlayedAfter,
  createCategoryRoundState,
  soloBestRank,
  soloGuessCount,
} from "./solo-modes";
import { createDuel } from "./duel-api";
import { createKoop } from "./koop-api";
import { createArena } from "./arena-api";
import { getInfiniteGame } from "./api";

const CATALOGUE = [
  { id: "animals", name: "Tiere" },
  { id: "food", name: "Essen und Trinken" },
  { id: "music", name: "Musik und Klang" },
];

function stubFetch(body: unknown, status = 200) {
  const calls: { url: string; body?: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
      return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the setup", () => {
  it("defaults to every field with the field shown", () => {
    expect(DEFAULT_CATEGORY_SETUP).toEqual({ categories: [], showCategory: true });
  });

  it("always shows a single chosen field, whatever the switch says", () => {
    expect(showsCategory({ categories: ["animals"], showCategory: false })).toBe(true);
    expect(showsCategory({ categories: ["animals", "food"], showCategory: false })).toBe(false);
    expect(showsCategory({ categories: [], showCategory: true })).toBe(true);
  });

  it("travels as a comma list and as a room body", () => {
    const setup: CategorySetup = { categories: ["animals"], showCategory: false };
    expect(categoryQuery(setup)).toBe("animals");
    expect(roomCategoryBody(setup)).toEqual({ categories: ["animals"], show_category: true });
    expect(categoryQuery(DEFAULT_CATEGORY_SETUP)).toBe("");
  });

  it("drops fields the server no longer offers and takes its order", () => {
    const normalized = normalizeSetup({ categories: ["music", "merged", "animals"], showCategory: false }, CATALOGUE);
    expect(normalized).toEqual({ categories: ["animals", "music"], showCategory: false });
  });

  it("names itself in one line", () => {
    expect(setupLabel({ categories: [], showCategory: true }, CATALOGUE)).toBe("Alle Kategorien");
    expect(setupLabel({ categories: ["food"], showCategory: true }, CATALOGUE)).toBe("Essen und Trinken");
    expect(setupLabel({ categories: ["animals", "music"], showCategory: true }, CATALOGUE)).toBe("Tiere oder Musik und Klang");
    expect(setupLabel({ categories: ["animals", "food", "music"], showCategory: true }, CATALOGUE)).toBe("3 Kategorien");
  });
});

// The suite runs in the `node` environment, so storage is an in-memory stub,
// the same shape lib/palette.test.ts uses.
function stubStorage(overrides: Partial<Storage> = {}) {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    ...overrides,
  };
  vi.stubGlobal("window", { localStorage: storage });
  vi.stubGlobal("localStorage", storage);
}

describe("the remembered setup", () => {
  beforeEach(() => stubStorage());

  it("round-trips through storage", () => {
    saveCategorySetup({ categories: ["food"], showCategory: false });
    expect(loadCategorySetup()).toEqual({ categories: ["food"], showCategory: false });
  });

  it("ignores a broken or foreign payload", () => {
    localStorage.setItem("kontexto_category_setup", "{not json");
    expect(loadCategorySetup()).toBeNull();
    localStorage.setItem("kontexto_category_setup", JSON.stringify({ categories: "animals" }));
    expect(loadCategorySetup()).toBeNull();
  });

  it("survives a storage that throws", () => {
    stubStorage({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    });
    expect(loadCategorySetup()).toBeNull();
    expect(() => saveCategorySetup(DEFAULT_CATEGORY_SETUP)).not.toThrow();
  });

  it("reads nothing where there is no window", () => {
    vi.unstubAllGlobals();
    expect(loadCategorySetup()).toBeNull();
  });
});

describe("the requests", () => {
  it("fetches the catalogue", async () => {
    const calls = stubFetch({ categories: [{ ...CATALOGUE[0], count: 44 }] });
    expect(await fetchCategories()).toEqual([{ id: "animals", name: "Tiere", count: 44 }]);
    expect(calls[0].url).toMatch(/\/categories$/);
  });

  it("narrows the endless draw only when asked", async () => {
    const calls = stubFetch({ gameNumber: 5, total: 100, totalGames: 10, category: CATALOGUE[0] });
    await getInfiniteGame([3], null, ["animals", "food"]);
    await getInfiniteGame([3]);
    expect(calls[0].url).toContain("categories=animals%2Cfood");
    expect(calls[1].url).not.toContain("categories");
  });

  it("adds the field rule to a room body and nothing without one", async () => {
    const calls = stubFetch({ duel_id: "A", koop_id: "A", arena_id: "A", player_token: "t", mode: "royale" });
    const setup: CategorySetup = { categories: ["animals"], showCategory: false };
    await createDuel("random", "Alice", true, setup);
    await createKoop("random", "Alice", true, setup);
    await createArena("royale", "random", "Alice", setup);
    await createDuel("today", "Alice", true);
    for (const call of calls.slice(0, 3)) {
      const body = JSON.parse(call.body ?? "{}");
      expect(body.categories).toEqual(["animals"]);
      expect(body.show_category).toBe(true);
      expect(body).not.toHaveProperty("game_number");
    }
    expect(JSON.parse(calls[3].body ?? "{}")).not.toHaveProperty("categories");
  });
});

describe("a category round", () => {
  const setup: CategorySetup = { categories: ["animals"], showCategory: true };

  it("is won on rank 1 and counts guesses without tips", () => {
    let state = createCategoryRoundState(7, CATALOGUE[0], setup);
    state = categoryApplyTip(state, { word: "katze", rank: 40 });
    state = categoryApplyGuess(state, { word: "maus", rank: 12 });
    expect(state.status).toBe("running");
    state = categoryApplyGuess(state, { word: "hund", rank: 1 });
    expect(state.status).toBe("won");
    expect(state.tips).toBe(1);
    expect(soloGuessCount(state)).toBe(2);
    expect(soloBestRank(state)).toBe(1);
  });

  it("refuses a tip it already has and anything after the round", () => {
    let state = createCategoryRoundState(7, null, setup);
    state = categoryApplyTip(state, { word: "katze", rank: 40 });
    expect(categoryApplyTip(state, { word: "katze", rank: 40 })).toBe(state);
    const over = categoryGiveUp(state, "hund");
    expect(over.status).toBe("lost");
    expect(over.revealed).toBe("hund");
    expect(categoryApplyGuess(over, { word: "maus", rank: 3 })).toBe(over);
    expect(categoryGiveUp(over, "maus")).toBe(over);
  });

  it("remembers what the session played, bounded", () => {
    const state = createCategoryRoundState(9, null, setup, [1, 2]);
    expect(categoryPlayedAfter(state)).toEqual([1, 2, 9]);
    const long = Array.from({ length: CATEGORY_PLAYED_LIMIT + 10 }, (_, i) => i + 100);
    expect(createCategoryRoundState(1, null, setup, long).played).toHaveLength(CATEGORY_PLAYED_LIMIT);
  });
});
