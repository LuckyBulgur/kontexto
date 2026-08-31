/**
 * Datum der letzten inhaltlichen Ueberarbeitung je Inhaltsseite.
 *
 * Warum von Hand gepflegt und nicht aus Git erzeugt: Der Static Export laeuft in
 * einem Docker-Stage ohne Git-Historie, und ein Commit, der nur eine Klasse
 * aendert, ist keine inhaltliche Ueberarbeitung. Hier steht deshalb, wann der
 * Text zuletzt fachlich angefasst wurde, nicht wann die Datei zuletzt gespeichert
 * wurde.
 *
 * Wozu das sichtbar ist: Ein Datum an einer Ratgeberseite sagt der Leserin, ob
 * sie einem Stand trauen kann, und es ist eines der wenigen Signale, die eine
 * gepflegte Seite von einer abgelegten unterscheiden. Blogbeitraege tragen ihr
 * Datum laengst (lib/blog.ts), die Inhaltsseiten bisher nicht.
 *
 * Regel: Wer den Text einer Seite spuerbar aendert, aktualisiert hier das Datum.
 * Eine reine Umformatierung nicht.
 */
export const CONTENT_REVISIONS: Record<string, string> = {
  "/anleitung/": "2026-08-15",
  "/strategie/": "2026-08-15",
  "/vergleich/": "2026-08-15",
  "/glossar/": "2026-08-15",
  "/zahlen/": "2026-08-15",
  "/changelog/": "2026-08-15",
  "/blog/": "2026-08-15",
  "/faq/": "2026-08-31",
  "/ueber/": "2026-08-31",
  "/kontakt/": "2026-08-31",
  "/redaktion/": "2026-08-31",
  "/cookies/": "2026-08-31",
};

/** Deutsches Langdatum, z. B. "31. August 2026". Leerer String, wenn unbekannt. */
export function revisionLabel(path: string): string {
  const iso = CONTENT_REVISIONS[path];
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
