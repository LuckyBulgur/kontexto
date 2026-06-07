export interface GlossaryTerm {
  /** Display term, e.g. "Kosinus-Ähnlichkeit". */
  term: string;
  /** URL-safe anchor id (kebab-case, ASCII). */
  slug: string;
  /** One- to three-sentence definition in German. */
  definition: string;
}

/**
 * Glossary of the terms behind Kontexto. Kept in alphabetical order by `term`.
 * Used to render /glossar/ and to emit a DefinedTermSet schema.
 */
export const glossary: GlossaryTerm[] = [
  {
    term: "Contexto",
    slug: "contexto",
    definition: `Das englischsprachige Original-Spiel (contexto.me), das die Vorlage für Kontexto ist. Kontexto überträgt dasselbe Prinzip auf die deutsche Sprache mit deutschen Worteinbettungen.`,
  },
  {
    term: "fastText",
    slug: "fasttext",
    definition: `Ein von Facebook (Meta) AI Research entwickeltes Verfahren, um Worteinbettungen zu lernen. fastText zerlegt Wörter zusätzlich in Zeichen-n-Gramme und kommt dadurch auch mit seltenen oder zusammengesetzten Wörtern gut zurecht – ideal für das Deutsche.`,
  },
  {
    term: "Kontext",
    slug: "kontext",
    definition: `Die sprachliche Umgebung, in der ein Wort typischerweise vorkommt. Worteinbettungen leiten die Bedeutung eines Wortes allein aus seinem Kontext ab – nach dem Prinzip „Du erkennst ein Wort an der Gesellschaft, die es hält“.`,
  },
  {
    term: "Korpus",
    slug: "korpus",
    definition: `Eine sehr große Sammlung von Texten, auf der das KI-Modell trainiert wird. Größe und Qualität des Korpus bestimmen, wie gut die Worteinbettungen die deutsche Sprache abbilden.`,
  },
  {
    term: "Kosinus-Ähnlichkeit",
    slug: "kosinus-aehnlichkeit",
    definition: `Ein Maß für den Winkel zwischen zwei Vektoren, das von -1 bis 1 reicht; je näher an 1, desto ähnlicher die Bedeutung. Kontexto sortiert alle Wörter nach ihrer Kosinus-Ähnlichkeit zum Zielwort.`,
  },
  {
    term: "Lemma",
    slug: "lemma",
    definition: `Die Grundform eines Wortes (z. B. „gehen“ für „ging“ oder „Häuser“ für „Haus“). Kontexto arbeitet überwiegend mit Grundformen, damit verschiedene Beugungen denselben Eintrag treffen.`,
  },
  {
    term: "n-Gramm",
    slug: "n-gramm",
    definition: `Eine Folge von n aufeinanderfolgenden Einheiten – bei fastText sind es Zeichen. Durch Zeichen-n-Gramme erfasst das Modell auch Bestandteile zusammengesetzter Wörter wie „Strandkorb“.`,
  },
  {
    term: "Rang",
    slug: "rang",
    definition: `Die Position eines geratenen Wortes in der nach Ähnlichkeit sortierten Liste aller Wörter. Rang 1 ist das Zielwort selbst; je kleiner der Rang, desto näher liegt dein Wort an der Bedeutung.`,
  },
  {
    term: "Semantik",
    slug: "semantik",
    definition: `Die Lehre von der Bedeutung sprachlicher Zeichen. Kontexto bewertet Wörter nach semantischer Nähe, nicht nach Schreibweise – deshalb liegt „Hund“ nah bei „Katze“, aber weit von „Hundert“.`,
  },
  {
    term: "Semantisches Feld",
    slug: "semantisches-feld",
    definition: `Eine Gruppe von Wörtern, die thematisch zusammengehören (z. B. „Meer, Küste, Welle, Sand“). Gute Spielzüge tasten ein semantisches Feld systematisch ab, um das Zielwort einzukreisen.`,
  },
  {
    term: "Vektorraum",
    slug: "vektorraum",
    definition: `Der hochdimensionale Raum, in dem jedes Wort als Punkt (Vektor) liegt. Nähe im Vektorraum entspricht Ähnlichkeit in der Bedeutung; ein echtes fastText-Modell nutzt mehrere hundert Dimensionen.`,
  },
  {
    term: "Worteinbettung (Embedding)",
    slug: "worteinbettung",
    definition: `Die Darstellung eines Wortes als Zahlenvektor. Wörter, die in ähnlichen Kontexten vorkommen, erhalten ähnliche Vektoren – so wird Bedeutung für den Computer mathematisch vergleichbar.`,
  },
  {
    term: "Zielwort",
    slug: "zielwort",
    definition: `Das geheime Wort des Tages, das es zu erraten gilt. Es ist für alle Spielenden am selben Tag identisch und wechselt um Mitternacht.`,
  },
];
