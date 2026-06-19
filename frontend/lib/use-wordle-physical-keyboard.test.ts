import { describe, it, expect } from "vitest";
import { isTextEntryTarget, mapKeyboardEvent } from "./use-wordle-physical-keyboard";

/** Baut ein minimales KeyboardEvent-ähnliches Objekt für die reine Mapping-Logik. */
function keyEvent(
  key: string,
  opts: {
    target?: { tagName?: string; isContentEditable?: boolean } | null;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
  } = {},
) {
  return {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    altKey: opts.altKey ?? false,
    target: (opts.target ?? null) as EventTarget | null,
  };
}

describe("isTextEntryTarget", () => {
  it("erkennt input/textarea/select", () => {
    expect(isTextEntryTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isTextEntryTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isTextEntryTarget({ tagName: "SELECT" } as unknown as EventTarget)).toBe(true);
  });

  it("erkennt contentEditable-Elemente", () => {
    expect(
      isTextEntryTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget),
    ).toBe(true);
  });

  it("ignoriert Nicht-Eingabe-Elemente und null", () => {
    expect(isTextEntryTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
    expect(isTextEntryTarget({ tagName: "DIV" } as unknown as EventTarget)).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget({} as unknown as EventTarget)).toBe(false);
  });
});

describe("mapKeyboardEvent", () => {
  it("mappt einen Buchstaben ohne fokussiertes Feld", () => {
    expect(mapKeyboardEvent(keyEvent("a"))).toBe("a");
    expect(mapKeyboardEvent(keyEvent("Z"))).toBe("Z");
  });

  it("ignoriert Buchstaben, wenn ein INPUT fokussiert ist (die Regression)", () => {
    expect(mapKeyboardEvent(keyEvent("a", { target: { tagName: "INPUT" } }))).toBeNull();
  });

  it("ignoriert Buchstaben in textarea/select/contentEditable", () => {
    expect(mapKeyboardEvent(keyEvent("b", { target: { tagName: "TEXTAREA" } }))).toBeNull();
    expect(mapKeyboardEvent(keyEvent("c", { target: { tagName: "SELECT" } }))).toBeNull();
    expect(
      mapKeyboardEvent(keyEvent("d", { target: { tagName: "DIV", isContentEditable: true } })),
    ).toBeNull();
  });

  it("mappt Enter und Backspace", () => {
    expect(mapKeyboardEvent(keyEvent("Enter"))).toBe("ENTER");
    expect(mapKeyboardEvent(keyEvent("Backspace"))).toBe("BACKSPACE");
  });

  it("ignoriert Enter/Backspace ebenfalls in einem fokussierten Textfeld", () => {
    expect(mapKeyboardEvent(keyEvent("Enter", { target: { tagName: "INPUT" } }))).toBeNull();
    expect(mapKeyboardEvent(keyEvent("Backspace", { target: { tagName: "INPUT" } }))).toBeNull();
  });

  it("ignoriert Modifier-Kombinationen", () => {
    expect(mapKeyboardEvent(keyEvent("a", { ctrlKey: true }))).toBeNull();
    expect(mapKeyboardEvent(keyEvent("a", { metaKey: true }))).toBeNull();
    expect(mapKeyboardEvent(keyEvent("a", { altKey: true }))).toBeNull();
  });

  it("ignoriert Nicht-Buchstaben-Tasten", () => {
    expect(mapKeyboardEvent(keyEvent("1"))).toBeNull();
    expect(mapKeyboardEvent(keyEvent("Tab"))).toBeNull();
    expect(mapKeyboardEvent(keyEvent("ä"))).toBeNull();
    expect(mapKeyboardEvent(keyEvent(" "))).toBeNull();
  });
});
