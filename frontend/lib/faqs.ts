export interface Faq {
  q: string;
  a: string;
}

export const faqs: Faq[] = [
  {
    q: `Was ist Kontexto?`,
    a: `Kontexto ist ein tägliches Wortratespiel, bei dem du das geheime Zielwort anhand von Bedeutungsähnlichkeit erraten musst. Nach jedem Tipp siehst du, wie nah dein Wort der Bedeutung des Zielworts kommt, berechnet durch KI-Worteinbettungen.`,
  },
  {
    q: `Wie wird die Ähnlichkeit berechnet?`,
    a: `Wir verwenden fastText-Worteinbettungen, die auf großen deutschen Textkorpora trainiert wurden. Die Ähnlichkeit basiert auf dem Kontext, in dem Wörter typischerweise verwendet werden (Kosinus-Ähnlichkeit), nicht auf Buchstabenähnlichkeit.`,
  },
  {
    q: `Wann gibt es ein neues Wort?`,
    a: `Jeden Tag um Mitternacht wird ein neues geheimes Wort freigeschaltet. Alle Spielenden raten am selben Tag dasselbe Wort.`,
  },
  {
    q: `Was bedeuten die Farben?`,
    a: `Grün (Rang 1–300) bedeutet sehr nah am Zielwort, Gelb (Rang 301–1500) bedeutet auf dem richtigen Weg, und Rot (ab Rang 1501) bedeutet noch weit entfernt.`,
  },
  {
    q: `Wie viele Versuche habe ich?`,
    a: `Unbegrenzt viele. Kontexto setzt auf Nachdenken statt Zeitdruck. Du kannst so viele Wörter eingeben, wie du möchtest, bis du das Zielwort auf Rang 1 findest.`,
  },
  {
    q: `Mein Wort wird nicht akzeptiert, warum?`,
    a: `Es werden nur Wörter erkannt, die im deutschen Wortschatz des Modells enthalten sind. Eigennamen, sehr seltene Begriffe, Tippfehler oder ungewöhnliche Beugungsformen fehlen manchmal. Probiere die Grundform oder ein gebräuchlicheres Synonym.`,
  },
  {
    q: `Kann ich auf mehreren Geräten spielen?`,
    a: `Der Spielstand wird lokal in deinem Browser gespeichert und nicht zwischen Geräten synchronisiert. Wechselst du das Gerät oder löschst die Browserdaten, beginnst du das aktuelle Rätsel neu.`,
  },
  {
    q: `Auf welchen Geräten kann ich Kontexto spielen?`,
    a: `Auf jedem modernen Gerät mit Browser: Smartphone, Tablet, Laptop oder Desktop. Das Layout passt sich automatisch an, eine Installation ist nicht nötig.`,
  },
  {
    q: `Gibt es Kontexto als App?`,
    a: `Kontexto ist eine Web-App und läuft direkt im Browser, ganz ohne Download. Auf dem Smartphone kannst du die Seite über „Zum Startbildschirm hinzufügen“ wie eine App ablegen und im Vollbild spielen.`,
  },
  {
    q: `Kann ich frühere Wörter nachspielen?`,
    a: `Pro Tag gibt es genau ein Rätsel für alle. Ein durchsuchbares Archiv vergangener Lösungen bieten wir derzeit nicht an, jeden Tag wartet dafür ein frisches Zielwort.`,
  },
  {
    q: `Ist Kontexto kostenlos? Gibt es Werbung?`,
    a: `Kontexto ist komplett kostenlos und ohne Anmeldung spielbar. Zur Finanzierung wird Werbung eingeblendet; Tracking- und Werbe-Cookies werden nur mit deiner Einwilligung gesetzt, die du jederzeit widerrufen kannst.`,
  },
  {
    q: `Was ist der Unterschied zwischen Kontexto und Wordle?`,
    a: `Bei Wordle (auf Deutsch: Wördle) errätst du ein Wort Buchstabe für Buchstabe in begrenzten Versuchen. Bei Kontexto zählt die Bedeutung: Du erhältst zu jedem Wort einen Ähnlichkeitsrang und hast unbegrenzt viele Versuche.`,
  },
  {
    q: `Was ist der Unterschied zwischen Kontexto und Contexto?`,
    a: `Kontexto ist die deutsche Version des beliebten Wortspiels Contexto. Während Contexto auf Englisch, Portugiesisch und weiteren Sprachen läuft, konzentriert sich Kontexto vollständig auf die deutsche Sprache mit deutschen Worteinbettungen.`,
  },
  {
    q: `Worin unterscheidet sich Kontexto von Semantle?`,
    a: `Semantle ist das englischsprachige Vorbild für bedeutungsbasiertes Wortraten. Kontexto zeigt statt eines schwer greifbaren Prozentwerts einen leicht lesbaren Rang an und ist vollständig auf Deutsch.`,
  },
  {
    q: `Welche Wörter eignen sich als Startwort?`,
    a: `Gemessen über alle 2.400 Rätsel schneiden „gehen“, „arbeit“, „sehen“ und „zeit“ am besten ab; drei davon sind Verben, weil Verben in Sätze zu fast jedem Thema passen. Entscheidend ist dabei nicht, ob ein Startwort grün wird, sondern wie oft es überhaupt einen Rang unter 1500 liefert. Selbst das beste Wort schafft das nur in gut jeder achten Partie.`,
  },
  {
    q: `Wie werde ich besser bei Kontexto?`,
    a: `Beginne mit vier breiten Startwörtern aus vier verschiedenen Bereichen, werte zuerst die schlechten Ränge aus, weil sie ganze Felder ausschließen, und miss danach Richtungen statt Synonyme. Wenn sich dein bester Rang nach fünf gezielten Zügen im selben Feld nicht verbessert, wechsle das Feld.`,
  },
  {
    q: `Kann das Lösungswort ein Verb oder Adjektiv sein?`,
    a: `Ja. Das Lösungswort ist immer ein deutsches Inhaltswort in Grundform, und dazu zählen Verben im Infinitiv und unflektierte Adjektive. „laufen“, „kalt“ und „hell“ sind ganz normale Lösungen. Wer nur Substantive probiert, verschenkt einen großen Teil des Suchraums.`,
  },
  {
    q: `Können Eigennamen die Lösung sein?`,
    a: `Nein. Vornamen, Nachnamen, Städte und Marken sind als Lösung gesperrt, weil die Bedeutungsnachbarschaft eines Namens überwiegend aus anderen Namen besteht und man sich deshalb nicht herantasten kann. Als Tipp darfst du sie weiterhin eingeben.`,
  },
  {
    q: `Wie funktioniert der Tipp und was bedeuten die Schwierigkeitsgrade?`,
    a: `Alle drei Stufen rechnen mit deinem bisher besten Rang. „Leicht“ halbiert ihn, „mittel“ liefert das Wort direkt vor deinem besten, „schwer“ zieht eine Zufallszahl zwischen 2 und deinem besten Rang. Die Lösung selbst wird nie als Tipp ausgegeben, und bereits geratene Wörter werden übersprungen.`,
  },
  {
    q: `Warum liegt ein Gegenteil manchmal ganz vorne?`,
    a: `Weil das Modell misst, in welchen Zusammenhängen Wörter vorkommen, und nicht, ob sie dasselbe bedeuten. „heiß“ und „kalt“ stehen in praktisch identischen Sätzen, also liegen ihre Vektoren nah beieinander. Ein sehr guter Rang heißt „im richtigen Bedeutungsfeld“, nicht „inhaltlich zutreffend“.`,
  },
  {
    q: `Warum sehe ich keinen Prozentwert wie bei Semantle?`,
    a: `Weil ein roher Ähnlichkeitswert nicht einzuordnen ist: Bei Worteinbettungen liegen fast alle sinnvollen Wortpaare in einem schmalen Band, und zwischen 0,41 und 0,48 kann der Unterschied zwischen „daneben“ und „unmittelbar davor“ liegen. Ein Rang ist relativ und damit lesbar.`,
  },
  {
    q: `Kann ich Kontexto mit Freunden spielen?`,
    a: `Ja, in zwei Varianten. Im Duell rät jeder für sich am selben geheimen Wort und sieht vom Gegenüber nur Rang und Versuchszahl. Im Koop teilen sich alle eine gemeinsame Rateliste. Beides läuft über einen geteilten Link, ohne Konto und ohne Installation.`,
  },
  {
    q: `Werden meine eingegebenen Wörter gespeichert?`,
    a: `Deine Rateliste liegt lokal in deinem Browser. An den Server geht das einzelne Wort, um seinen Rang nachzuschlagen; es wird nicht personenbezogen gespeichert. Für die Reichweitenmessung werden nur anonymisierte Summen geführt, ohne wiedererkennbare Kennung.`,
  },
];
