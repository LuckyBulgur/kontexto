import { beforeEach, describe, expect, it } from "vitest";
import {
  AD_CONSENT_KEY,
  AD_CONSENT_MAX_AGE_MS,
  AD_CONSENT_VERSION,
  clearAdcashStorage,
  parseAdConsent,
  readAdConsent,
  writeAdConsent,
} from "./ad-consent";
import { isAdcashPath } from "./adcash";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage;
}

function installBrowserEnv(): { events: string[] } {
  const events: string[] = [];
  const target = new EventTarget();
  const win = globalThis as unknown as Record<string, unknown>;
  win.window = globalThis;
  win.localStorage = memoryStorage();
  win.sessionStorage = memoryStorage();
  win.addEventListener = target.addEventListener.bind(target);
  win.removeEventListener = target.removeEventListener.bind(target);
  win.dispatchEvent = (event: Event) => {
    events.push(event.type);
    return target.dispatchEvent(event);
  };
  return { events };
}

const NOW = Date.parse("2026-09-23T12:00:00.000Z");
const record = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ v: AD_CONSENT_VERSION, choice: "granted", at: new Date(NOW).toISOString(), ...overrides });

describe("parseAdConsent", () => {
  it("accepts a current grant and a current refusal", () => {
    expect(parseAdConsent(record(), NOW)?.choice).toBe("granted");
    expect(parseAdConsent(record({ choice: "denied" }), NOW)?.choice).toBe("denied");
  });

  it("treats anything malformed as no decision, so nothing loads", () => {
    expect(parseAdConsent(null, NOW)).toBeNull();
    expect(parseAdConsent("granted", NOW)).toBeNull();
    expect(parseAdConsent("{}", NOW)).toBeNull();
    expect(parseAdConsent(record({ choice: "yes" }), NOW)).toBeNull();
    expect(parseAdConsent(record({ at: "not a date" }), NOW)).toBeNull();
  });

  it("asks again when the consent text version changed", () => {
    expect(parseAdConsent(record({ v: AD_CONSENT_VERSION - 1 }), NOW)).toBeNull();
    expect(parseAdConsent(record({ v: AD_CONSENT_VERSION + 1 }), NOW)).toBeNull();
  });

  it("expires grants and refusals alike after twelve months", () => {
    const old = new Date(NOW - AD_CONSENT_MAX_AGE_MS - 1).toISOString();
    const fresh = new Date(NOW - AD_CONSENT_MAX_AGE_MS + 60_000).toISOString();
    expect(parseAdConsent(record({ at: old }), NOW)).toBeNull();
    expect(parseAdConsent(record({ at: old, choice: "denied" }), NOW)).toBeNull();
    expect(parseAdConsent(record({ at: fresh }), NOW)?.choice).toBe("granted");
  });

  it("rejects a timestamp from the future", () => {
    expect(parseAdConsent(record({ at: new Date(NOW + 60_000).toISOString() }), NOW)).toBeNull();
  });
});

describe("writeAdConsent", () => {
  let env: { events: string[] };
  beforeEach(() => {
    env = installBrowserEnv();
  });

  it("stores version, choice and time and nothing else", () => {
    writeAdConsent("granted", new Date(NOW));
    const stored = JSON.parse(localStorage.getItem(AD_CONSENT_KEY) ?? "null") as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(["at", "choice", "v"]);
    expect(stored.choice).toBe("granted");
    expect(env.events).toEqual(["kontexto:ad-consent"]);
  });

  it("removes what Adcash wrote into this origin on a refusal and leaves the game alone", () => {
    localStorage.setItem("vast-client-total-calls", "1");
    localStorage.setItem("vast-client-total-calls-timeout", "1790188274377");
    localStorage.setItem("__VASTStorage__", "{}");
    localStorage.setItem("adcsh_dbg", "0");
    localStorage.setItem("suv5_12211322_state", "{}");
    sessionStorage.setItem("template", "x");
    localStorage.setItem("kontexto_state", "{}");
    localStorage.setItem("wordle_stats", "{}");

    writeAdConsent("denied");

    expect(localStorage.getItem("kontexto_state")).toBe("{}");
    expect(localStorage.getItem("wordle_stats")).toBe("{}");
    expect(sessionStorage.getItem("template")).toBeNull();
    const left = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).sort();
    expect(left).toEqual([AD_CONSENT_KEY, "kontexto_state", "wordle_stats"]);
  });

  it("keeps the decision for the page view when storage refuses to write", () => {
    const storage = localStorage;
    storage.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    writeAdConsent("denied");
    expect(readAdConsent()?.choice).toBe("denied");
  });

  it("clearAdcashStorage survives blocked storage", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(() => clearAdcashStorage()).not.toThrow();
  });
});

describe("isAdcashPath", () => {
  it("allows the two single-player pages, with or without the trailing slash", () => {
    expect(isAdcashPath("/")).toBe(true);
    expect(isAdcashPath("/wordle/")).toBe(true);
    expect(isAdcashPath("/wordle")).toBe(true);
  });

  it("keeps multiplayer rooms, content, legal pages and the overlay free", () => {
    for (const path of [
      "/duel/",
      "/duel/abc123/",
      "/koop/abc/",
      "/arena/x/",
      "/wordle/duel/x/",
      "/live/overlay/",
      "/solo/leiter/",
      "/blog/was-ist-contexto-auf-deutsch/",
      "/datenschutz/",
      "/impressum/",
      "/admin/",
    ]) {
      expect(isAdcashPath(path), path).toBe(false);
    }
  });

  it("does not treat missing or decorated paths as eligible", () => {
    expect(isAdcashPath(null)).toBe(false);
    expect(isAdcashPath(undefined)).toBe(false);
    expect(isAdcashPath("")).toBe(false);
    expect(isAdcashPath("/wordle/?game=2")).toBe(false);
  });
});
