import { describe, it, expect } from "vitest";
import {
  LEITER_MAX_STRIKES,
  LEITER_START_RANK,
  LIMIT_MAX_GUESSES,
  SOLO_MODES,
  createDoppelState,
  createLeiterState,
  createLimitState,
  createSuddenDeathState,
  doppelApplyGuess,
  doppelBestRanks,
  leiterApplyGuess,
  leiterStrikesLeft,
  limitApplyGuess,
  limitGuessesLeft,
  soloBestRank,
  soloGuessCount,
  soloModeBySlug,
  suddenDeathApplyGuess,
} from "./solo-modes";

describe("soloModeBySlug", () => {
  it("resolves every catalogued slug", () => {
    for (const meta of Object.values(SOLO_MODES)) {
      expect(soloModeBySlug(meta.slug)?.id).toBe(meta.id);
    }
  });

  it("returns null for an unknown slug", () => {
    expect(soloModeBySlug("gibtsnicht")).toBeNull();
  });
});

describe("Leiter", () => {
  const fresh = () => createLeiterState(7, "verkehr", LEITER_START_RANK);

  it("starts with the given word already on the board", () => {
    const s = fresh();
    expect(s.guesses).toHaveLength(1);
    expect(s.guesses[0]).toEqual({ word: "verkehr", rank: LEITER_START_RANK, isTip: true });
    expect(s.bestRank).toBe(LEITER_START_RANK);
    expect(leiterStrikesLeft(s)).toBe(LEITER_MAX_STRIKES);
  });

  it("an improving guess lowers the bar and costs nothing", () => {
    const { state, struck } = leiterApplyGuess(fresh(), { word: "auto", rank: 900 });
    expect(struck).toBe(false);
    expect(state.bestRank).toBe(900);
    expect(state.strikes).toBe(0);
    expect(state.status).toBe("running");
  });

  it("a guess that does not beat the best rank is a strike", () => {
    const { state, struck } = leiterApplyGuess(fresh(), { word: "auto", rank: LEITER_START_RANK });
    expect(struck).toBe(true);
    expect(state.strikes).toBe(1);
    expect(state.bestRank).toBe(LEITER_START_RANK);
  });

  it("loses after three strikes", () => {
    let s = fresh();
    for (let i = 0; i < LEITER_MAX_STRIKES; i++) {
      s = leiterApplyGuess(s, { word: `wort${i}`, rank: 9000 }).state;
    }
    expect(s.status).toBe("lost");
    expect(leiterStrikesLeft(s)).toBe(0);
  });

  it("rank 1 wins even on the last life", () => {
    let s = fresh();
    s = leiterApplyGuess(s, { word: "a", rank: 9000 }).state;
    s = leiterApplyGuess(s, { word: "b", rank: 9000 }).state;
    expect(s.strikes).toBe(2);
    s = leiterApplyGuess(s, { word: "treffer", rank: 1 }).state;
    expect(s.status).toBe("won");
  });

  it("ignores further guesses once the round is over", () => {
    let s = fresh();
    s = leiterApplyGuess(s, { word: "treffer", rank: 1 }).state;
    const after = leiterApplyGuess(s, { word: "noch eins", rank: 2 });
    expect(after.state).toBe(s);
    expect(after.struck).toBe(false);
  });

  it("does not count the given start word as a player guess", () => {
    const s = leiterApplyGuess(fresh(), { word: "auto", rank: 900 }).state;
    expect(soloGuessCount(s)).toBe(1);
    expect(soloBestRank(s)).toBe(900);
  });
});

