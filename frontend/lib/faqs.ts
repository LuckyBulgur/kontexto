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

/**
 * Wördle-spezifische Fragen für /wordle/. Bewusst getrennt von `faqs`: Die
 * Kontexto-Antworten (Rang, Bedeutungsähnlichkeit, unbegrenzte Versuche) gelten
 * dort nicht, und eine gemischte Liste würde beide Spiele verwischen.
 */
export const wordleFaqs: Faq[] = [
  {
    q: `Was ist Wördle?`,
    a: `Wördle ist die deutsche Variante von Wordle: Du errätst ein Wort mit fünf Buchstaben in höchstens sechs Versuchen. Nach jeder Eingabe zeigen Farben, welche Buchstaben stimmen. Jeden Tag um Mitternacht gibt es ein neues Wort, für alle dasselbe.`,
  },
  {
    q: `Was bedeuten die Farben?`,
    a: `Grün heißt richtiger Buchstabe an richtiger Stelle. Gelb heißt richtiger Buchstabe an falscher Stelle. Grau heißt, der Buchstabe kommt im Lösungswort nicht vor.`,
  },
  {
    q: `Warum gibt es keine Umlaute?`,
    a: `Wördle nutzt das Alphabet von a bis z, also 26 Buchstaben. Wörter mit ä, ö, ü oder ß sind dadurch ausgeschlossen. Die Alternativen wären schlechter gewesen: Umlaute auf der Tastatur machen das Layout auf dem Smartphone unhandlich und erfordern eine Sonderregel, ob „a“ als Teiltreffer für „ä“ zählt. Umlaute aufzulösen („ä“ zu „ae“) würde die Buchstabenzahl verfälschen, aus dem vierbuchstabigen „Käse“ würde ein fünfbuchstabiges „kaese“.`,
  },
  {
    q: `Kann die Lösung eine Mehrzahl oder eine gebeugte Form sein?`,
    a: `Nein. Lösungswörter sind immer Grundformen, also Nominativ Singular beim Substantiv und Infinitiv beim Verb. Als Tipp darfst du gebeugte Formen trotzdem eingeben, um Buchstaben abzufragen. Das ist eine echte Information: Du kannst Pluralformen aus deiner Kandidatenliste streichen.`,
  },
  {
    q: `Warum wird mein Wort nicht akzeptiert?`,
    a: `Akzeptiert wird jedes Fünfbuchstabenwort aus a bis z, das im Wortschatz steht, inklusive gebeugter Formen. Abgelehnt werden Wörter mit Umlauten, Eigennamen, sehr seltene Begriffe und Tippfehler. Die Rateliste ist bewusst großzügiger als die Lösungsliste.`,
  },
  {
    q: `Können Eigennamen die Lösung sein?`,
    a: `Nein. Lösungswörter durchlaufen dieselbe Prüfung wie bei Kontexto: keine Vornamen, keine Nachnamen, keine Städte, keine Marken, keine Fremdwörter und keine Fragmente. Übrig bleiben allgemein bekannte deutsche Inhaltswörter.`,
  },
  {
    q: `Welches Startwort ist gut?`,
    a: `Eines, das viele häufige Buchstaben gleichzeitig abfragt und keinen davon wiederholt. Wörter wie „reise“, „laden“, „staub“ oder „monat“ decken mehrere Vokale und häufige Konsonanten ab. Ein Wort mit doppeltem Buchstaben verschenkt dagegen eine Position.`,
  },
  {
    q: `Woher stammen die Wörter?`,
    a: `Beide Listen werden aus demselben deutschen Wortschatz erzeugt, auf dem auch Kontexto läuft. Es gibt keinen externen Download, der veralten könnte, und beide Spiele auf dieser Seite teilen denselben Wortschatzbegriff.`,
  },
  {
    q: `Kann ich Wördle gegen Freunde spielen?`,
    a: `Ja, im Wördle-Duell. Beide raten dasselbe Wort mit denselben sechs Versuchen, und du siehst live, wie weit dein Gegenüber ist. Der Einladungslink läuft ohne Konto und ohne Installation.`,
  },
  {
    q: `Kostet Wördle etwas?`,
    a: `Nein. Wördle ist komplett kostenlos und ohne Anmeldung spielbar. Der Spielstand liegt lokal in deinem Browser und wird nicht zwischen Geräten synchronisiert.`,
  },
];

