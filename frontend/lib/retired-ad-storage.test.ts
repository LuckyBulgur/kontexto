import { describe, expect, it } from "vitest";
import { clearRetiredAdStorage, RETIRED_AD_CONSENT_KEY } from "./retired-ad-storage";

class MemoryStorage {
  private readonly items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  keys(): string[] {
    return [...this.items.keys()].sort();
  }
}

describe("clearRetiredAdStorage", () => {
  it("removes the consent record and every Adcash key, and nothing else", () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    for (const key of [
      RETIRED_AD_CONSENT_KEY, "adcsh_freq", "suv5_id", "vast-client-1", "__VASTStorage__x",
      "kontexto_state", "kontexto_stats", "wordle_stats", "kontexto_theme",
    ]) {
      local.setItem(key, "1");
    }
    session.setItem("template", "1");
    session.setItem("kontexto_session", "1");

    clearRetiredAdStorage(local, session);

    expect(local.keys()).toEqual(["kontexto_state", "kontexto_stats", "kontexto_theme", "wordle_stats"]);
    expect(session.keys()).toEqual(["kontexto_session"]);
  });

  it("is a no-op on empty storage", () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    clearRetiredAdStorage(local, session);
    expect(local.length).toBe(0);
    expect(session.length).toBe(0);
  });
});
