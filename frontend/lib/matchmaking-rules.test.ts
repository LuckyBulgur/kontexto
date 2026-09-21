import { describe, expect, it } from "vitest";
import { loadSentence, partySizeLabel, totalSentence, waitingSentence } from "./matchmaking-rules";
import { MatchmakingLive } from "./matchmaking-types";

function live(waiting: number, playing: number): MatchmakingLive {
  return {
    modes: {
      duel: { waiting, playing },
      koop: { waiting: 0, playing: 0 },
      wordle_duel: { waiting: 0, playing: 0 },
      royale: { waiting: 0, playing: 0 },
      blitz: { waiting: 0, playing: 0 },
      timerush: { waiting: 0, playing: 0 },
    },
    waiting_total: waiting,
    playing_total: playing,
  };
}

describe("loadSentence", () => {
  it("says nothing while the figure is unknown", () => {
    expect(loadSentence(undefined)).toBe("");
  });

  it("admits an empty mode instead of hiding it", () => {
    expect(loadSentence({ waiting: 0, playing: 0 })).toBe(
      "Gerade niemand da, du wärst der Erste"
    );
  });

  it("counts one waiting player in the singular", () => {
    expect(loadSentence({ waiting: 1, playing: 0 })).toBe("1 wartet gerade");
  });

  it("counts several waiting players in the plural", () => {
    expect(loadSentence({ waiting: 3, playing: 0 })).toBe("3 warten gerade");
  });

  it("counts one playing player in the singular", () => {
    expect(loadSentence({ waiting: 0, playing: 1 })).toBe("1 spielt gerade");
  });

  it("counts several playing players in the plural", () => {
    expect(loadSentence({ waiting: 0, playing: 4 })).toBe("4 spielen gerade");
  });

  it("joins both figures into one line", () => {
    expect(loadSentence({ waiting: 2, playing: 6 })).toBe("2 warten, 6 spielen gerade");
  });

  it("keeps the singular in the joined line", () => {
    expect(loadSentence({ waiting: 1, playing: 1 })).toBe("1 wartet, 1 spielt gerade");
  });
});

describe("totalSentence", () => {
  it("admits an empty queue", () => {
    expect(totalSentence(live(0, 0))).toBe("Gerade ist niemand unterwegs");
  });

  it("uses the singular for a single person", () => {
    expect(totalSentence(live(1, 0))).toBe("1 Person gerade unterwegs");
  });

  it("adds waiting and playing together", () => {
    expect(totalSentence(live(2, 6))).toBe("8 Leute gerade unterwegs");
  });
});

describe("partySizeLabel", () => {
  it("states a fixed size as an exact number", () => {
    expect(partySizeLabel({ min: 2, max: 2 })).toBe("Genau 2 Spieler");
  });

  it("states a range as a range", () => {
    expect(partySizeLabel({ min: 3, max: 8 })).toBe("3 bis 8 Spieler");
  });
});

describe("waitingSentence", () => {
  const royale = { min_players: 3, max_players: 8, grace_seconds: 25 };

  it("names how many are still missing, in the singular", () => {
    expect(waitingSentence(2, royale)).toBe("Es fehlt noch eine Person.");
  });

  it("names how many are still missing, in the plural", () => {
    expect(waitingSentence(1, royale)).toBe("Es fehlen noch 2 Personen.");
  });

  it("says it is waiting for more once the minimum is reached", () => {
    expect(waitingSentence(4, royale)).toContain("höchstens 25 Sekunden");
  });

  it("says it starts at once at the maximum", () => {
    expect(waitingSentence(8, royale)).toBe("Genug Leute da, es geht gleich los.");
  });
});
