export interface Faq {
  q: string;
  a: string;
}

/**
 * Die vollstaendige Kontexto-FAQ. Sie traegt die Seite /faq/ und ist dort die
 * eigentliche Substanz: ausfuehrliche Antworten mit Beispielen und Zahlen.
 *
 * Die Startseite verwendet bewusst NICHT diese Liste, sondern `homeFaqs`
 * (sechs Kernfragen in eigenstaendig formulierten Kurzfassungen). Vorher
 * rendered beide Seiten dieselbe Liste, wodurch /faq/ zu 92 Prozent aus
 * Startseitentext bestand. Doppelter Inhalt auf zwei indexierten URLs ist der
 * am haeufigsten genannte Grund fuer die AdSense-Ablehnung "minderwertige
 * Inhalte", und Google waehlt in so einem Fall selbst eine kanonische Seite.
 * Beide Listen muessen deshalb verschieden formuliert bleiben: gleiche Fragen,
 * andere Antworten. Der Test in faqs.test.ts haelt das fest.
 */
export const faqs: Faq[] = [
  {
    q: `Was ist Kontexto?`,
    a: `Kontexto ist ein tägliches Wortratespiel auf Deutsch. Jeden Tag um Mitternacht wird ein neues geheimes Zielwort freigeschaltet, und alle Spielenden suchen dasselbe. Du tippst ein beliebiges deutsches Wort ein und bekommst dafür einen Rang zurück: Rang 1 ist das Zielwort selbst, Rang 5000 heißt, dass 4999 andere Wörter näher an der Bedeutung liegen. Der Rang entsteht aus KI-Worteinbettungen, die messen, in welchen sprachlichen Zusammenhängen ein Wort typischerweise vorkommt. Es zählt also die Bedeutung, nicht die Schreibweise. Du hast unbegrenzt viele Versuche, brauchst kein Konto und zahlst nichts.`,
  },
  {
    q: `Wie wird die Ähnlichkeit berechnet?`,
    a: `Grundlage ist das deutsche fastText-Modell cc.de.300, trainiert auf Common Crawl und der deutschen Wikipedia. Jedes Wort ist darin ein Vektor aus 300 Zahlen, der festhält, in welchen Kontexten das Wort auftritt. Vor dem Spiel werden diese Vektoren entzerrt: Der Mittelwert aller Vektoren und die drei stärksten Hauptkomponenten werden entfernt, weil sie vor allem Worthäufigkeit abbilden und sonst jedes häufige Wort zu allem ähnlich wirken ließen. Danach wird für jedes Zielwort die Kosinus-Ähnlichkeit zu rund 80.000 Vokabeleinträgen berechnet und in eine feste Rangliste sortiert. Beim Raten wird nur noch nachgeschlagen, nicht gerechnet.`,
  },
  {
    q: `Wann gibt es ein neues Wort?`,
    a: `Um Mitternacht deutscher Zeit startet das nächste Rätsel. Alle Spielenden bekommen am selben Tag dasselbe Zielwort, deshalb lässt sich ein Ergebnis vergleichen, ohne die Lösung zu verraten. Die Rätsel sind durchnummeriert, die Nummer steht im Kopf des Spiels. Ein begonnenes Rätsel bleibt bis Mitternacht offen, du kannst also über den Tag verteilt weiterraten. Wer nicht auf den nächsten Tag warten will, spielt den Unendlich-Modus: Er zieht ein zufälliges Rätsel aus dem vorberechneten Bestand und lässt sich beliebig oft wiederholen.`,
  },
  {
    q: `Was bedeuten die Farben?`,
    a: `Die Farbe fasst zusammen, in welchem Bereich dein Rang liegt. Grün steht für Rang 1 bis 300 und heißt: Du bist im richtigen Bedeutungsfeld. Gelb steht für Rang 301 bis 1500 und heißt: Die Richtung stimmt, das Feld ist aber noch zu weit gefasst. Rot ab Rang 1501 heißt: Dieses Feld führt nicht zum Ziel. Die Farbe ersetzt die Zahl nicht, sie macht die Liste nur schneller lesbar. Aussagekräftiger als eine einzelne Farbe ist der Abstand zwischen deinen Rängen. Ein Sprung von 4000 auf 900 sagt mehr über die Richtung als ein einzelner grüner Treffer.`,
  },
  {
    q: `Wie viele Versuche habe ich?`,
    a: `Unbegrenzt viele. Kontexto ist kein Spiel gegen die Uhr und keines mit Fehlversuchsbudget, sondern eines, bei dem jeder Zug eine Messung ist. Ein Wort auf Rang 8000 ist deshalb kein verlorener Versuch, es schließt ein ganzes Bedeutungsfeld sicher aus. Über alle bisher ausgewerteten Partien liegt der Schnitt bei rund 85 Rateversuchen je Lösung, und 71 Prozent der begonnenen Rätsel werden gelöst. Wer deutlich darunter liegt, spielt gut. Wer darüber liegt, hat meist zu lange im selben Feld weitergesucht, statt das Feld zu wechseln.`,
  },
  {
    q: `Mein Wort wird nicht akzeptiert, warum?`,
    a: `Erkannt wird nur, was im deutschen Vokabular des Modells steht, rund 80.000 Einträge. Fehlt dein Wort, liegt das fast immer an einem von vier Gründen: ein Tippfehler, eine seltene Beugungsform, ein sehr spezieller Fachbegriff oder ein Eigenname. Probiere zuerst die Grundform, also den Infinitiv beim Verb und den Nominativ Singular beim Substantiv, danach ein gebräuchlicheres Synonym. Zusammengesetzte Wörter sind oft nur in der geläufigen Schreibweise enthalten. Die Prüfung läuft über einen Bloom-Filter und ist deshalb sofort da, ohne dass ein Versuch verbraucht wird.`,
  },
  {
    q: `Kann ich auf mehreren Geräten spielen?`,
    a: `Spielen ja, den Stand mitnehmen nein. Deine Rateliste, dein Fortschritt und deine Statistik liegen ausschließlich im lokalen Speicher des Browsers, in dem du spielst. Es gibt kein Konto, also auch nichts, woran ein Server einen Stand knüpfen könnte. Wechselst du vom Telefon an den Rechner, beginnst du das laufende Rätsel dort neu. Dasselbe passiert, wenn du die Browserdaten löschst oder im privaten Fenster spielst. Das ist eine bewusste Entscheidung gegen Anmeldung und Nutzerprofile, und sie kostet eben die Synchronisierung.`,
  },
  {
    q: `Auf welchen Geräten kann ich Kontexto spielen?`,
    a: `Auf jedem Gerät mit einem aktuellen Browser: Smartphone, Tablet, Notebook, Desktop. Es gibt nichts zu installieren und nichts einzurichten. Das Layout richtet sich nach der Fensterbreite, auf dem Telefon rückt die Eingabe an den unteren Rand über die Tastatur, am großen Bildschirm steht die Rateliste vollständig neben dem Eingabefeld. Bedienung per Tastatur und mit Screenreader ist berücksichtigt, ebenso die Systemeinstellung für reduzierte Bewegung. Ein heller und ein dunkler Modus stehen zur Wahl und folgen standardmäßig der Einstellung deines Systems.`,
  },
  {
    q: `Gibt es Kontexto als App?`,
    a: `Es gibt keine App in den Stores, und das ist Absicht. Kontexto ist eine Web-App und läuft vollständig im Browser, ohne Download und ohne Berechtigungen. Auf dem Telefon kannst du die Seite über „Zum Startbildschirm hinzufügen“ ablegen, danach startet sie mit eigenem Symbol im Vollbild und verhält sich wie eine installierte App. Ein Manifest dafür ist hinterlegt. Der Vorteil dieser Bauweise: Jede Änderung ist beim nächsten Aufruf da, es gibt keine veralteten Installationen und keine Store-Konten.`,
  },
  {
    q: `Kann ich frühere Wörter nachspielen?`,
    a: `Ein durchsuchbares Archiv aller vergangenen Tageslösungen gibt es bewusst nicht, weil es die Lösung des laufenden Tages zu leicht auffindbar machen würde. Über die Rätselnummer lässt sich ein früheres Rätsel aber gezielt aufrufen. Wer einfach mehr spielen möchte, nimmt den Unendlich-Modus: Er zieht ein zufälliges Rätsel aus dem vorberechneten Bestand von 2.400 Partien, unabhängig vom Datum, und merkt sich, welche du schon gespielt hast. So kannst du üben, so oft du willst, ohne dass die Tageslösung dabei irgendwo nachschlagbar wird.`,
  },
  {
    q: `Ist Kontexto kostenlos? Gibt es Werbung?`,
    a: `Das Spiel ist vollständig kostenlos, es gibt keine Bezahlschranke, keinen Abo-Bereich und keine Funktion, die hinter einer Zahlung liegt. Finanziert wird es über Werbung, die ausschließlich auf den beiden Einzelspieler-Seiten läuft. Inhaltsseiten, Rechtsseiten und die Mehrspieler-Räume bleiben werbefrei. Tracking- und Werbe-Cookies werden erst gesetzt, wenn du eingewilligt hast, und die Einwilligung lässt sich über den Link in der Fußzeile jederzeit ändern oder widerrufen. Ohne Einwilligung läuft das Spiel unverändert weiter, die Anzeigen sind dann nicht personalisiert.`,
  },
  {
    q: `Was ist der Unterschied zwischen Kontexto und Wordle?`,
    a: `Die beiden messen Verschiedenes. Bei Wordle, hier Wördle, suchst du ein Wort aus fünf Buchstaben in sechs Versuchen, und die Rückmeldung betrifft einzelne Buchstaben und ihre Position. Gefragt ist Ausschlusslogik, jeder Zug schneidet Kandidaten weg. Bei Kontexto ist die Schreibweise vollkommen egal. Du bekommst zu jedem Wort einen Bedeutungsrang, hast unbegrenzt viele Versuche und arbeitest dich über Assoziationen heran, jeder Zug misst eine Entfernung. Wördle ist meist in wenigen Minuten erledigt, eine Kontexto-Partie dauert typischerweise fünf bis dreißig Minuten. Beide gibt es hier täglich neu auf Deutsch.`,
  },
  {
    q: `Was ist der Unterschied zwischen Kontexto und Contexto?`,
    a: `Contexto ist das englischsprachige Spiel, das das Prinzip „Bedeutung statt Buchstaben“ bekannt gemacht hat. Kontexto ist eine eigenständige deutsche Umsetzung dieses Prinzips mit eigenem Modell, eigener Vokabelliste und eigener Lösungsauswahl. Der Unterschied ist größer als eine Übersetzung, weil Bedeutungsnähe sprachspezifisch ist: „Schloss“ für Gebäude und Türschloss oder „Bank“ für Geldinstitut und Sitzgelegenheit verhalten sich im deutschen Vektorraum anders als ihre englischen Entsprechungen. Dazu kommen Modi, die es dort nicht gibt: Unendlich, Duell und Koop.`,
  },
  {
    q: `Worin unterscheidet sich Kontexto von Semantle?`,
    a: `Semantle war eines der ersten bedeutungsbasierten Wortspiele und läuft auf Englisch. Der spürbarste Unterschied liegt in der Rückmeldung: Semantle zeigt eine Ähnlichkeit in Prozent, Kontexto einen Rang. Ein Prozentwert ist schwer einzuordnen, weil fast alle sinnvollen Wortpaare in einem schmalen Band liegen und schon Hundertstel entscheiden. Ein Rang ist relativ und damit sofort lesbar, 312 ist erkennbar besser als 4000. Dazu kommt der Wortschatz: Kontexto arbeitet durchgehend mit deutschen Einbettungen, deutschem Vokabular und deutschen Lösungswörtern.`,
  },
  {
    q: `Welche Wörter eignen sich als Startwort?`,
    a: `Gemessen über alle 2.400 vorberechneten Rätsel schneiden „gehen“, „arbeit“, „sehen“ und „zeit“ am besten ab. Drei davon sind Verben, weil ein Verb in Sätze zu fast jedem Thema passt, während ein Substantiv sein eigenes Thema mitbringt. Entscheidend ist nicht, ob ein Startwort grün wird, sondern wie oft es überhaupt einen Rang unter 1500 liefert. Selbst das beste Wort schafft das nur in gut jeder achten Partie. Überraschend schlecht liegt „wasser“ auf Platz 39 von 45: Es fühlt sich breit an, seine Satzumgebungen ähneln sich aber stark. Nützlicher als ein einzelnes gutes Wort ist ein fester Satz aus vier Wörtern aus vier verschiedenen Bereichen.`,
  },
  {
    q: `Wie werde ich besser bei Kontexto?`,
    a: `Beginne mit vier breiten Startwörtern aus vier verschiedenen Bereichen und spiele sie jeden Tag gleich ab, dann kostet der Einstieg keine Denkzeit. Werte danach zuerst die schlechten Ränge aus, denn ein Wort auf Rang 8000 schließt ein ganzes Feld sicher aus, während ein guter Rang nur eine Richtung andeutet. Miss anschließend Richtungen statt Synonyme, zwei Wörter aus demselben Feld liefern kaum neue Information. Wenn sich dein bester Rang nach fünf gezielten Zügen im selben Feld nicht verbessert, wechsle das Feld, statt weiter zu verfeinern.`,
  },
  {
    q: `Kann das Lösungswort ein Verb oder Adjektiv sein?`,
    a: `Ja. Das Lösungswort ist immer ein deutsches Inhaltswort in Grundform, und dazu zählen Verben im Infinitiv und unflektierte Adjektive. „laufen“, „kalt“ und „hell“ sind ganz normale Lösungen. Wer nur Substantive probiert, verschenkt einen großen Teil des Suchraums und wundert sich, warum die Ränge nicht kleiner werden. Ein praktischer Hinweis: Wenn deine besten Ränge alle Substantive aus einem Feld sind und trotzdem bei 300 stehen bleiben, ist die Lösung oft das Verb oder das Adjektiv, das zu genau diesem Feld gehört.`,
  },
  {
    q: `Können Eigennamen die Lösung sein?`,
    a: `Nein. Vornamen, Nachnamen, Städte, Länder und Marken sind als Lösung gesperrt, weil die Bedeutungsnachbarschaft eines Namens überwiegend aus anderen Namen besteht. An so ein Ziel kann man sich nicht herantasten, man kennt es oder nicht, und das widerspricht dem Prinzip des Spiels. Die Sperre läuft über automatische Filter und zusätzlich über Sperrlisten, die von Hand gepflegt werden. Als Tipp darfst du Namen weiterhin eingeben, sie bekommen ganz normal einen Rang. Fällt dir doch ein Name als Tageslösung auf, ist das ein Fehler und über die Kontaktseite meldbar.`,
  },
  {
    q: `Wie funktioniert der Tipp und was bedeuten die Schwierigkeitsgrade?`,
    a: `Alle drei Stufen rechnen mit deinem bisher besten Rang. „Leicht“ halbiert ihn, du bekommst also ein Wort ungefähr auf halbem Weg. „Mittel“ liefert das Wort direkt vor deinem besten und bringt dich damit nur einen Schritt weiter. „Schwer“ zieht eine Zufallszahl zwischen 2 und deinem besten Rang, das Ergebnis kann also nah oder weit sein. Die Lösung selbst wird nie als Tipp ausgegeben, und bereits geratene Wörter werden übersprungen. Solange du noch gar nichts geraten hast, greift der Tipp weit hinten und ist entsprechend wenig wert.`,
  },
  {
    q: `Warum liegt ein Gegenteil manchmal ganz vorne?`,
    a: `Weil das Modell misst, in welchen Zusammenhängen Wörter vorkommen, und nicht, ob sie dasselbe bedeuten. „heiß“ und „kalt“ stehen in praktisch identischen Sätzen, beide vor „Wasser“, „Wetter“ und „Getränk“, also liegen ihre Vektoren nah beieinander. Ein sehr guter Rang heißt deshalb „im richtigen Bedeutungsfeld“, nicht „inhaltlich zutreffend“. Das ist keine Schwäche, sondern die Eigenschaft, die das Spiel überhaupt trägt: Sie erlaubt es, sich einem Ziel über verwandte Begriffe zu nähern. Praktisch heißt das, bei einem weit vorn liegenden Gegenteil die andere Seite desselben Paars zu probieren.`,
  },
  {
    q: `Warum sehe ich keinen Prozentwert wie bei Semantle?`,
    a: `Weil ein roher Ähnlichkeitswert nicht einzuordnen ist. Bei Worteinbettungen liegen fast alle sinnvollen Wortpaare in einem schmalen Band, und zwischen 0,41 und 0,48 kann der Unterschied zwischen „daneben“ und „unmittelbar davor“ liegen. Ein Rang ist dagegen relativ: Er sagt, wie viele Wörter näher am Ziel liegen, und diese Zahl ist ohne Vorwissen lesbar. Rang 312 ist erkennbar besser als Rang 4000, während sich 43,2 gegen 41,8 Prozent nach nichts anfühlt. Die Ränge entstehen ohnehin aus der Kosinus-Ähnlichkeit, sie sind also dieselbe Information in lesbarer Form.`,
  },
  {
    q: `Kann ich Kontexto mit Freunden spielen?`,
    a: `Ja, in zwei Varianten. Im Duell rät jeder für sich am selben geheimen Wort und sieht vom Gegenüber nur den besten Rang und die Zahl der Versuche, nie die geratenen Wörter. Im Koop teilen sich alle Beteiligten eine gemeinsame Rateliste, jeder Zug ist sofort bei allen sichtbar. Beides läuft über einen geteilten Link, ohne Konto und ohne Installation, die Stände werden live übertragen. Für Wördle gibt es das Duell ebenfalls. Wer den Raum verlässt, kommt über denselben Link zurück, solange die Partie läuft.`,
  },
  {
    q: `Werden meine eingegebenen Wörter gespeichert?`,
    a: `Deine Rateliste liegt lokal in deinem Browser. An den Server geht nur das einzelne Wort, um seinen Rang nachzuschlagen, und dieser Aufruf wird nicht personenbezogen gespeichert. Für die Reichweitenmessung werden ausschließlich anonymisierte Summen geführt, etwa wie viele Rateversuche insgesamt stattgefunden haben. Eine wiedererkennbare Kennung entsteht dabei nicht: Die Besucherschätzung läuft über einen nicht umkehrbaren Fingerabdruck in einer HyperLogLog-Struktur, Rohereignisse werden nach 35 Tagen gelöscht. Cookies für Werbung und Statistik werden erst nach deiner Einwilligung gesetzt.`,
  },
];

