import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EVENT_FORCE_KEY,
  EVENT_THEME_SCRIPT,
  SPOOKTOBER_2026,
  activeEvent,
  applyEventClass,
  availableEvent,
  clearRetiredEventStorage,
  isExcludedPath,
} from "./event-theme";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  has(key: string): boolean {
    return this.map.has(key);
  }
}

class FakeClassList {
  readonly set = new Set<string>();
  add(c: string): void {
    this.set.add(c);
  }
  remove(c: string): void {
    this.set.delete(c);
  }
  contains(c: string): boolean {
    return this.set.has(c);
  }
  toggle(c: string, force?: boolean): boolean {
    const on = force ?? !this.set.has(c);
    if (on) this.set.add(c);
    else this.set.delete(c);
    return on;
  }
}

const BEFORE = Date.UTC(2026, 8, 30, 21, 59, 59);
const START = Date.UTC(2026, 8, 30, 22, 0, 0);
const LAST = Date.UTC(2026, 9, 31, 22, 59, 59);
const END = Date.UTC(2026, 9, 31, 23, 0, 0);

let storage: MemoryStorage;
let classList: FakeClassList;

function setPath(pathname: string): void {
  vi.stubGlobal("window", { location: { pathname } });
  vi.stubGlobal("location", { pathname });
}

/** Runs the inline head script against the fakes and reports the class it set. */
function runScript(now: number, pathname = "/"): boolean {
  vi.setSystemTime(now);
  const list = new FakeClassList();
  const run = new Function("document", "localStorage", "location", EVENT_THEME_SCRIPT);
  run({ documentElement: { classList: list } }, storage, { pathname });
  return list.contains(SPOOKTOBER_2026.className);
}

beforeEach(() => {
  vi.useFakeTimers();
  storage = new MemoryStorage();
  classList = new FakeClassList();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("document", { documentElement: { classList } });
  setPath("/");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("event window", () => {
  it.each([
    [BEFORE, false],
    [START, true],
    [LAST, true],
    [END, false],
  ])("at %d is active: %s", (now, expected) => {
    expect(activeEvent(now)?.id === SPOOKTOBER_2026.id).toBe(expected);
    expect(runScript(now)).toBe(expected);
  });

  it("covers the whole of October in Berlin time across the DST change", () => {
    // 2026-10-01 00:00 CEST and 2026-11-01 00:00 CET.
    expect(new Date(START).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })).toBe("1.10.2026, 00:00:00");
    expect(new Date(END).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })).toBe("1.11.2026, 00:00:00");
  });
});

describe("opt-out", () => {
  it("hides the skin but keeps the switch available", () => {
    storage.setItem(SPOOKTOBER_2026.optOutKey, "off");
    expect(activeEvent(START)).toBeNull();
    expect(availableEvent(START)?.id).toBe(SPOOKTOBER_2026.id);
    expect(runScript(START)).toBe(false);
  });

  it("ignores the retired WM opt-out, which belonged to another event", () => {
    storage.setItem("kontexto_event_theme", "off");
    expect(activeEvent(START)?.id).toBe(SPOOKTOBER_2026.id);
    expect(runScript(START)).toBe(true);
  });
});

describe("QA override", () => {
  it("forces the event outside its window and over an opt-out", () => {
    storage.setItem(SPOOKTOBER_2026.optOutKey, "off");
    for (const value of [SPOOKTOBER_2026.id, "on"]) {
      storage.setItem(EVENT_FORCE_KEY, value);
      expect(activeEvent(BEFORE)?.id).toBe(SPOOKTOBER_2026.id);
      expect(runScript(BEFORE)).toBe(true);
    }
  });

  it("suppresses the event inside its window", () => {
    storage.setItem(EVENT_FORCE_KEY, "off");
    expect(activeEvent(START)).toBeNull();
    expect(availableEvent(START)).toBeNull();
    expect(runScript(START)).toBe(false);
  });

  it("falls back to the calendar for an unknown value", () => {
    storage.setItem(EVENT_FORCE_KEY, "halloween-1999");
    expect(activeEvent(START)?.id).toBe(SPOOKTOBER_2026.id);
    expect(activeEvent(BEFORE)).toBeNull();
    expect(runScript(START)).toBe(true);
    expect(runScript(BEFORE)).toBe(false);
  });
});

describe("excluded paths", () => {
  it.each(["/admin", "/admin/", "/admin/stats/", "/live/overlay/"])("%s never carries a skin", (path) => {
    setPath(path);
    storage.setItem(EVENT_FORCE_KEY, "on");
    expect(isExcludedPath(path)).toBe(true);
    expect(activeEvent(START, path)).toBeNull();
    expect(availableEvent(START, path)).toBeNull();
    expect(runScript(START, path)).toBe(false);
  });

  it.each(["/", "/live/", "/administration-is-not-admin/", "/wordle/"])("%s does", (path) => {
    expect(isExcludedPath(path)).toBe(false);
    expect(runScript(START, path)).toBe(true);
  });
});

describe("applyEventClass", () => {
  it("adds and removes the class with the state", () => {
    applyEventClass("/", START);
    expect(classList.contains(SPOOKTOBER_2026.className)).toBe(true);
    applyEventClass("/admin/", START);
    expect(classList.contains(SPOOKTOBER_2026.className)).toBe(false);
    applyEventClass("/", END);
    expect(classList.contains(SPOOKTOBER_2026.className)).toBe(false);
  });
});

describe("retired storage", () => {
  it("removes the WM keys and nothing else", () => {
    storage.setItem("kontexto_event_theme", "off");
    storage.setItem("kontexto_wm2026_notice", "dismissed");
    storage.setItem(SPOOKTOBER_2026.optOutKey, "off");
    clearRetiredEventStorage(storage);
    expect(storage.has("kontexto_event_theme")).toBe(false);
    expect(storage.has("kontexto_wm2026_notice")).toBe(false);
    expect(storage.has(SPOOKTOBER_2026.optOutKey)).toBe(true);
  });
});

describe("head script", () => {
  it("survives a storage that throws", () => {
    vi.setSystemTime(START);
    const run = new Function("document", "localStorage", "location", EVENT_THEME_SCRIPT);
    const throwing = {
      getItem() {
        throw new Error("blocked");
      },
    };
    expect(() => run({ documentElement: { classList: new FakeClassList() } }, throwing, { pathname: "/" })).not.toThrow();
  });
});
