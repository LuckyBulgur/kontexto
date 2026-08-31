import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Lesedauer eines Blogbeitrags in Minuten, aus der MDX-Quelle gezaehlt.
 *
 * Zur Bauzeit gelesen, nicht gepflegt: Eine Zahl in einer Registry wuerde beim
 * naechsten Ueberarbeiten still falsch. Der Static Export baut ohnehin auf dem
 * Dateisystem, also ist der Zugriff hier zulaessig und kostet nichts zur
 * Laufzeit.
 *
 * 200 Woerter je Minute ist der uebliche Ansatz fuer erwachsene Leser bei
 * Sachtexten. Aufgerundet, mindestens eine Minute.
 */
const WORDS_PER_MINUTE = 200;

export function readingTimeMinutes(slug: string): number {
  try {
    const raw = readFileSync(join(process.cwd(), "content", "blog", `${slug}.mdx`), "utf8");
    const text = raw
      // JSX-Kommentare, Importzeilen und Auszeichnung zaehlen nicht mit.
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
      .replace(/^import .*$/gm, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[#*`|>[\]()-]/g, " ");
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  } catch {
    return 0;
  }
}
