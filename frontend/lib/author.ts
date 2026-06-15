/**
 * Single source of truth for editorial authorship. Used both for the visible
 * by-line / author box on blog articles and for the `author` field of the
 * BlogPosting JSON-LD (lib/structured-data.ts) so that the structured data and
 * the rendered page can never drift apart.
 *
 * The named person matches the editorially responsible person under
 * § 18 Abs. 2 MStV declared in lib/legal.ts. A real, named author with a short
 * bio is a strong E-E-A-T signal (expertise / authoritativeness / trust).
 */
export const AUTHOR_NAME = "Ugur Aydogan";

/** Internal page that backs the author's profile link. */
export const AUTHOR_PROFILE_PATH = "/ueber/";

export const AUTHOR_BIO =
  "Ugur Aydogan hat Kontexto entwickelt – die deutsche Version des semantischen " +
  "Wort-Ratespiels Contexto. Er beschäftigt sich mit Worteinbettungen, " +
  "natürlicher Sprachverarbeitung und der Frage, wie sich die Bedeutung von " +
  "Wörtern berechnen lässt, und schreibt hier über die Technik und Strategie " +
  "hinter dem Spiel.";