/**
 * Die sechs Kernfragen fuer die Startseite, in eigenen Kurzfassungen.
 *
 * Absichtlich KEINE Teilmenge von `faqs`: Die Fragen lauten gleich, die
 * Antworten sind neu geschrieben. Nur so bleiben / und /faq/ zwei Seiten mit
 * eigenem Wert statt einer Seite und ihrer Kopie. Wer hier etwas aendert, darf
 * den Text nicht aus `faqs` uebernehmen, sonst schlaegt der Duplikatswaechter
 * in scripts/seo-check.mjs an.
 */
export const homeFaqs: Faq[] = [
  {
    q: `Was ist Kontexto?`,
    a: `Ein Wortratespiel, bei dem du das geheime Wort des Tages über Bedeutungsnähe findest. Jeder Tipp bekommt eine Platzziffer, die Eins gehört dem gesuchten Wort. Ohne Anmeldung, ohne Kosten.`,
  },
  {
    q: `Was bedeuten die Farben?`,
    a: `Grün markiert die Plätze 1 bis 300, gelb die Plätze 301 bis 1500, rot alles darüber. Sie fassen nur zusammen, was die Zahl daneben ohnehin sagt.`,
  },
  {
    q: `Wie viele Versuche habe ich?`,
    a: `So viele du möchtest. Es gibt kein Limit und keine Uhr. Auch ein schlechter Platz hilft weiter, weil er ein ganzes Themenfeld ausschließt.`,
  },
  {
    q: `Wann gibt es ein neues Wort?`,
    a: `Täglich um Mitternacht. Bis dahin suchen alle dasselbe Wort, und ein angefangenes Rätsel bleibt den ganzen Tag über offen.`,
  },
  {
    q: `Mein Wort wird nicht akzeptiert, warum?`,
    a: `Der Wortschatz umfasst rund 80.000 Einträge. Fehlt deiner, hilft meist die Grundform oder ein geläufigeres Wort. Eigennamen fehlen absichtlich.`,
  },
  {
    q: `Ist Kontexto kostenlos? Gibt es Werbung?`,
    a: `Das Spiel kostet nichts. Anzeigen laufen nur auf den beiden Spielseiten, Werbe-Cookies erst nach deiner Zustimmung, die du jederzeit zurücknehmen kannst.`,
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

/**
 * Thematische Gliederung der vollstaendigen FAQ fuer /faq/.
 *
 * Ohne Gliederung ist eine Liste aus 23 Aufklappern nicht scanbar, und genau
 * das wertet Google unter "nutzerfreundlich" ab. Die Zuordnung laeuft ueber den
 * Fragetext statt ueber Indizes, damit ein Umsortieren von `faqs` sie nicht
 * still zerreisst: Eine unbekannte Frage bricht den Build, eine vergessene
 * faellt im Test auf.
 */
const FAQ_GROUP_DEFS: { id: string; title: string; questions: string[] }[] = [
  {
    id: "spielprinzip",
    title: "Spielprinzip und Regeln",
    questions: [
      `Was ist Kontexto?`,
      `Wann gibt es ein neues Wort?`,
      `Was bedeuten die Farben?`,
      `Wie viele Versuche habe ich?`,
      `Wie funktioniert der Tipp und was bedeuten die Schwierigkeitsgrade?`,
    ],
  },
  {
    id: "technik",
    title: "Technik hinter den Rängen",
    questions: [
      `Wie wird die Ähnlichkeit berechnet?`,
      `Warum liegt ein Gegenteil manchmal ganz vorne?`,
      `Warum sehe ich keinen Prozentwert wie bei Semantle?`,
    ],
  },
  {
    id: "woerter",
    title: "Wörter, Lösungen und Strategie",
    questions: [
      `Mein Wort wird nicht akzeptiert, warum?`,
      `Welche Wörter eignen sich als Startwort?`,
      `Wie werde ich besser bei Kontexto?`,
      `Kann das Lösungswort ein Verb oder Adjektiv sein?`,
      `Können Eigennamen die Lösung sein?`,
    ],
  },
  {
    id: "geraete",
    title: "Geräte, Spielstand und Mehrspieler",
    questions: [
      `Kann ich auf mehreren Geräten spielen?`,
      `Auf welchen Geräten kann ich Kontexto spielen?`,
      `Gibt es Kontexto als App?`,
      `Kann ich frühere Wörter nachspielen?`,
      `Kann ich Kontexto mit Freunden spielen?`,
    ],
  },
  {
    id: "abgrenzung",
    title: "Unterschiede zu anderen Wortspielen",
    questions: [
      `Was ist der Unterschied zwischen Kontexto und Wordle?`,
      `Was ist der Unterschied zwischen Kontexto und Contexto?`,
      `Worin unterscheidet sich Kontexto von Semantle?`,
    ],
  },
  {
    id: "daten",
    title: "Werbung und Daten",
    questions: [
      `Ist Kontexto kostenlos? Gibt es Werbung?`,
      `Werden meine eingegebenen Wörter gespeichert?`,
    ],
  },
];

export interface FaqGroup {
  id: string;
  title: string;
  items: Faq[];
}

export const faqGroups: FaqGroup[] = FAQ_GROUP_DEFS.map((g) => ({
  id: g.id,
  title: g.title,
  items: g.questions.map((q) => {
    const hit = faqs.find((f) => f.q === q);
    if (!hit) throw new Error(`faqGroups: Frage nicht in faqs gefunden: ${q}`);
    return hit;
  }),
}));
