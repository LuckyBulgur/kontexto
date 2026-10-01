/**
 * Spooktober 2026: the catalogue of secrets, the words that wake something up
 * and the player's progress.
 *
 * Pure and framework-free, so everything that decides what a player has found
 * is unit-tested (`lib/events/spooktober.test.ts`); the browser side lives in
 * `components/event/halloween/`.
 *
 * Nothing here may depend on the solution of a round. A word effect fires on
 * what the player typed and nothing else, so it can never become a hint.
 */

/** A one-shot creature or scene the effect stage can play. */
export type EffectKind =
  | "ghost"
  | "bats"
  | "spider"
  | "witch"
  | "bones"
  | "cat"
  | "candy"
  | "flashlight"
  | "wolf"
  | "owl"
  | "fog"
  | "moon"
  | "bubbles";

export type SecretId =
  | "pumpkin"
  | "trick"
  | "ghost"
  | "bats"
  | "spider"
  | "witch"
  | "bones"
  | "cat13"
  | "midnight"
  | "flashlight"
  | "wordle"
  | "bottom"
  | "lost";

export interface Secret {
  id: SecretId;
  /** Shown once found. */
  name: string;
  /** What the player did, shown once found. */
  found: string;
  /** Shown while it is still hidden. Points the way without giving it away. */
  hint: string;
}

/** Thirteen, because it is October. */
export const SECRETS: readonly Secret[] = [
  {
    id: "pumpkin",
    name: "Kürbisklopfer",
    found: "Du hast beim Kürbis angeklopft.",
    hint: "Neben dem Namen leuchtet etwas. Klopf mal an.",
  },
  {
    id: "trick",
    name: "Saures!",
    found: "Der Kürbis hat dich ausgetrickst.",
    hint: "Nicht jeder Griff in den Kürbis ist süß.",
  },
  {
    id: "ghost",
    name: "Geisterruf",
    found: "Du hast einen Geist herbeigerufen.",
    hint: "Manche Wörter rufen jemanden herbei, der durch Wände geht.",
  },
  {
    id: "bats",
    name: "Flatterhaft",
    found: "Du hast die Fledermäuse aufgescheucht.",
    hint: "Etwas hängt kopfüber und wartet auf sein Wort.",
  },
  {
    id: "spider",
    name: "Abgeseilt",
    found: "Eine Spinne hat sich zu dir abgeseilt.",
    hint: "Acht Beine, ein Faden, ein Wort.",
  },
  {
    id: "witch",
    name: "Besenflug",
    found: "Eine Hexe ist über den Mond geflogen.",
    hint: "Wer fliegt bei Vollmond ohne Flügel?",
  },
  {
    id: "bones",
    name: "Knochenarbeit",
    found: "Aus dem Boden hat dir jemand gewinkt.",
    hint: "Grab tiefer. Manche Wörter liegen unter der Erde.",
  },
  {
    id: "cat13",
    name: "Pechzahl",
    found: "Ein Tipp auf Rang 13, und eine schwarze Katze lief vorbei.",
    hint: "Eine Zahl bringt Unglück, auch in der Rangliste.",
  },
  {
    id: "midnight",
    name: "Geisterstunde",
    found: "Du hast zur Geisterstunde gespielt.",
    hint: "Zwischen Mitternacht und eins spukt es hier mehr.",
  },
  {
    id: "flashlight",
    name: "Licht aus",
    found: "Du hast die Seite im Dunkeln gesehen.",
    hint: "Wie sieht Kontexto aus, wenn das Licht ausgeht?",
  },
  {
    id: "wordle",
    name: "Gruselwördle",
    found: "Du hast in Wördle ein Gruselwort gelegt.",
    hint: "Auch fünf Buchstaben können spuken.",
  },
  {
    id: "bottom",
    name: "Bodenlos",
    found: "Du bist bis ganz nach unten gescrollt, und von dort hat dir jemand gewinkt.",
    hint: "Ganz unten auf der Seite wartet jemand.",
  },
  {
    id: "lost",
    name: "Verirrt",
    found: "Du hast dich auf eine Seite verirrt, die es nicht gibt.",
    hint: "Nicht jede Adresse führt irgendwohin.",
  },
];

