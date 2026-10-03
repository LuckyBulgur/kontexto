/**
 * Voluntary support via Ko-fi.
 *
 * Three ways in, none of them a prompt (the player's decision: easy to find,
 * never asked for):
 * - a button that is always there: bottom left on phones and on most pages,
 *   pinned top right next to the board on the single-column game pages and the
 *   live board from `lg` (`components/SupportHost.tsx`);
 * - one quiet line on the result card after a solved round, the moment the
 *   evidence names as the right one to mention it (`components/SupportPrompt.tsx`);
 * - the footer link.
 * Each opening is counted by where it came from (`collect/support`), because no
 * study answers where a support button belongs on a game page.
 *
 * The copy says "unterstützen", never "Spende": a Spende suggests a
 * tax-deductible gift to a charity, which Kontexto is not.
 */
export const SUPPORT_URL = "https://ko-fi.com/kontexto";

/**
 * Ko-fi's tip panel, the same page its floating widget frames, with the parameters
 * Ko-fi's own widget generator writes: no supporter feed, the compact widget layout.
 */
export const SUPPORT_EMBED_URL = `${SUPPORT_URL}/?hidefeed=true&widget=true&embed=true&preview=true`;

/** Where the panel was opened from. Mirrors `SUPPORT_SOURCES` in backend/analytics.py. */
export type SupportSource = "corner" | "pinned" | "result_kontexto" | "result_wordle" | "footer";

/** Single-column game pages, where the button moves next to the board from `lg`. */
const PINNED_PATHS = ["/", "/wordle/"] as const;
const PINNED_PREFIXES = ["/solo/"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  const bare = prefix.replace(/\/$/, "");
  return pathname === bare || pathname.startsWith(`${bare}/`);
}

export function isSupportPinnedPage(pathname: string): boolean {
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (
    PINNED_PATHS.some((path) => path === withSlash) ||
    PINNED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
  );
}

/** Wördle's on-screen keyboard is the bottom row of a phone screen. */
export function isKeyboardPage(pathname: string): boolean {
  return matchesPrefix(pathname, "/wordle/");
}

/** Names per rail beside the board; the rest becomes a "plus N" line. */
export const RAIL_CAPACITY = 12;
/** Up to this many names fit one rail, so the right one stays empty. */
const ONE_RAIL_UP_TO = 8;

export interface SupporterRails {
  left: string[];
  right: string[];
  /** Names that fit neither rail. */
  more: number;
}

/**
 * Splits the newest-first names across the two rails beside the board: a short
 * list stays in the left rail, a longer one is dealt alternately so both rails
 * carry recent names, and what does not fit is counted rather than dropped.
 */
export function splitSupporterRails(names: readonly string[]): SupporterRails {
  if (names.length <= ONE_RAIL_UP_TO) return { left: [...names], right: [], more: 0 };
  const shown = names.slice(0, RAIL_CAPACITY * 2);
  return {
    left: shown.filter((_, i) => i % 2 === 0),
    right: shown.filter((_, i) => i % 2 === 1),
    more: names.length - shown.length,
  };
}

export const SUPPORT_COPY = {
  label: "Kontexto unterstützen",
  button: "Unterstützen",
  title: "Hey, magst du Kontexto einen Kaffee ausgeben?",
  intro:
    "Kontexto ist kostenlos, ohne Werbung und ohne Anmeldung, und so soll es auch bleiben. " +
    "Dahinter steckt aber ein Server, der jeden Tag läuft, und ziemlich viele Abende Bastelei.",
  ask:
    "Wenn dir das Spiel Spaß macht, wäre ein Kaffee über Ko-fi echt cool. Ganz freiwillig, " +
    "es schaltet nichts frei, und weiterspielen kannst du so oder so.",
  thanks: "Danke, dass du spielst!",
  frameTitle: "Kontexto auf Ko-fi unterstützen",
  openExternally: "Lieber direkt auf ko-fi.com",
  resultLine: "Hat dir das Rätsel gefallen? Kontexto bleibt werbefrei, ein Kaffee hilft dabei.",
  resultButton: "Kaffee ausgeben",
  railTitle: "Danke für euren Kaffee",
  railEmpty: "Hier stehen bald die Leute, die Kontexto unterstützen.",
  railMore: (n: number) => (n === 1 ? "und 1 weitere Person" : `und ${n} weitere`),
} as const;

export const SUPPORT_LABEL = SUPPORT_COPY.label;
