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
 * loader map in app/blog/[slug]/page.tsx — enforced by lib/blog.test.ts.
 */
export const posts: BlogMeta[] = [
  {
    slug: "warum-keine-namen-mehr-als-loesungswoerter",
    title: "Neustart: Warum keine Namen mehr als Lösungswörter auftauchen",
    description:
      "Kontexto startet neu bei Tag 1: Der Algorithmus für die Lösungswörter wurde komplett neu gebaut. Warum vorher Namen wie „Emma“ oder „Berlin“ kamen – und was sich geändert hat.",
    date: "2026-06-08",
    category: "Technik",
  },
  {
    slug: "kontexto-tipps-schneller-gewinnen",
    title: "Kontexto-Tipps: 12 Strategien, mit denen du schneller gewinnst",
    description:
      "Die wichtigsten Kontexto-Strategien auf einen Blick: von guten Startwörtern über das Eingrenzen von Themenfeldern bis zum systematischen Variieren der Wortart.",
    date: "2026-06-07",
    category: "Strategie",
  },
  {
    slug: "haeufige-fehler-bei-kontexto",
    title: "7 häufige Fehler bei Kontexto – und wie du sie vermeidest",
    description:
      "Zu lange im falschen Themenfeld, nur Nomen, Aufgeben bei roten Rängen: Diese typischen Fehler kosten dich Versuche. So machst du es besser.",
    date: "2026-06-07",
    category: "Strategie",
  },
  {
    slug: "semantische-wortfelder-strategie",
    title: "Semantische Wortfelder: So denkst du wie das KI-Modell",
    description:
      "Warum Wörter in „Feldern“ zusammenliegen und wie du diese Struktur nutzt, um das Zielwort Schritt für Schritt einzukreisen.",
    date: "2026-06-07",
    category: "Strategie",
  },
  {
    slug: "warum-schlechter-rang",
    title: "Warum hat mein Wort einen schlechten Rang?",
    description:
      "Ein passendes Wort, aber Rang 4000? Wir erklären, wie der Rang zustande kommt, warum Schreibweise egal ist und was ein hoher Rang wirklich bedeutet.",
    date: "2026-06-07",
    category: "Grundlagen",
  },
  {
    slug: "worteinbettungen-erklaert",
    title: "Worteinbettungen einfach erklärt: Wie Computer Bedeutung verstehen",
    description:
      "Was Worteinbettungen sind, wie ein Modell aus reinem Text Bedeutung lernt und warum „Hund“ näher bei „Katze“ liegt als bei „Hundert“.",
    date: "2026-06-07",
    category: "Technik",
  },
  {
    slug: "kosinus-aehnlichkeit-einfach-erklaert",
    title: "Kosinus-Ähnlichkeit einfach erklärt",
    description:
      "Der Winkel zwischen zwei Wortvektoren entscheidet über den Rang. Eine anschauliche Erklärung der Kosinus-Ähnlichkeit – ganz ohne schwere Mathematik.",
    date: "2026-06-07",
    category: "Technik",
  },
  {
    slug: "kontexto-vs-wordle",
    title: "Kontexto vs. Wordle: Was ist der Unterschied?",
    description:
      "Buchstaben raten oder Bedeutung erraten? Wir vergleichen Wordle und Kontexto und erklären, für wen welches Wortspiel passt.",
    date: "2026-06-06",
    updated: "2026-06-07",
    category: "Grundlagen",
  },
  {
    slug: "wie-funktioniert-fasttext",
    title: "Wie funktioniert die KI-Wortähnlichkeit (fastText)?",
    description:
      'Warum "Hund" nah bei "Katze" liegt: eine verständliche Erklärung der Worteinbettungen hinter Kontexto.',
    date: "2026-06-06",
    updated: "2026-06-07",
    category: "Technik",
  },
  {
    slug: "beste-startwoerter",
    title: "Die besten Startwörter für Kontexto",
    description:
      "Mit welchen Wörtern du ein Kontexto-Rätsel am besten beginnst – und warum breite Alltagsbegriffe funktionieren.",
    date: "2026-06-06",
    updated: "2026-06-07",
    category: "Strategie",
  },
  {
    slug: "was-ist-contexto-auf-deutsch",
    title: "Was ist Contexto auf Deutsch?",
    description:
      "Kontexto ist die deutsche Version von Contexto. Was das Spiel ausmacht und wie es sich von der englischen Variante unterscheidet.",
    date: "2026-06-06",
    updated: "2026-06-07",
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