const SECRET_IDS: ReadonlySet<string> = new Set(SECRETS.map((s) => s.id));

export function isSecretId(value: unknown): value is SecretId {
  return typeof value === "string" && SECRET_IDS.has(value);
}

/**
 * The words that wake something up, in the form the server hands back (base
 * form, lower case, umlauts written as umlauts). The common plurals are listed
 * as well, because not every plural is folded onto its singular. Mild on
 * purpose: school classes play this game, so there is no blood and no gore.
 */
const SPOOKY_WORD_LISTS: Readonly<Record<EffectKind, readonly string[]>> = {
  ghost: ["geist", "geister", "gespenst", "gespenster", "poltergeist", "spuk", "buh"],
  bats: ["fledermaus", "fledermäuse", "vampir", "vampire", "dracula"],
  spider: ["spinne", "spinnen", "spinnennetz", "vogelspinne"],
  witch: ["hexe", "hexen", "hexenbesen", "besen"],
  bones: ["skelett", "skelette", "knochen", "zombie", "zombies", "friedhof", "gruft", "mumie", "mumien", "gerippe", "sarg"],
  cat: ["katze", "kater"],
  candy: ["kürbis", "kürbisse", "süßigkeit", "süßigkeiten", "bonbon", "bonbons", "lutscher", "schokolade", "halloween"],
  flashlight: ["taschenlampe", "dunkelheit", "finsternis"],
  wolf: ["werwolf", "werwölfe", "wolf", "wölfe", "heulen"],
  owl: ["eule", "eulen", "uhu", "rabe", "raben", "krähe", "krähen"],
  fog: ["nebel", "dunst", "nebelschwade"],
  moon: ["mond", "vollmond", "mondschein"],
  bubbles: ["kessel", "hexenkessel", "zaubertrank", "trank", "gift", "blubbern"],
};

const SPOOKY_WORDS: ReadonlyMap<string, EffectKind> = new Map(
  (Object.entries(SPOOKY_WORD_LISTS) as [EffectKind, readonly string[]][]).flatMap(([kind, words]) =>
    words.map((w) => [w, kind] as const),
  ),
);

/**
 * Which secret a word effect uncovers. The cat, the candy and the creatures
 * added on 2026-10-01 (wolf, owl, fog, moon, bubbles) are free extras, so the
 * count stays at thirteen.
 */
const SECRET_OF_EFFECT: Readonly<Partial<Record<EffectKind, SecretId>>> = {
  ghost: "ghost",
  bats: "bats",
  spider: "spider",
  witch: "witch",
  bones: "bones",
  flashlight: "flashlight",
};

/** Spooky five-letter words that the Wordle mode accepts (checked against its word lists). */
const SPOOKY_WORDLE_WORDS: ReadonlySet<string> = new Set([
  "geist",
  "hexen",
  "hexer",
  "gruft",
  "mumie",
  "besen",
  "nebel",
  "spukt",
  "eulen",
  "raben",
  "kerze",
  "fluch",
]);

/** The rank that brings bad luck. */
export const UNLUCKY_RANK = 13;

/**
 * The spellings a word may arrive in: as typed, with written-out umlauts
 * folded back (`kuerbis`), and additionally with `ss` read as sharp s
 * (`suessigkeit`). Two variants rather than one, because `kürbisse` spells a
 * real double s.
 */
function spellings(word: string): string[] {
  const lower = word.trim().toLowerCase();
  const umlauts = lower.replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü");
  return [lower, umlauts, umlauts.replace(/ss/g, "ß")];
}

/** The effect a guessed word wakes up, or null. */
export function matchSpookyWord(word: string): EffectKind | null {
  for (const spelling of spellings(word)) {
    const kind = SPOOKY_WORDS.get(spelling);
    if (kind) return kind;
  }
  return null;
}

