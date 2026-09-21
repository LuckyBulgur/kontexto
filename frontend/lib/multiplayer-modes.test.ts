import { describe, expect, it } from "vitest";
import {
  KONTEXTO_MULTIPLAYER_ORDER,
  KONTEXTO_QUEUE_ORDER,
  MULTIPLAYER_MODES,
  MULTIPLAYER_MODE_ORDER,
  WORDLE_MULTIPLAYER_ORDER,
  isQueueMode,
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
      const mode = MULTIPLAYER_MODES[id];
      // A mode the queue does not serve carries no queue path at all, which is
      // what keeps it out of the list on /suche/ and out of the strangers tab.
      expect(mode.queueHref).toBe(mode.queueable ? `/suche/?modus=${id}` : null);
    }
  });

  // The stream chat has no second party to wait for: the streamer opens the
  // room and the audience is already in it. If it ever reached the queue page,
  // a streamer would sit in a search that cannot finish.
  it("keeps the stream chat out of the queue", () => {
    expect(MULTIPLAYER_MODES.live.queueable).toBe(false);
    expect(MULTIPLAYER_MODES.live.queueHref).toBeNull();
    expect(MULTIPLAYER_MODES.live.createHref).toBe("/live/");
    expect(KONTEXTO_QUEUE_ORDER).not.toContain("live");
    expect(isQueueMode("live")).toBe(false);
  });

  it("still lists the stream chat in the catalogue", () => {
    expect(MULTIPLAYER_MODE_ORDER).toContain("live");
    expect(KONTEXTO_MULTIPLAYER_ORDER).toContain("live");
  });

  it("gives a queue link to every mode the queue serves, and only to those", () => {
    for (const id of MULTIPLAYER_MODE_ORDER) {
      const mode = MULTIPLAYER_MODES[id];
      expect(mode.queueable).toBe(mode.queueHref !== null);
    }
  });
});
