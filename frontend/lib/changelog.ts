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
    date: "2026-09-23",
    kind: "Neu",
    title: "Werbung von Adcash, nur mit Einwilligung",
    body:
      "Bis Google AdSense freigeschaltet ist, finanziert sich Kontexto über Werbung von Adcash. " +
      "Beim ersten Besuch fragt ein Banner, ob du Werbung erlaubst; ohne Zustimmung lädt kein " +
      "Werbeskript, und das Spiel bleibt unverändert. Anzeigen erscheinen auf den Spielseiten, " +
      "allein wie zu mehreren, nie auf Inhalts- und Rechtsseiten oder im Stream-Modus. Die Wahl " +
      "lässt sich jederzeit über „Cookie-Einstellungen“ in der Fußzeile ändern.",
  },
  {
    date: "2026-09-21",
    kind: "Verbessert",
    title: "Kleinere Ränge, leichtere Lösungen",
    body:
      "Gezählt wird ein Rang jetzt im Kernwortschatz, also unter rund 16.000 Alltagswörtern statt " +
      "unter 80.000 Wortformen. Dadurch stehen in der Nähe des Lösungsworts keine seltenen " +
      "Komposita und keine Beugungsformen mehr, und die angezeigte Zahl ist etwa sechsmal " +
      "kleiner. Raten darfst du weiterhin alles, was das Spiel vorher angenommen hat. Dazu " +
      "wurden die Lösungswörter neu ausgewählt: 2.710 alltagsnahe Substantive, jedes einzeln " +
      "durchgespielt und von Hand geprüft.",
    href: "/blog/wie-das-loesungswort-entsteht/",
    hrefLabel: "Wie das Lösungswort entsteht",
  },
  {
    date: "2026-09-21",
    kind: "Verbessert",
    title: "Neues Erscheinungsbild",
    body:
      "Das Spiel hat ein neues Gesicht: eine feste Schriftskala statt gewachsener Größen, eine Karte, die überall gleich aussieht, und Tintenblau als Grundfarbe in hell und dunkel. Die Farben der Rangleiste bleiben unangetastet, weil der geteilte Ergebnistext sie als Quadrate buchstabiert. Wem das alte Grau lieber ist, findet es in den Einstellungen als Farbwelt „Klassisch“.",
  },
  {
    date: "2026-09-21",
    kind: "Neu",
    title: "Fünf Farbwelten in den Einstellungen",
    body:
      "Die Akzentfarbe ist jetzt wählbar, unabhängig von hell und dunkel: Tinte, Beere, Indigo, Petrol und Klassisch. Eine Farbwelt ändert nur die Farbe, Schrift, Abstände und Aufbau bleiben in allen gleich. Die Wahl steht in den Einstellungen von Kontexto und Wördle und gilt auch beim nächsten Laden.",
  },
  {
    date: "2026-09-21",
    kind: "Verbessert",
    title: "Jede Lösung ist jetzt ein greifbares Ding",
    body:
      "Lösungswörter sind ab jetzt ausschließlich konkrete Gattungswörter, also Dinge, die man sich vorstellen kann. Verben und Adjektive darfst du weiter raten, sie sind nur keine Lösung mehr. Der Grund ist gemessen und nicht behauptet: auf den beendeten Partien dieser Seite kostete ein abstraktes Lösungswort im Schnitt 118 Rateversuche, ein greifbares 48.",
  },
  {
    date: "2026-09-21",
    kind: "Verbessert",
    title: "Die Tagesrätsel werden kürzer und alltäglicher",
    body:
      "Die Reihe der Tagesrätsel zieht jetzt aus einem Band alltäglicher Wörter: im Mittel sieben Buchstaben statt neun und deutlich seltener ein zusammengesetztes Wort, damit die Schwierigkeit von Tag zu Tag streut, statt langsam anzusteigen. Deine Spielnummer und alle bisherigen Lösungen bleiben unverändert, es gibt also keinen Neustart bei Tag 1. In den Zufallsmodi kommen die langen Komposita weiterhin vor.",
  },
  {
    date: "2026-09-21",
    kind: "Neu",
    title: "Die Mitspielersuche zeigt, wo gerade jemand ist",
    body:
      "Vor dem Anstellen steht bei jedem Modus, wie viele gerade warten und wie viele gerade spielen. Bisher war die Suche eine Entscheidung ins Blaue, weil die Zahl der Wartenden erst hinter dem eigenen Ticket auftauchte.",
    href: "/suche/",
    hrefLabel: "Mitspieler suchen",
  },
  {
    date: "2026-09-21",
    kind: "Behoben",
    title: "Karteileichen in den Spielerlisten",
    body:
      "Nach einer Aktualisierung des Servers blieben Mitspielende, die längst weg waren, im Raum als verbunden stehen, bis die stündliche Aufräumung sie entfernte. Der Verbindungsstand wird jetzt beim Start einmal zurückgesetzt, sodass Duell, Koop und Arena nur noch zeigen, wer wirklich da ist.",
  },
  {
    date: "2026-09-20",
    kind: "Neu",
    title: "Mitspielersuche: spielen, ohne jemanden einladen zu müssen",
    body:
      "Bisher brauchte jede Mehrspielerrunde einen Einladungslink, also jemanden zum Einladen. Jetzt gibt es eine Suche: Modus wählen, kurz warten, und der Server stellt dich mit Fremden zusammen. Das gilt für Duell, Koop, Wördle-Duell und die drei neuen Arena-Modi. Deinen Namen lesen dabei Unbekannte mit, deshalb bekommst du ohne Eingabe einen zugeteilten.",
    href: "/suche/",
    hrefLabel: "Mitspieler suchen",
  },
  {
    date: "2026-09-20",
    kind: "Neu",
    title: "Drei Modi mit Uhr: Battle Royale, Blitz-Duell, Zeitbonus-Jagd",
    body:
      "In der Arena läuft die Zeit mit. Im Battle Royale scheidet alle paar Minuten aus, wer am weitesten weg ist, und die Uhr wird von Runde zu Runde kürzer. Das Blitz-Duell gibt dem ganzen Raum 120 Sekunden, danach gewinnt der beste Rang. In der Zeitbonus-Jagd hat jeder eine eigene Uhr, und nur ein Wort, das näher dran ist als dein bisher bestes, legt Sekunden drauf.",
    href: "/arena/",
    hrefLabel: "Die Arena-Modi ansehen",
  },
  {
    date: "2026-09-20",
    kind: "Neu",
    title: "Vier neue Solo-Modi",
    body:
      "Jeder nimmt dem täglichen Spiel eine Selbstverständlichkeit weg. Leiter gibt ein Startwort vor, und jedes weitere muss näher dran sein. Limitierte Versuche gibt dir zwanzig Wörter und keine Tipps. Doppelziel sucht zwei geheime Wörter gleichzeitig, jeder Versuch bekommt zwei Ränge. Sudden Death zeigt dir die fünf nächsten Nachbarn und lässt dir genau einen Versuch.",
    href: "/modi/",
    hrefLabel: "Alle Spielmodi",
  },
  {
    date: "2026-09-20",
    kind: "Verbessert",
    title: "Geteilte Ergebnisse enthalten jetzt den Link zum Spiel",
    body:
      "Bisher wanderte beim Teilen nur das Farbmuster in die Zwischenablage, ohne Adresse. Wer es geschickt bekam, musste die Seite selbst suchen. Jetzt steht der Link zum Spiel darunter, bei Kontexto und bei Wördle.",
  },
  {
    date: "2026-09-20",
    kind: "Neu",
    title: "Eine einzige Frage: Woher kennst du Kontexto?",
    body:
      "Nach dem ersten beendeten Spiel erscheint einmalig ein kleiner Dialog mit einer Frage, beantwortet mit einem Klick auf eine der neun Antworten oder mit „Überspringen“. Wer mag, ergänzt danach freiwillig ein Stichwort, etwa den Kanal oder das Subreddit. Der Dialog kommt nie ein zweites Mal, und gespeichert wird nur der gewählte Kanal, ohne Bezug zu deiner Person.",
    href: "/datenschutz/",
    hrefLabel: "Was dabei gespeichert wird",
  },
  {
    date: "2026-09-15",
    kind: "Behoben",
    title: "Benchmark und Spielstatistik präzisiert",
    body:
      "Die Startwort-Auswertung nennt jetzt die tatsächlich stärksten Einzelwörter und trennt ihre Messung klar von einer nicht getesteten Vierer-Kombination. Die 71-Prozent-Kennzahl ist ausdrücklich als Anteil gelöster Partien unter den beendeten Partien beschrieben. Die Wochentagsgrafik verwendet dieselbe Tagesquoten-Definition wie die zugehörige Tabelle. Simulierte Beispiele und externe Grundlagen sind ebenfalls gekennzeichnet beziehungsweise direkt verlinkt.",
    href: "/zahlen/",
    hrefLabel: "Zu den Zahlen",
  },
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
      "Eine neue Seite zeigt die serverseitig gezählten Kennzahlen, die 100 meistgeratenen Wörter und einen Startwort-Benchmark über alle 2.400 vorbereiteten Rätsel. Die Auswertung machte sichtbar, dass „Wasser“ im gewählten Kriterium schwach ist und im getesteten Kandidatenfeld vier Verben unter den fünf stärksten Einzelwörtern liegen.",
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
      "Der häufigste Kritikpunkt war, dass zu oft Eigennamen wie „Emma“ oder „Berlin“ die Lösung waren. Die Auswahl prüft jetzt jedes Kandidatenwort mit mehreren Verfahren und lässt nur häufige deutsche Inhaltswörter durch. Weil sich damit die Zuordnung von Tag zu Wort geändert hat, beginnt die Rätselreihe neu bei Tag 1. Die persönliche Statistik blieb erhalten.",
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
      "Für die Finanzierung ist Werbung vorgesehen, damit das Spiel kostenlos bleiben kann. Im aktuellen Prüfmodus werden keine Anzeigenflächen ausgeliefert. Nach einer Freischaltung sollen Werbe- und Trackingcookies nur nach ausdrücklicher Einwilligung gesetzt werden; Anzeigen sind ausschließlich auf den beiden Einzelspieler-Seiten vorgesehen, nicht auf Duell-, Koop- oder Inhaltsseiten.",
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
