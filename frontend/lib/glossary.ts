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
    term: "All-but-the-Top",
    slug: "all-but-the-top",
    definition: `Ein Nachbearbeitungsschritt für Worteinbettungen: Vom Vektor jedes Wortes werden der Mittelwert aller Vektoren und die drei stärksten Hauptkomponenten abgezogen. Diese Anteile kodieren vor allem Worthäufigkeit statt Bedeutung. Ohne diesen Schritt lägen häufige Allerweltswörter bei jedem beliebigen Zielwort weit vorne.`,
  },
  {
    term: "Bloom-Filter",
    slug: "bloom-filter",
    definition: `Eine kompakte Datenstruktur, die in konstanter Zeit beantwortet, ob ein Wort überhaupt bekannt sein könnte. Sie kann sich nur in eine Richtung irren: Ein „kenne ich nicht“ ist immer korrekt, ein „kenne ich“ gelegentlich falsch. Kontexto nutzt sie, um unbekannte Eingaben abzuweisen, bevor eine teurere Suche startet.`,
  },
  {
    term: "Contexto",
    slug: "contexto",
    definition: `Das englischsprachige Original-Spiel (contexto.me), das 2022 aus dem brasilianischen Termo hervorging. Kontexto überträgt dasselbe Prinzip auf die deutsche Sprache mit deutschen Worteinbettungen, deutschem Vokabular und einer eigenen Lösungsauswahl.`,
  },
  {
    term: "fastText",
    slug: "fasttext",
    definition: `Ein von Meta AI Research entwickeltes Verfahren, um Worteinbettungen zu lernen. fastText zerlegt Wörter zusätzlich in Zeichen-n-Gramme und kommt dadurch auch mit seltenen oder zusammengesetzten Wörtern gut zurecht. Das ist für das Deutsche entscheidend. Kontexto verwendet das deutsche Modell cc.de.300 mit 300 Dimensionen pro Wort.`,
  },
  {
    term: "Gattungsname",
    slug: "gattungsname",
    definition: `Ein Wort, das eine Klasse von Dingen bezeichnet („Löwe“, „Rose“, „Sommer“), im Gegensatz zum Eigennamen, der ein einzelnes Individuum benennt. Unter den Substantiven kommen nur Gattungsnamen als Lösungswort infrage, nie Eigennamen, weil sich nur sie über Bedeutungsnähe erraten lassen. Verben und Adjektive sind als Lösung ebenfalls zugelassen.`,
  },
  {
    term: "Grundform (Lemma)",
    slug: "lemma",
    definition: `Die Nennform eines Wortes, also Nominativ Singular beim Substantiv und Infinitiv beim Verb („gehen“ für „ging“, „Haus“ für „Häuser“). Lösungswörter sind immer Grundformen. Beim Raten zieht eine Lemma-Tabelle gebeugte Eingaben automatisch auf ihre Grundform.`,
  },
  {
    term: "Hauptkomponente",
    slug: "hauptkomponente",
    definition: `Eine Richtung im Vektorraum, entlang derer die Daten besonders stark streuen. Bei Worteinbettungen tragen die stärksten Hauptkomponenten überwiegend Häufigkeitsinformation und keine Bedeutung, weshalb sie vor der Rangberechnung entfernt werden.`,
  },
  {
    term: "Kompositum",
    slug: "kompositum",
    definition: `Ein zusammengesetztes Wort wie „Strandkorb“ oder „Morgendämmerung“. Deutsch bildet Komposita unbegrenzt produktiv, weshalb keine endliche Wortliste sie alle enthalten kann. fastText schätzt seltene Komposita über ihre Zeichen-n-Gramme ab, was zugleich Ähnlichkeit vortäuschen kann, wo keine ist.`,
  },
  {
    term: "Kontext",
    slug: "kontext",
    definition: `Die sprachliche Umgebung, in der ein Wort typischerweise vorkommt. Worteinbettungen leiten die Bedeutung eines Wortes allein aus seinem Kontext ab, nach dem Prinzip „Du erkennst ein Wort an der Gesellschaft, die es hält“.`,
  },
  {
    term: "Korpus",
    slug: "korpus",
    definition: `Eine sehr große Sammlung von Texten, auf der das Modell trainiert wird. Kontexto beruht auf einem Modell, das auf Common Crawl und der deutschen Wikipedia trainiert wurde. Größe und Zusammensetzung des Korpus bestimmen, welche Bedeutungsnachbarschaften das Modell überhaupt kennt.`,
  },
  {
    term: "Kosinus-Ähnlichkeit",
    slug: "kosinus-aehnlichkeit",
    definition: `Ein Maß für den Winkel zwischen zwei Vektoren, das von -1 bis 1 reicht; je näher an 1, desto ähnlicher die Bedeutung. Gemessen wird der Winkel und nicht der Abstand, weil die Länge eines Wortvektors mit der Worthäufigkeit zusammenhängt und die Messung sonst verfälschen würde.`,
  },
  {
    term: "Lösungswort (Zielwort)",
    slug: "zielwort",
    definition: `Das geheime Wort des Tages, das es zu erraten gilt. Es ist für alle Spielenden am selben Tag identisch und wechselt um Mitternacht. Der Pool der möglichen Lösungswörter ist deutlich kleiner und strenger gefiltert als das ratbare Vokabular.`,
  },
  {
    term: "n-Gramm",
    slug: "n-gramm",
    definition: `Eine Folge von n aufeinanderfolgenden Einheiten, bei fastText sind es Zeichen. Durch Zeichen-n-Gramme erfasst das Modell auch Bestandteile zusammengesetzter Wörter wie „Strandkorb“ und kann Vektoren für Wörter bilden, die es nie vollständig gesehen hat.`,
  },
  {
    term: "Rang",
    slug: "rang",
    definition: `Die Position eines geratenen Wortes in der nach Ähnlichkeit sortierten Liste aller Vokabelwörter. Rang 1 ist das Zielwort selbst. Der Rang ist eine relative Aussage: Rang 300 bedeutet, dass von 80.000 Wörtern nur 299 näher am Zielwort liegen.`,
  },
  {
    term: "Semantik",
    slug: "semantik",
    definition: `Die Lehre von der Bedeutung sprachlicher Zeichen. Kontexto bewertet Wörter nach semantischer Nähe, nicht nach Schreibweise, deshalb liegt „Hund“ nah bei „Katze“, aber weit von „Hundert“.`,
  },
  {
    term: "Semantisches Feld",
    slug: "semantisches-feld",
    definition: `Eine Gruppe von Wörtern, die thematisch zusammengehören (etwa „Meer, Küste, Welle, Sand“). Gute Spielzüge tasten ein semantisches Feld systematisch ab, um das Zielwort einzukreisen. Ein gemeinsamer Wortstamm bildet dagegen kein Feld, sondern nur eine Zeichenfamilie.`,
  },
  {
    term: "Stoppwort",
    slug: "stoppwort",
    definition: `Ein sehr häufiges Funktionswort wie „der“, „und“ oder „mit“, das in nahezu jedem Text vorkommt und deshalb keine aussagekräftige Position im Bedeutungsraum hat. Kontexto weist solche Eingaben ausdrücklich ab, statt eine irreführende Zahl auszugeben.`,
  },
  {
    term: "Vektorraum",
    slug: "vektorraum",
    definition: `Der hochdimensionale Raum, in dem jedes Wort als Punkt (Vektor) liegt. Nähe im Vektorraum entspricht Ähnlichkeit in der Bedeutung. Das deutsche fastText-Modell nutzt 300 Dimensionen.`,
  },
  {
    term: "Vokabular",
    slug: "vokabular",
    definition: `Die Menge aller Wörter, die Kontexto als Eingabe akzeptiert und für die ein Rang berechnet wurde. Sie umfasst die 80.000 häufigsten gefilterten deutschen Wörter. Nicht jedes davon kann Lösung werden: Eigennamen etwa sind ratbar, aber als Lösung gesperrt.`,
  },
  {
    term: "Worteinbettung (Embedding)",
    slug: "worteinbettung",
    definition: `Die Darstellung eines Wortes als Zahlenvektor. Wörter, die in ähnlichen Kontexten vorkommen, erhalten ähnliche Vektoren, so wird Bedeutung für den Computer mathematisch vergleichbar.`,
  },
  {
    term: "Zipf-Häufigkeit",
    slug: "zipf-haeufigkeit",
    definition: `Eine logarithmische Skala für die Häufigkeit eines Wortes in einer Sprache. Der Wert 4,0 entspricht etwa zehn Vorkommen pro Million Wörter. Kontexto verlangt von Lösungswörtern mindestens 4,0, damit praktisch jede erwachsene Person das gesuchte Wort kennt.`,
  },
];
