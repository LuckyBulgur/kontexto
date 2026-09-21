# Sicherheitslücken melden

## Bitte nicht als Issue

Ein öffentliches Issue macht die Lücke bekannt, bevor sie zu ist. Nimm einen
dieser beiden Wege:

- **GitHub, privat:** Reiter „Security", dann „Report a vulnerability". Der
  Bericht geht direkt und nicht öffentlich an den Betreiber.
- **E-Mail:** `info@kontexto.de`, dieselbe Adresse wie im
  [Impressum](https://kontexto.de/impressum).

Ein Bericht ist am nützlichsten, wenn er die betroffene URL oder Datei nennt,
beschreibt, was passiert, und sagt, was du erwartet hättest. Ein
Reproduktionspfad ist Gold wert, ein fertiger Exploit nicht nötig.

## Was du erwarten kannst

Kontexto ist ein Ein-Personen-Projekt ohne Bereitschaftsdienst. Eine erste
Antwort kommt normalerweise innerhalb von drei Werktagen. Es gibt kein
Bug-Bounty, aber auf Wunsch eine Nennung, sobald die Sache behoben ist.

Es gibt genau einen unterstützten Stand: das, was gerade auf kontexto.de läuft,
also der Kopf von `master`. Ältere Stände werden nicht nachgepflegt.

## Was im Rahmen ist

- kontexto.de und die API darunter
- der Quelltext in diesem Repository
- der Auslieferungsweg: Docker-Image, nginx, Caddy, der Deploy-Workflow

Nicht im Rahmen sind Berichte, die sich allein auf fehlende Header ohne
belegbare Auswirkung stützen, Ergebnisse automatischer Scanner ohne
nachvollziehbaren Angriff, Lastspitzen und Denial of Service sowie Probleme in
Diensten Dritter (AdSense, das Impressum-Adressbüro).

Wenn du testest: keine Lasttests, keine fremden Konten, keine Daten anderer
Leute. Ein einzelner Nachweis reicht.

## Was schon eingebaut ist

Damit du nichts doppelt untersuchst:

- **Admin.** `/admin` hängt an einem einzigen WebAuthn-Passkey. Die
  Registrierung ist im Normalbetrieb ausgeschaltet und nur über eine
  Notfallvariable zu öffnen. Die Sitzung ist ein HMAC-signiertes Token;
  Bruteforce wird pro IP im Speicher und global in der Datenbank begrenzt.
- **Geheimnisse.** Alle HMACs (Fingerabdrucksalz, Beacon-Token,
  Sitzungstoken) hängen an einem Serverschlüssel, der in der Produktion
  vorhanden sein muss, sonst startet der Server nicht.
- **Zählbares kommt vom Server.** Der Client kann Spielzahlen nicht setzen.
  Nur die Abschlusshistogramme kommen von ihm, und die sind tokengebunden,
  botgefiltert und dedupliziert.
- **Personenbezug.** Es gibt keine Konten und keine Cookies. Die
  Besucherkennung ist ein nicht umkehrbarer Hash aus IP, User-Agent und einem
  monatlich wechselnden Salz, der nur in HyperLogLog-Skizzen landet.
  Rohereignisse werden nach 35 Tagen gelöscht.
- **Freier Text.** Der einzige freie Text ist der Nickname. Er läuft an jeder
  Tür durch denselben Filter, auch über Einladungslinks und die
  Zufallssuche.
