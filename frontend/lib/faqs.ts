export interface Faq {
  q: string;
  a: string;
}

export const faqs: Faq[] = [
  {
    q: `Was ist Kontexto?`,
    a: `Kontexto ist ein tägliches Wortratespiel, bei dem du das geheime Zielwort anhand von Bedeutungsähnlichkeit erraten musst. Nach jedem Tipp siehst du, wie nah dein Wort der Bedeutung des Zielworts kommt – berechnet durch KI-Worteinbettungen.`,
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
    a: `Unbegrenzt viele. Kontexto setzt auf Nachdenken statt Zeitdruck – du kannst so viele Wörter eingeben, wie du möchtest, bis du das Zielwort auf Rang 1 findest.`,
  },
  {
    q: `Mein Wort wird nicht akzeptiert – warum?`,
    a: `Es werden nur Wörter erkannt, die im deutschen Wortschatz des Modells enthalten sind. Eigennamen, sehr seltene Begriffe, Tippfehler oder ungewöhnliche Beugungsformen fehlen manchmal – probiere die Grundform oder ein gebräuchlicheres Synonym.`,
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
    a: `Kontexto ist eine Web-App und läuft direkt im Browser – ganz ohne Download. Auf dem Smartphone kannst du die Seite über „Zum Startbildschirm hinzufügen“ wie eine App ablegen und im Vollbild spielen.`,
  },
  {
    q: `Kann ich frühere Wörter nachspielen?`,
    a: `Pro Tag gibt es genau ein Rätsel für alle. Ein durchsuchbares Archiv vergangener Lösungen bieten wir derzeit nicht an – jeden Tag wartet dafür ein frisches Zielwort.`,
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
    a: `Breite Alltagsbegriffe mit vielen Bedeutungsverbindungen – etwa „Zeit“, „Mensch“, „Wasser“ oder „Arbeit“ – sind die besten Startwörter. Sie decken viele Themenfelder ab und zeigen schnell, in welche Richtung das Zielwort liegt.`,
  },
  {
    q: `Wie werde ich besser bei Kontexto?`,
    a: `Beginne mit breiten Startwörtern, grenze danach das Themenfeld systematisch über Synonyme und verwandte Begriffe ein, und variiere die Wortart, wenn du feststeckst. Ausführliche Techniken erklären wir auf der Strategie-Seite.`,
  },
];