/**
 * The effects a word from somebody else may set off: the stream chat of a live
 * room. Everything but the flashlight, which darkens the whole board for half a
 * minute and would hide the stream's picture whenever a viewer wanted it to.
 */
const ARRIVAL_EXCLUDED: ReadonlySet<EffectKind> = new Set<EffectKind>(["flashlight"]);

/** A chat that repeats a word wakes its effect at most this often. */
export const ARRIVAL_COOLDOWN_MS = 90_000;

/**
 * Decides whether a word another player put on the board wakes its effect.
 * It never uncovers a secret (a find is the host's own) and never fires on
 * the winning word, which belongs to the result card. Each effect kind has its
 * own cooldown, so a chat that spams "geist" sees one ghost, not a parade; the
 * stage's own limits (one creature per kind a minute, three at once) apply on
 * top. Pure apart from the clock it is handed, so it is testable.
 */
export class ArrivalGate {
  private readonly last = new Map<EffectKind, number>();

  constructor(private readonly cooldownMs: number = ARRIVAL_COOLDOWN_MS) {}

  admit(word: string, rank: number, now: number): EffectKind | null {
    if (rank === 1) return null;
    const effect = matchSpookyWord(word);
    if (!effect || ARRIVAL_EXCLUDED.has(effect)) return null;
    const last = this.last.get(effect);
    if (last !== undefined && now - last < this.cooldownMs) return null;
    this.last.set(effect, now);
    return effect;
  }
}

export function secretForEffect(effect: EffectKind): SecretId | null {
  return SECRET_OF_EFFECT[effect] ?? null;
}

export function isSpookyWordleWord(word: string): boolean {
  return SPOOKY_WORDLE_WORDS.has(word.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export const PROGRESS_KEY = "kontexto_spooktober_2026";

export interface SpooktoberProgress {
  v: 1;
  /** Secrets found, in the order they were found. */
  secrets: SecretId[];
  /** The one-time announcement was shown. */
  announced: boolean;
}

export function emptyProgress(): SpooktoberProgress {
  return { v: 1, secrets: [], announced: false };
}

/**
 * Parses a stored entry. Anything that is not exactly the expected shape
 * starts over rather than half-trusting it: unknown secret ids are dropped
 * (`tombstone` and the `solves` list of the first October build among them)
 * and duplicates collapse.
 */
export function parseProgress(raw: string | null): SpooktoberProgress {
  if (!raw) return emptyProgress();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }
  if (typeof data !== "object" || data === null) return emptyProgress();
  const record = data as Record<string, unknown>;
  if (record.v !== 1) return emptyProgress();
  const secrets = Array.isArray(record.secrets) ? record.secrets.filter(isSecretId) : [];
  return {
    v: 1,
    secrets: [...new Set(secrets)],
    announced: record.announced === true,
  };
}

export function loadProgress(storage: Pick<Storage, "getItem"> | null): SpooktoberProgress {
  if (!storage) return emptyProgress();
  try {
    return parseProgress(storage.getItem(PROGRESS_KEY));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(storage: Pick<Storage, "setItem"> | null, progress: SpooktoberProgress): void {
  if (!storage) return;
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage full or blocked: the find still counts for this page view.
  }
}

export function recordSecret(
  progress: SpooktoberProgress,
  id: SecretId,
): { progress: SpooktoberProgress; isNew: boolean } {
  if (progress.secrets.includes(id)) return { progress, isNew: false };
  return { progress: { ...progress, secrets: [...progress.secrets, id] }, isNew: true };
}

export function isComplete(progress: SpooktoberProgress): boolean {
  return SECRETS.every((s) => progress.secrets.includes(s.id));
}

export function secretById(id: SecretId): Secret {
  const secret = SECRETS.find((s) => s.id === id);
  if (!secret) throw new Error(`unknown secret ${id}`);
  return secret;
}
