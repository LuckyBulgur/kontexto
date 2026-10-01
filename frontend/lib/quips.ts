/**
 * Cheeky quips: the game teasing the player a little, in youth slang.
 *
 * The layer is on by default and can be switched off in the settings
 * (`lib/use-quips.ts`). Off means exactly the copy the game had before, which
 * is why the plain strings live here too: "on" and "off" are decided in one
 * place, not at every call site.
 *
 * Three rules hold every line:
 *
 * 1. Cheeky, never insulting. No swear word, nothing about looks, origin or
 *    gender. The game is played by school classes, a fifth grade included.
 * 2. A refusal still carries its fact. "You had that one already" has to be
 *    readable in the joke, otherwise the joke costs the player information.
 *    `quips.test.ts` pins each refusal kind to a pattern.
 * 3. System errors (connection lost, a tip that failed to load) are never
 *    teased. Only what the player did gets a line, never what the server did.
 *
 * Applied in Kontexto, the solo modes and solo Wordle. Deliberately not in
 * duel, koop, arena, Wordle duel or the live overlay: a line read by a whole
 * room or a stream audience is no longer a wink between the game and one
 * player.
 */

export type QuipOccasion =
  | "kontextoWinFirst"
  | "kontextoWinFast"
  | "kontextoWinSolid"
  | "kontextoWinSlow"
  | "kontextoWinMarathon"
  | "kontextoWinTips"
  | "kontextoGiveUp"
  | "leiterWon"
  | "leiterLost"
  | "limitWon"
  | "limitLost"
  | "doppelWon"
  | "doppelLost"
  | "suddendeathWon"
  | "suddendeathLost"
  | "categoriesWon"
  | "categoriesLost"
  | "refusalDuplicate"
  | "refusalUnknown"
  | "refusalStopword"
  | "wordleTooShort"
  | "wordleNotInList"
  | "wordleHardMode"
  | "wordleWin1"
  | "wordleWin2"
  | "wordleWin3"
  | "wordleWin4"
  | "wordleWin5"
  | "wordleWin6"
  | "wordleLoss"
  | "ratingEasy"
  | "ratingRight"
  | "ratingHard";

export const QUIPS: Record<QuipOccasion, readonly string[]> = {
  kontextoWinFirst: [
    "Erster Versuch? Hast du gespickt, Bro?",
    "Aura +1000.",
    "Kein Spickzettel? Sheesh.",
    "Main-Character-Energie.",
  ],
  kontextoWinFast: [
    "Good Boy.",
    "Sheesh.",
    "Lowkey Genie.",
    "Okay, du hast Aura.",
    "Bro ist built different.",
  ],
  kontextoWinSolid: [
    "Solide, Bro.",
    "Good Boy.",
    "Kann man so machen. W.",
    "Nicht schlecht für einen Menschen.",
  ],
  kontextoWinSlow: [
    "Hat gedauert, aber W.",
    "Bro hat sich durchgebissen.",
    "Lieber spät als nie, Digga.",
    "Geschafft. Puls wieder unten?",
  ],
  kontextoWinMarathon: [
    "Bro hat das halbe Wörterbuch durchprobiert.",
    "W, aber ein langes.",
    "Das war kein Raten mehr, das war Ausdauersport.",
    "Respekt fürs Durchhalten. Lowkey Skill Issue.",
  ],
  kontextoWinTips: [
    "Mit so vielen Tipps zählt das halb, Bro.",
    "Gelöst. Mit Stützrädern.",
    "Die Tipps haben gut gespielt.",
    "W für die Tipps, halbes W für dich.",
  ],
  kontextoGiveUp: [
    "Skill Issue.",
    "L. Morgen wieder.",
    "Weiße Fahne, Bro?",
    "Aufgeben ist auch eine Entscheidung.",
    "Aura -500.",
  ],
  leiterWon: [
    "Oben angekommen, Bro. Good Boy.",
    "Leiter durch. Sheesh.",
    "Ganz oben. Aura +1000.",
  ],
  leiterLost: [
    "Leben weg. Skill Issue.",
    "Die Leiter hat gewonnen, Bro.",
    "L. Neue Runde?",
  ],
  limitWon: [
    "Im Budget. Sparfuchs-Aura.",
    "Good Boy, gut gewirtschaftet.",
    "Kein Versuch verschwendet. Sheesh.",
  ],
  limitLost: [
    "Budget pleite, Bro.",
    "Skill Issue. Alle Versuche weg.",
    "L. Nächstes Mal sparsamer.",
  ],
  doppelWon: [
    "Zwei auf einen Streich. Sheesh.",
    "Doppel-W, Bro.",
    "Beide? Okay, du hast Aura.",
  ],
  doppelLost: [
    "Zwei Wörter, null Treffer. Skill Issue.",
    "Doppeltes L, Bro.",
    "Zwei Ziele, beide entkommen.",
  ],
  suddendeathWon: [
    "Auf Anhieb? Aura +1000.",
    "Bro hat einfach getroffen. Sheesh.",
    "Ein Schuss, ein Treffer. Good Boy.",
  ],
  suddendeathLost: [
    "Ein Schuss, daneben. Sheesh.",
    "Skill Issue, aber nur ein bisschen.",
    "L. Ein Versuch ist halt ein Versuch.",
  ],
  categoriesWon: [
    "Gefunden. Good Boy.",
    "Bro kennt sein Fachgebiet. Sheesh.",
    "W. Ab in die nächste Runde.",
  ],
  categoriesLost: [
    "Skill Issue.",
    "Aufgegeben? Weiße Fahne, Bro.",
    "L. Vielleicht eine andere Kategorie?",
  ],
  refusalDuplicate: [
    "Bro, das Wort hattest du schon.",
    "Hatten wir schon, Digga.",
    "Déjà-vu? Das Wort steht schon in der Liste.",
    "Gleiches Wort, gleicher Rang. Hattest du schon.",
  ],
  refusalUnknown: [
    "Digga, das Wort kenn ich nicht.",
    "Kenn ich nicht. Vertippt, Bro?",
    "Ausgedacht? Das Wort kenne ich nicht.",
    "Bro erfindet Wörter. Kenn ich nicht.",
  ],
  refusalStopword: [
    "Zu allgemein, Bro. Zählt nicht.",
    "Das Wort zählt nicht, viel zu allgemein.",
    "Netter Versuch. Zu allgemein, zählt nicht.",
    "Bro, das zählt nicht. Zu allgemein.",
  ],
  wordleTooShort: [
    "Fünf Buchstaben, Bro. Zählen üben?",
    "Da fehlen Buchstaben, Digga.",
    "Zu wenig Buchstaben. Skill Issue.",
  ],
  wordleNotInList: [
    "Steht nicht im Wörterbuch, Bro.",
    "Kenn ich nicht, Digga.",
    "Ausgedacht? Nicht im Wörterbuch.",
  ],
  wordleHardMode: [
    "Hard Mode, Bro. Hinweise benutzen.",
    "Regelbruch im Hard Mode. Skill Issue.",
    "Hard Mode heißt Hard Mode, Digga.",
  ],
  wordleWin1: ["Erster Versuch? Gespickt, Bro?", "Aura +1000.", "Kein Spickzettel? Sheesh."],
  wordleWin2: ["Sheesh.", "Bro ist built different.", "Lowkey Genie."],
  wordleWin3: ["Good Boy.", "Stark, Bro.", "Okay, du hast Aura."],
  wordleWin4: ["Solide. W.", "Good Boy.", "Kann man so machen, Bro."],
  wordleWin5: ["Knapp, aber W.", "Puh. Gerade noch Aura.", "Hat gedauert, Bro."],
  wordleWin6: ["Gerade so, Bro. Puls okay?", "Letzte Zeile. Wild.", "Das war knapp, Digga."],
  wordleLoss: ["Skill Issue.", "L, Bro.", "Sechs Versuche, null Treffer. Aura -500."],
  ratingEasy: [
    "Bro hält sich für ein Genie. Danke.",
    "Zu leicht? Angeber. Danke dir.",
    "Notiert, Einstein. Danke.",
  ],
  ratingRight: [
    "Good Boy. Danke.",
    "Ehrlich bewertet. Danke, Bro.",
    "Notiert. Danke dir.",
  ],
  ratingHard: [
    "Skill Issue. Danke trotzdem.",
    "Zu schwer? Skill Issue. Danke dir.",
    "Notiert, Bro. Und üben. Danke.",
  ],
};

