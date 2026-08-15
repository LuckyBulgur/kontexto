export type BlogCategory = "Grundlagen" | "Strategie" | "Technik";

export interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD) of first publication. */
  date: string;
  /** ISO date of last substantial revision. Defaults to `date` when omitted. */
  updated?: string;
  category: BlogCategory;
}

/**
 * Blog registry. Order = newest first (drives the index listing). Every slug
 * must have a matching `content/blog/<slug>.mdx` file and an entry in the
 * loader map in app/blog/[slug]/page.tsx, enforced by lib/blog.test.ts.
 */
export const posts: BlogMeta[] = [
  {
    slug: "startwort-benchmark",
    title: "Startwort-Benchmark: 2.400 Rätsel gemessen, drei eigene Empfehlungen widerlegt",
    description:
      "Für jedes der 2.400 Rätsel ausgerechnet, welchen Rang 46 Kandidatenwörter bekommen hätten. Ergebnis: Verben schlagen Substantive, und „Wasser“ ist ein schlechtes Startwort.",
    date: "2026-08-15",
    category: "Strategie",
  },
  {
    slug: "wie-viele-versuche-sind-normal",
    title: "Wie viele Versuche sind normal? 868.000 Rateversuche ausgewertet",
    description:
      "85 Rateversuche je gelöstem Rätsel, 71 Prozent Lösungsquote, 4,5 Tipps pro Partie und die 100 meistgeratenen Wörter. Echte Zahlen aus der serverseitigen Zählung.",
    date: "2026-08-15",
    category: "Grundlagen",
  },
  {
    slug: "wie-das-loesungswort-entsteht",
    title: "Wie das Lösungswort entsteht: von 2 Millionen Wörtern auf 2.400 Rätsel",
    description:
      "Die komplette Auswahlkette hinter dem Wort des Tages: Vokabularfilter, Häufigkeitsschwelle, vier semantische Signale gegen Eigennamen und der Fall „anlässlich“.",
    date: "2026-08-15",
    category: "Technik",
  },
  {
    slug: "tipp-funktion-richtig-nutzen",
    title: "Die Tipp-Funktion: was hinter den drei Schwierigkeitsgraden steckt",
    description:
      "Leicht halbiert deinen besten Rang, mittel gibt den direkten Nachbarn, schwer würfelt. Die genauen Formeln und wann welcher Modus sich lohnt.",
    date: "2026-08-15",
    category: "Strategie",
  },
  {
    slug: "spieldesign-unbegrenzte-versuche",
    title: "Warum Kontexto unbegrenzte Versuche hat",
    description:
      "Ein Versuchslimit würde bei einem Bedeutungsspiel Glück messen statt Können. Über drei Designentscheidungen und ihren Preis.",
    date: "2026-08-15",
    category: "Grundlagen",
  },
  {
    slug: "all-but-the-top-vektoren-entzerren",
    title: "All-but-the-Top: warum Kontexto die Wortvektoren entzerrt",
    description:
      "Rohe Worteinbettungen haben einen gemeinsamen Drift, der Häufigkeit statt Bedeutung kodiert. Zwei Rechenschritte beheben das, und ohne sie wäre das Spiel kaputt.",
    date: "2026-08-15",
    category: "Technik",
  },
  {
    slug: "wenn-du-feststeckst",
    title: "Wenn du feststeckst: eine Partie Zug für Zug",
    description:
      "Ein Verfahren gegen den Rang-340-Moment: schlechte Ränge lesen, Richtungen statt Wörter messen, und die Abbruchbedingung für einen Feldwechsel.",
    date: "2026-08-15",
    category: "Strategie",
  },
  {
    slug: "duell-und-koop-taktik",
    title: "Duell und Koop: die Mehrspielermodi und wie man sie spielt",
    description:
      "Gegeneinander ist Information eine Ressource, die du hütest. Miteinander ist sie die Ressource, die ihr vermehrt. Taktik für beide Modi.",
    date: "2026-08-15",
    category: "Grundlagen",
  },
  {
    slug: "woerdle-wortliste-deutsch",
    title: "Wie die deutsche Wördle-Wortliste gebaut wurde",
    description:
      "Warum es keine Umlaute gibt, warum Ratewörter großzügig und Lösungswörter streng gefiltert sind und an welcher Stelle der Schwellenwert gesenkt werden musste.",
    date: "2026-08-15",
    category: "Technik",
  },
  {
    slug: "woerter-die-kontexto-nicht-kennt",
    title: "Wörter, die Kontexto nicht kennt",
    description:
      "Vier Gründe, warum ein völlig normales deutsches Wort abgelehnt wird, und was du in jedem einzelnen Fall stattdessen eingibst.",
    date: "2026-08-15",
    category: "Grundlagen",
  },
  {
    slug: "komposita-und-teilwoerter",
    title: "Komposita: warum Deutsch für ein Bedeutungsspiel schwerer ist als Englisch",
    description:
      "Zeichen-n-Gramme retten seltene Zusammensetzungen und täuschen zugleich Nähe vor, wo keine ist. Woran du den Unterschied erkennst.",
    date: "2026-08-15",
    category: "Technik",
  },
  {
    slug: "warum-keine-namen-mehr-als-loesungswoerter",
    title: "Neustart: warum keine Namen mehr als Lösungswörter auftauchen",
    description:
      "Warum Lösungen wie „Emma“ oder „Berlin“ überhaupt entstanden, welche vier Filter das jetzt verhindern und was die Fälle „Arsch“ und „anlässlich“ nachträglich gelehrt haben.",
    date: "2026-06-08",
    updated: "2026-08-15",
    category: "Technik",
  },
  {
    slug: "kontexto-tipps-schneller-gewinnen",
    title: "12 Strategien, mit denen du Kontexto schneller löst",
    description:
      "Zwölf Techniken nach Spielphase sortiert, von der Eröffnung über das Messen von Richtungen bis zur Abbruchbedingung, plus der Test für einen guten Zug.",
    date: "2026-06-07",
    updated: "2026-08-15",
    category: "Strategie",
  },
  {
    slug: "haeufige-fehler-bei-kontexto",
    title: "7 häufige Fehler bei Kontexto, und wie du sie vermeidest",
    description:
      "Zu lange im falschen Feld, nur Substantive, rote Ränge als Misserfolg lesen: sieben Gewohnheiten, die Züge kosten, und die Korrektur zu jeder.",
    date: "2026-06-07",
    updated: "2026-08-15",
    category: "Strategie",
  },
  {
    slug: "semantische-wortfelder-strategie",
    title: "Semantische Wortfelder: so denkst du wie das Modell",
    description:
      "Warum Wörter in Feldern zusammenliegen, wie du Achsen statt Synonyme abtastest und warum ein gemeinsamer Wortstamm kein Feld ist.",
    date: "2026-06-07",
    updated: "2026-08-15",
    category: "Strategie",
  },
  {
    slug: "warum-schlechter-rang",
    title: "Warum hat mein Wort einen schlechten Rang?",
    description:
      "Fünf Ursachen für überraschende Ränge: Kontextnähe statt Verwandtschaft, Mehrdeutigkeit, nahe Gegenteile, seltene Wörter und die Buchstabenfalle.",
    date: "2026-06-07",
    updated: "2026-08-15",
    category: "Grundlagen",
  },
  {
    slug: "worteinbettungen-erklaert",
    title: "Worteinbettungen: wie ein Computer Bedeutung berechnet",
    description:
      "Wie aus reinem Text Bedeutung wird, warum man mit Wortvektoren rechnen kann und welche vier Eigenheiten beim Spielen regelmäßig für Verwirrung sorgen.",
    date: "2026-06-07",
    updated: "2026-08-15",
    category: "Technik",
  },
  {
    slug: "kosinus-aehnlichkeit-einfach-erklaert",
    title: "Kosinus-Ähnlichkeit: wie aus zwei Wörtern eine Zahl wird",
    description:
      "Warum der Winkel zwischen zwei Wortvektoren zählt und nicht ihr Abstand, und warum Kontexto einen Rang anzeigt statt des rohen Ähnlichkeitswerts.",
    date: "2026-06-07",
    updated: "2026-08-15",
    category: "Technik",
  },
  {
    slug: "kontexto-vs-wordle",
    title: "Kontexto vs. Wordle: was ist der Unterschied?",
    description:
      "Ein Wördle-Zug schneidet Kandidaten weg, ein Kontexto-Zug misst eine Entfernung. Was daraus folgt, samt Vergleichstabelle und der Frage, welches Spiel zu dir passt.",
    date: "2026-06-06",
    updated: "2026-08-15",
    category: "Grundlagen",
  },
  {
    slug: "wie-funktioniert-fasttext",
    title: "fastText: das Modell hinter den Rängen",
    description:
      "Welches Modell Kontexto genau verwendet, warum Zeichen-n-Gramme für Deutsch entscheidend sind, was sie kosten und warum kein größeres Sprachmodell zum Einsatz kommt.",
    date: "2026-06-06",
    updated: "2026-08-15",
    category: "Technik",
  },
  {
    slug: "beste-startwoerter",
    title: "Die besten Startwörter für Kontexto",
    description:
      "Ein gutes Startwort liefert nicht den besten Rang, sondern den aussagekräftigsten. Ein Repertoire aus vier Wörtern und der Test für dein eigenes.",
    date: "2026-06-06",
    updated: "2026-08-15",
    category: "Strategie",
  },
  {
    slug: "was-ist-contexto-auf-deutsch",
    title: "Was ist Contexto auf Deutsch?",
    description:
      "Warum eine Übersetzung nicht gereicht hätte, welche zwei Eigenschaften des Deutschen das Spiel prägen und was Kontexto über die englische Vorlage hinaus bietet.",
    date: "2026-06-06",
    updated: "2026-08-15",
    category: "Grundlagen",
  },
];

export const getPost = (slug: string): BlogMeta | undefined =>
  posts.find((p) => p.slug === slug);

/** Posts grouped by category, preserving the newest-first order within each. */
export function postsByCategory(): Record<BlogCategory, BlogMeta[]> {
  const groups: Record<BlogCategory, BlogMeta[]> = {
    Grundlagen: [],
    Strategie: [],
    Technik: [],
  };
  for (const p of posts) groups[p.category].push(p);
  return groups;
}