/** Fragen zum Duell-Modus für /duel/. */
export const duelFaqs: Faq[] = [
  {
    q: `Wie funktioniert das Kontexto-Duell?`,
    a: `Alle Beteiligten raten dasselbe geheime Wort, aber jeder für sich. Du siehst vom Gegenüber den besten Rang, die Zahl der Versuche, die Zahl der benutzten Tipps und ob es gelöst hat. Die geratenen Wörter selbst bleiben verborgen. Wer zuerst auf Rang 1 landet, gewinnt.`,
  },
  {
    q: `Wie lade ich jemanden ein?`,
    a: `Beim Erstellen bekommst du einen Link mit einer sechsstelligen Kennung. Den verschickst du, das Gegenüber öffnet ihn, gibt einen Namen ein und ist dabei. Kein Konto, keine Bestätigungsmail, keine App.`,
  },
  {
    q: `Was kann ich beim Erstellen einstellen?`,
    a: `Zwei Dinge: welches Rätsel gespielt wird, das heutige oder ein zufälliges aus dem Pool, und ob Tipps erlaubt sind. Für ein sportliches Duell lohnt es sich, Tipps auszuschalten, denn ein Tipp auf „leicht“ halbiert den besten Rang und entscheidet knappe Rennen.`,
  },
  {
    q: `Wie schnell wird der Fortschritt aktualisiert?`,
    a: `Im Sekundentakt über eine dauerhafte Verbindung. Fällt sie aus, siehst du das am Verbindungszustand des anderen Spielers.`,
  },
  {
    q: `Wie lange bleibt ein Duell bestehen?`,
    a: `Eine Runde ohne verbundene Spieler wird nach einer Stunde ohne Aktivität automatisch aufgeräumt. Nach einer beendeten Partie könnt ihr direkt ein neues Rätsel starten, ein bereits gespieltes wird dabei nicht noch einmal gezogen.`,
  },
  {
    q: `Kann ich auch gemeinsam statt gegeneinander spielen?`,
    a: `Ja, im Koop-Modus. Dort teilen sich alle eine einzige Rateliste, jeder Zug ist für alle sichtbar, und es gibt keinen Sieger, sondern ein gemeinsames Ergebnis.`,
  },
];

/** Fragen zum Koop-Modus für /koop/. */
export const koopFaqs: Faq[] = [
  {
    q: `Wie funktioniert der Koop-Modus?`,
    a: `Alle Beteiligten suchen gemeinsam dasselbe geheime Wort und teilen sich eine einzige Rateliste. Jedes Wort, das jemand eintippt, erscheint bei allen anderen mit seinem Rang. Es gibt keinen Sieger, nur ein gemeinsames Ergebnis.`,
  },
  {
    q: `Wie viele Leute können mitspielen?`,
    a: `Beliebig viele. Jeder, der den Link öffnet und einen Namen eingibt, rät am selben Wort mit. Gleiche Namen werden automatisch unterscheidbar gemacht.`,
  },
  {
    q: `Was ist die beste Taktik zu mehreren?`,
    a: `Den Bedeutungsraum vorher aufteilen. Der häufigste Fehler ist, dass alle gleichzeitig Synonyme derselben Idee eintippen und damit dieselbe Information mehrfach messen. Besser: Einer nimmt Natur und Konkretes, einer Gesellschaft und Abstraktes, einer Tätigkeiten und Eigenschaften.`,
  },
  {
    q: `Was passiert, wenn jemand aufgibt?`,
    a: `Der Aufgeben-Knopf löst für alle auf, weil eine geteilte Rateliste ohne geteiltes Ende keinen Sinn ergäbe. Vorher lohnt ein Blick auf die 500 nächstliegenden Wörter, die nach dem Auflösen sichtbar werden.`,
  },
  {
    q: `Eignet sich Koop, um jemandem das Spiel beizubringen?`,
    a: `Ja, besser als jeder andere Modus. Man sieht die Ränge der anderen, kann fragen, warum jemand ein bestimmtes Wort gewählt hat, und lernt am fremden Zug oft mehr als am eigenen.`,
  },
];

/** Fragen zum Wördle-Duell für /wordle/duel/. */
export const wordleDuelFaqs: Faq[] = [
  {
    q: `Wie funktioniert das Wördle-Duell?`,
    a: `Alle Beteiligten raten dasselbe Wort mit fünf Buchstaben und haben dieselben sechs Versuche. Du siehst live, wie weit dein Gegenüber ist. Wer das Wort mit weniger Versuchen findet, gewinnt.`,
  },
  {
    q: `Sehe ich die Wörter meines Gegenübers?`,
    a: `Nein, nur die Farbmuster. Von jedem fremden Versuch siehst du die Reihe aus grünen, gelben und grauen Feldern, aber nicht die Buchstaben. Du erfährst also, wie nah jemand dran ist, ohne die Lösung geschenkt zu bekommen.`,
  },
  {
    q: `Kann ich aus den Farben des Gegners etwas ableiten?`,
    a: `Ja, und das ist der taktische Reiz. Drei grüne Felder beim Gegenüber heißen, dass die Zeit knapp wird und du eher raten als absichern solltest. Viele graue Felder heißen umgekehrt, dass ihr beide noch am Anfang steht und sich ein sauberer Ausschlusszug lohnt.`,
  },
  {
    q: `Wie lade ich jemanden ein?`,
    a: `Beim Erstellen bekommst du einen Link mit sechsstelliger Kennung. Verschicken, öffnen, Namen eingeben, fertig. Kein Konto, keine Installation.`,
  },
  {
    q: `Welches Wort wird gespielt?`,
    a: `Du wählst beim Erstellen zwischen dem heutigen Wördle und einem zufälligen Wort aus dem Pool. In beiden Fällen raten alle dasselbe Wort.`,
  },
  {
    q: `Was passiert, wenn beide das Wort nicht finden?`,
    a: `Die Partie endet, sobald alle gelöst haben oder ihre sechs Versuche aufgebraucht sind. Danach könnt ihr direkt eine neue Runde starten.`,
  },
];
