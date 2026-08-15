/**
 * Öffentliche Änderungshistorie des Spiels.
 *
 * Bewusst kuratiert und nicht aus der Git-Historie generiert: Hier stehen nur
 * Änderungen, die für Spielende spürbar sind, in ihrer Sprache beschrieben.
 * Reine Refactorings, Abhängigkeits-Updates und Infrastrukturarbeit gehören
 * nicht hierher.
 *
 * Reihenfolge: neueste zuerst. `date` ist das Datum der Veröffentlichung
 * (ISO, YYYY-MM-DD) und entspricht dem Stand im Repository.
 */
export type ChangeKind = "Neu" | "Verbessert" | "Behoben";

export interface ChangelogEntry {
  date: string;
  kind: ChangeKind;
  title: string;
  /** Ein bis drei Sätze in ganzen Worten, keine Commit-Zusammenfassung. */
  body: string;
  /** Optionaler interner Link auf den Artikel, der die Änderung erklärt. */
  href?: string;
  hrefLabel?: string;
}

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-08-15",
    kind: "Verbessert",
    title: "Spielseiten erklären das Spiel jetzt auch",
    body:
      "Unter Wördle, Duell, Koop und Wördle-Duell stand bisher nur ein Absatz. Jetzt gibt es dort jeweils eine ausführliche Erklärung: warum Wördle ohne Umlaute auskommt, wie sich Rate- und Lösungsliste unterscheiden, welche Startwörter etwas bringen und wie man die Farbmuster des Gegenübers im Duell liest. Dazu je ein eigener Fragenbereich.",
    href: "/wordle/",
    hrefLabel: "Zum Wördle",
  },
  {
    date: "2026-08-15",
    kind: "Neu",
    title: "Kontexto in Zahlen: gemessene Daten statt Behauptungen",
    body:
      "Eine neue Seite zeigt die serverseitig gezählten Kennzahlen, die 100 meistgeratenen Wörter und einen Startwort-Benchmark über alle 2.400 vorberechneten Rätsel. Die Auswertung hat drei eigene Empfehlungen widerlegt: „Wasser“ ist gemessen ein schlechtes Startwort, und Verben schlagen Substantive deutlich. Die Strategie-Seite, die Spielanleitung und die FAQ wurden entsprechend korrigiert.",
    href: "/zahlen/",
    hrefLabel: "Zu den Zahlen",
  },
  {
    date: "2026-08-15",
    kind: "Verbessert",
    title: "Blog überarbeitet und deutlich erweitert",
    body:
      "Alle bestehenden Artikel wurden neu geschrieben und vertieft, dazu sind neun neue dazugekommen, unter anderem über die Auswahl der Lösungswörter, die Entzerrung der Wortvektoren, die genauen Formeln hinter der Tipp-Funktion und den Aufbau der Wördle-Wortlisten.",
    href: "/blog/",
    hrefLabel: "Zum Blog",
  },
  {
    date: "2026-06-27",
    kind: "Neu",
    title: "Nächstes Spiel in allen Mehrspieler-Modi, Aufgeben im Koop",
    body:
      "Nach einer beendeten Partie lässt sich direkt ein neues Rätsel starten, in Duell, Koop und Wördle-Duell. Bereits gespielte Rätsel werden dabei nicht erneut gezogen. Im Koop gibt es jetzt außerdem einen Aufgeben-Knopf, der für die ganze Gruppe auflöst.",
    href: "/blog/duell-und-koop-taktik/",
    hrefLabel: "Taktik für beide Modi",
  },
  {
    date: "2026-06-19",
    kind: "Behoben",
    title: "Keine anstößigen Wörter und keine ß/ss-Doppelformen mehr als Lösung",
    body:
      "Zwei Nachbesserungen an der Lösungsauswahl. Eindeutig derbe, sexuelle und beleidigende Ausdrücke sind als Tageslösung gesperrt, nachdem „Arsch“ erschienen war. Außerdem fallen Wörter heraus, die eine ß/ss-Doppelform im Vokabular haben: Als „anlässlich“ Lösung war, lag „anläßlich“ auf Rang 2, und wer die alte Schreibweise tippte, gewann trotzdem nicht. Geraten werden dürfen alle diese Wörter weiterhin.",
    href: "/blog/warum-keine-namen-mehr-als-loesungswoerter/",
    hrefLabel: "Hintergrund zur Lösungsauswahl",
  },
  {
    date: "2026-06-13",
    kind: "Neu",
    title: "Event-Skin zur WM 2026",
    body:
      "Ein zeitlich begrenztes Erscheinungsbild, das sich nach dem Finale von selbst wieder abschaltet. Wer es nicht mag, kann es in den Einstellungen dauerhaft ausschalten.",
  },
  {
    date: "2026-06-10",
    kind: "Neu",
    title: "Koop-Modus: gemeinsam statt gegeneinander",
    body:
      "Neben dem Duell gibt es jetzt einen kooperativen Modus. Alle Beteiligten teilen sich eine einzige Rateliste, jeder Zug ist für alle sichtbar, und es gibt keinen Sieger, sondern ein gemeinsames Ergebnis. Der Einladungslink lässt sich mit einem Klick kopieren.",
    href: "/blog/duell-und-koop-taktik/",
    hrefLabel: "Wie man Koop spielt",
  },
  {
    date: "2026-06-08",
    kind: "Neu",
    title: "Unendlich-Modus",
    body:
      "Wer mit dem Tagesrätsel fertig ist, kann beliebig viele weitere Partien aus dem vorberechneten Pool spielen. Bereits gespielte Rätsel werden innerhalb einer Sitzung nicht wiederholt.",
  },
  {
    date: "2026-06-08",
    kind: "Behoben",
    title: "Lösungswort-Auswahl komplett neu gebaut, Neustart bei Tag 1",
    body:
      "Der häufigste Kritikpunkt war, dass zu oft Eigennamen wie „Emma“ oder „Berlin“ die Lösung waren. Die Auswahl prüft jetzt jedes Kandidatenwort mit vier unabhängigen Verfahren und lässt nur allgemein bekannte deutsche Inhaltswörter durch. Weil sich damit die Zuordnung von Tag zu Wort geändert hat, beginnt die Rätselreihe neu bei Tag 1. Die persönliche Statistik blieb erhalten.",
    href: "/blog/warum-keine-namen-mehr-als-loesungswoerter/",
    hrefLabel: "Was genau geändert wurde",
  },
  {
    date: "2026-06-08",
    kind: "Behoben",
    title: "Veraltete Seiten nach einem Update",
    body:
      "Wer die Seite lange offen hatte, blieb nach einer Aktualisierung gelegentlich in einem hängenden Ladezustand, weil die alte Seite auf nicht mehr vorhandene Dateien verwies. Die Auslieferung erzwingt jetzt eine Neuprüfung des Seitengerüsts.",
  },
  {
    date: "2026-06-07",
    kind: "Neu",
    title: "Werbung mit Einwilligungsverwaltung",
    body:
      "Kontexto finanziert sich über Werbung, damit das Spiel kostenlos bleiben kann. Werbe- und Trackingcookies werden nur nach ausdrücklicher Einwilligung gesetzt, die sich jederzeit widerrufen lässt. Anzeigen laufen ausschließlich auf den beiden Einzelspieler-Seiten, nicht auf Duell-, Koop- oder Inhaltsseiten.",
  },
  {
    date: "2026-06-07",
    kind: "Behoben",
    title: "Archiv und Sternebewertung wieder entfernt",
    body:
      "Beide Funktionen wurden kurz nach der Einführung zurückgenommen. Das Archiv hätte beim Erzeugen der Seiten einen laufenden Server gebraucht, den der Build bewusst nicht hat. Die Sternebewertung war eine Selbstbewertung auf der eigenen Seite und damit für Suchmaschinen wertlos. Ehrlicher, beides wegzulassen, als es halb funktionieren zu lassen.",
  },
  {
    date: "2026-06-07",
    kind: "Verbessert",
    title: "Bedienbarkeit mit Tastatur und Screenreader",
    body:
      "Dialoge haben durchgängig beschreibende Texte für Screenreader bekommen, und die Auswertungsgrafiken lassen sich mit der Tastatur bedienen. Ladeplatzhalter reservieren jetzt die spätere Höhe, damit beim Nachladen nichts mehr springt.",
  },
];