describe("Limitierte Versuche", () => {
  it("counts down from the budget", () => {
    let s = createLimitState(3);
    expect(limitGuessesLeft(s)).toBe(LIMIT_MAX_GUESSES);
    s = limitApplyGuess(s, { word: "auto", rank: 500 });
    expect(limitGuessesLeft(s)).toBe(LIMIT_MAX_GUESSES - 1);
    expect(s.status).toBe("running");
  });

  it("loses exactly when the budget runs out unsolved", () => {
    let s = createLimitState(3);
    for (let i = 0; i < LIMIT_MAX_GUESSES - 1; i++) {
      s = limitApplyGuess(s, { word: `wort${i}`, rank: 500 + i });
    }
    expect(s.status).toBe("running");
    s = limitApplyGuess(s, { word: "letztes", rank: 400 });
    expect(s.status).toBe("lost");
    expect(limitGuessesLeft(s)).toBe(0);
  });

  it("the last guess can still win", () => {
    let s = createLimitState(3);
    for (let i = 0; i < LIMIT_MAX_GUESSES - 1; i++) {
      s = limitApplyGuess(s, { word: `wort${i}`, rank: 500 + i });
    }
    s = limitApplyGuess(s, { word: "treffer", rank: 1 });
    expect(s.status).toBe("won");
  });

  it("ignores further guesses once the round is over", () => {
    let s = createLimitState(3);
    s = limitApplyGuess(s, { word: "treffer", rank: 1 });
    expect(limitApplyGuess(s, { word: "noch eins", rank: 2 })).toBe(s);
  });
});

describe("Doppelziel", () => {
  it("tracks both targets independently", () => {
    let s = createDoppelState([4, 9]);
    s = doppelApplyGuess(s, { word: "auto", ranks: [1, 800] });
    expect(s.solved).toEqual([true, false]);
    expect(s.status).toBe("running");
  });

  it("wins only when both targets are found", () => {
    let s = createDoppelState([4, 9]);
    s = doppelApplyGuess(s, { word: "auto", ranks: [1, 800] });
    s = doppelApplyGuess(s, { word: "haus", ranks: [40, 1] });
    expect(s.solved).toEqual([true, true]);
    expect(s.status).toBe("won");
  });

  it("keeps a target solved even if a later guess is far away", () => {
    let s = createDoppelState([4, 9]);
    s = doppelApplyGuess(s, { word: "auto", ranks: [1, 800] });
    s = doppelApplyGuess(s, { word: "weit weg", ranks: [9000, 9000] });
    expect(s.solved).toEqual([true, false]);
  });

  it("reports the best rank per target", () => {
    let s = createDoppelState([4, 9]);
    s = doppelApplyGuess(s, { word: "a", ranks: [300, 40] });
    s = doppelApplyGuess(s, { word: "b", ranks: [20, 900] });
    expect(doppelBestRanks(s)).toEqual([20, 40]);
    expect(soloBestRank(s)).toBe(20);
    expect(soloGuessCount(s)).toBe(2);
  });

  it("ignores further guesses once the round is over", () => {
    let s = createDoppelState([4, 9]);
    s = doppelApplyGuess(s, { word: "a", ranks: [1, 1] });
    expect(doppelApplyGuess(s, { word: "b", ranks: [5, 5] })).toBe(s);
  });
});

describe("Sudden Death", () => {
  const hints = [2, 3, 4, 5, 6].map((rank) => ({ word: `nachbar${rank}`, rank }));

  it("wins on the single correct attempt", () => {
    const s = suddenDeathApplyGuess(createSuddenDeathState(11, hints), {
      word: "treffer",
      rank: 1,
    });
    expect(s.status).toBe("won");
    expect(s.solution).toBe("treffer");
    expect(soloGuessCount(s)).toBe(1);
  });

  it("loses on the single wrong attempt", () => {
    const s = suddenDeathApplyGuess(createSuddenDeathState(11, hints), {
      word: "daneben",
      rank: 42,
    });
    expect(s.status).toBe("lost");
    expect(s.attempt).toEqual({ word: "daneben", rank: 42, isTip: false, correctedFrom: undefined });
    expect(soloBestRank(s)).toBe(42);
  });

  it("accepts no second attempt", () => {
    const first = suddenDeathApplyGuess(createSuddenDeathState(11, hints), {
      word: "daneben",
      rank: 42,
    });
    expect(suddenDeathApplyGuess(first, { word: "treffer", rank: 1 })).toBe(first);
  });

  it("never carries the solution before the attempt", () => {
    const s = createSuddenDeathState(11, hints);
    expect(s.solution).toBeNull();
    expect(s.hints.some((h) => h.rank === 1)).toBe(false);
  });
});
