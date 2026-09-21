import { describe, expect, it } from "vitest";
import {
  KONTEXTO_MULTIPLAYER_ORDER,
  MULTIPLAYER_MODES,
  MULTIPLAYER_MODE_ORDER,
  WORDLE_MULTIPLAYER_ORDER,
} from "./multiplayer-modes";

describe("multiplayer mode catalogue", () => {
  it("assigns every mode to one of the two games", () => {
    for (const id of MULTIPLAYER_MODE_ORDER) {
      expect(["kontexto", "wordle"]).toContain(MULTIPLAYER_MODES[id].game);
    }
  });

  it("splits the full order without losing or duplicating a mode", () => {
    const split = [...KONTEXTO_MULTIPLAYER_ORDER, ...WORDLE_MULTIPLAYER_ORDER].sort();
    expect(split).toEqual([...MULTIPLAYER_MODE_ORDER].sort());
  });

  it("keeps the Wordle duel out of the Kontexto list", () => {
    expect(KONTEXTO_MULTIPLAYER_ORDER).not.toContain("wordle_duel");
    expect(WORDLE_MULTIPLAYER_ORDER).toEqual(["wordle_duel"]);
  });

  // The queue page is the one place the two games could leak into each other:
  // a Kontexto player who lands in the Wordle queue is in the wrong game.
  it("sends the Wordle duel to its own queue page", () => {
    expect(MULTIPLAYER_MODES.wordle_duel.queueHref).toBe("/wordle/suche/");
    for (const id of KONTEXTO_MULTIPLAYER_ORDER) {
      expect(MULTIPLAYER_MODES[id].queueHref).toBe(`/suche/?modus=${id}`);
    }
  });
});
