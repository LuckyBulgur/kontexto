import { describe, it, expect } from "vitest";
import { isFeatureDiscovered, markFeatureDiscovered } from "./feature-discovery";

/** Minimaler Map-basierter Storage-Stub (kein jsdom nötig). */
function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

/** Storage, dessen Zugriffe immer werfen (Privatmodus / deaktivierte Cookies). */
const throwingStorage: Storage = {
  length: 0,
  clear: () => {
    throw new Error("denied");
  },
  getItem: () => {
    throw new Error("denied");
  },
  key: () => {
    throw new Error("denied");
  },
  removeItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
};

const KEY = "kontexto_duel_discovered";

describe("feature-discovery", () => {
  it("reports a fresh feature as not discovered", () => {
    expect(isFeatureDiscovered(createStorage(), KEY)).toBe(false);
  });

  it("persists the discovery and reports it afterwards", () => {
    const storage = createStorage();
    markFeatureDiscovered(storage, KEY);
    expect(storage.getItem(KEY)).toBe("1");
    expect(isFeatureDiscovered(storage, KEY)).toBe(true);
  });

  it("isolates discovery state per key", () => {
    const storage = createStorage();
    markFeatureDiscovered(storage, KEY);
    expect(isFeatureDiscovered(storage, "wordle_duel_discovered")).toBe(false);
  });

  it("treats an undefined storage as not discovered (SSR-safe)", () => {
    expect(isFeatureDiscovered(undefined, KEY)).toBe(false);
    expect(() => markFeatureDiscovered(undefined, KEY)).not.toThrow();
  });

  it("never throws when the storage backend throws", () => {
    expect(isFeatureDiscovered(throwingStorage, KEY)).toBe(false);
    expect(() => markFeatureDiscovered(throwingStorage, KEY)).not.toThrow();
  });
});
