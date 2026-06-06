export interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
}

export const posts: BlogMeta[] = [
  {
    slug: "kontexto-vs-wordle",
    title: "Kontexto vs. Wordle: Was ist der Unterschied?",
    description:
      "Buchstaben raten oder Bedeutung erraten? Wir vergleichen Wordle und Kontexto und erklären, für wen welches Wortspiel passt.",
    date: "2026-06-06",
  },
  {
    slug: "wie-funktioniert-fasttext",
    title: "Wie funktioniert die KI-Wortähnlichkeit (fastText)?",
    description:
      'Warum "Hund" nah bei "Katze" liegt: eine verständliche Erklärung der Worteinbettungen hinter Kontexto.',
    date: "2026-06-06",
  },
  {
    slug: "beste-startwoerter",
    title: "Die besten Startwörter für Kontexto",
    description:
      "Mit welchen Wörtern du ein Kontexto-Rätsel am besten beginnst – und warum breite Alltagsbegriffe funktionieren.",
    date: "2026-06-06",
  },
  {
    slug: "was-ist-contexto-auf-deutsch",
    title: "Was ist Contexto auf Deutsch?",
    description:
      "Kontexto ist die deutsche Version von Contexto. Was das Spiel ausmacht und wie es sich von der englischen Variante unterscheidet.",
    date: "2026-06-06",
  },
];

export const getPost = (slug: string): BlogMeta | undefined =>
  posts.find((p) => p.slug === slug);