/** FNV-1a over the seed's text: small, fast and the same in every browser. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * One line for an occasion, picked by the seed and not at random, so the same
 * round shows the same line after a reload and a re-render never swaps it.
 */
export function pickQuip(occasion: QuipOccasion, seed: number | string): string {
  const lines = QUIPS[occasion];
  return lines[hash(`${occasion}:${seed}`) % lines.length];
}

/** The copy the game shows with the quips switched off, verbatim as before. */
export const PLAIN = {
  refusalDuplicate: "Wort bereits geraten",
  refusalUnknown: "Dieses Wort kenne ich leider nicht",
  refusalStopword: "Dieses Wort zählt nicht, es ist zu allgemein",
  wordleTooShort: "Nicht genug Buchstaben",
  wordleNotInList: "Nicht im Wörterbuch",
  wordleHardMode: "Hard Mode Verstoß",
  /** Wordle's win toast by the row that solved, first row first. */
  wordleWin: ["Genial!", "Großartig!", "Stark!", "Gut!", "Knapp!", "Gerade so!"],
  kontextoWin: "Stark!",
} as const;

export type RefusalKind =
  | "refusalDuplicate"
  | "refusalUnknown"
  | "refusalStopword"
  | "wordleTooShort"
  | "wordleNotInList"
  | "wordleHardMode";

/** The single switch for every refusal: the plain sentence, or a quip that still says it. */
export function refusalText(kind: RefusalKind, on: boolean, seed: number | string): string {
  return on ? pickQuip(kind, seed) : PLAIN[kind];
}

/** The Kontexto result occasion: many tips outweigh the guess count. */
export function kontextoResultOccasion(won: boolean, guessCount: number, tips: number): QuipOccasion {
  if (!won) return "kontextoGiveUp";
  if (tips >= 3) return "kontextoWinTips";
  if (guessCount <= 1) return "kontextoWinFirst";
  if (guessCount <= 10) return "kontextoWinFast";
  if (guessCount <= 30) return "kontextoWinSolid";
  if (guessCount <= 80) return "kontextoWinSlow";
  return "kontextoWinMarathon";
}

export type SoloQuipMode = "leiter" | "limit" | "doppel" | "suddendeath" | "categories";

export function soloResultOccasion(mode: SoloQuipMode, won: boolean): QuipOccasion {
  return won ? (`${mode}Won` as const) : (`${mode}Lost` as const);
}

/** Wordle's win occasion by the row that solved, clamped to the six rows. */
export function wordleWinOccasion(row: number): QuipOccasion {
  const clamped = Math.min(6, Math.max(1, Math.round(row)));
  return `wordleWin${clamped}` as QuipOccasion;
}

export function ratingOccasion(verdict: "easy" | "right" | "hard"): QuipOccasion {
  return verdict === "easy" ? "ratingEasy" : verdict === "right" ? "ratingRight" : "ratingHard";
}
