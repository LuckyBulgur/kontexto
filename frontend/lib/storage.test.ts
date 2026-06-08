import { describe, it, expect, beforeEach } from "vitest";
import { loadInfiniteSession, saveInfiniteSession, clearInfiniteSession } from "./storage";
import type { InfiniteSession } from "./types";

/** Minimaler Map-basierter Storage-Stub + Browser-Umgebung (kein jsdom nötig). */
function installBrowserEnv(): void {
  const map = new Map<string, string>();
  const storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage;
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
}

const sampleSession: InfiniteSession = {
  current: { gameNumber: 7, guesses: [{ word: "fisch", rank: 3, isTip: false }], tips: 1, solved: false },
  played: [2, 5],
  solvedCount: 4,
  totalGames: 200,
};

describe("infinite session storage", () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  it("returns null when no session is stored", () => {
    expect(loadInfiniteSession()).toBeNull();
  });

  it("round-trips a saved session", () => {
    saveInfiniteSession(sampleSession);
    expect(loadInfiniteSession()).toEqual(sampleSession);
  });

  it("clears the session", () => {
    saveInfiniteSession(sampleSession);
    clearInfiniteSession();
    expect(loadInfiniteSession()).toBeNull();
  });

  it("rejects a structurally invalid session", () => {
    localStorage.setItem("kontexto_infinite", JSON.stringify({ played: [1] }));
    expect(loadInfiniteSession()).toBeNull();
  });

  it("rejects a session whose played list is malformed", () => {
    localStorage.setItem(
      "kontexto_infinite",
      JSON.stringify({ current: { gameNumber: 1, guesses: [], tips: 0, solved: false }, played: "nope" }),
    );
    expect(loadInfiniteSession()).toBeNull();
  });

  it("survives corrupt JSON", () => {
    localStorage.setItem("kontexto_infinite", "{not json");
    expect(loadInfiniteSession()).toBeNull();
  });
});
