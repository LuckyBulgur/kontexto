import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_ORDER,
  PALETTE_SCRIPT,
  isPaletteId,
  loadPalette,
  savePalette,
} from "./palette";

// The suite runs in the `node` environment (vitest.config.mts) and jsdom is not
// a dependency. A four-line in-memory store is enough for what this module
// touches, and it keeps the test honest about exactly which globals the code
// needs to survive without.
function stubBrowser(store: Map<string, string> = new Map()) {
  const attrs = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  vi.stubGlobal("window", { localStorage });
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("document", {
    documentElement: {
      dataset: {} as Record<string, string>,
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      getAttribute: (k: string) => attrs.get(k) ?? null,
      hasAttribute: (k: string) => attrs.has(k),
    },
  });
  return { store, attrs };
}

beforeEach(() => {
  stubBrowser();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("palette catalogue", () => {
  it("lists every palette exactly once, in a fixed order", () => {
    expect([...PALETTE_ORDER].sort()).toEqual(Object.keys(PALETTES).sort());
    expect(new Set(PALETTE_ORDER).size).toBe(PALETTE_ORDER.length);
  });

  it("keeps Tinte as the default, so an unset visitor sees the shipped look", () => {
    expect(DEFAULT_PALETTE).toBe("tinte");
    expect(PALETTE_ORDER[0]).toBe("tinte");
  });

  it("offers Klassisch, the palette from before the redesign", () => {
    expect(PALETTES.klassisch.name).toBe("Klassisch");
  });

  it("gives every palette a hint short enough for the picker column", () => {
    for (const id of PALETTE_ORDER) {
      expect(PALETTES[id].hint.length).toBeLessThanOrEqual(16);
    }
  });
});

describe("isPaletteId", () => {
  it("accepts the known ids and nothing else", () => {
    for (const id of PALETTE_ORDER) expect(isPaletteId(id)).toBe(true);
    for (const junk of ["", "TINTE", "rot", null, undefined, 3, {}]) {
      expect(isPaletteId(junk)).toBe(false);
    }
  });

  it("does not accept inherited Object properties", () => {
    expect(isPaletteId("toString")).toBe(false);
    expect(isPaletteId("constructor")).toBe(false);
  });
});

describe("loadPalette", () => {
  it("returns what was saved", () => {
    savePalette("beere");
    expect(loadPalette()).toBe("beere");
  });

  it("falls back to the default for a value that is no longer valid", () => {
    localStorage.setItem("kontexto_palette", "neon");
    expect(loadPalette()).toBe(DEFAULT_PALETTE);
  });

  it("survives blocked site data instead of throwing into the render", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("site data blocked");
      },
      setItem: () => {
        throw new Error("site data blocked");
      },
    });
    expect(loadPalette()).toBe(DEFAULT_PALETTE);
    expect(() => savePalette("petrol")).not.toThrow();
  });
});

describe("PALETTE_SCRIPT", () => {
  it("applies a known id and ignores anything else", () => {
    const { attrs } = stubBrowser();

    localStorage.setItem("kontexto_palette", "neon");
    new Function(PALETTE_SCRIPT)();
    expect(attrs.has("data-palette")).toBe(false);

    localStorage.setItem("kontexto_palette", "petrol");
    new Function(PALETTE_SCRIPT)();
    expect(attrs.get("data-palette")).toBe("petrol");
  });

  it("names every id from the catalogue, so a new palette is never silently dropped", () => {
    for (const id of PALETTE_ORDER) {
      expect(PALETTE_SCRIPT).toContain(`"${id}"`);
    }
  });
});
