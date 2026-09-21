# Mitmachen

Danke, dass du dir das ansiehst. Kontexto ist ein Ein-Personen-Projekt, das
öffentlich entwickelt wird. Fehlerberichte, Wortlistenkorrekturen und kleine,
begründete Änderungen sind willkommen.

## Bevor du anfängst

Mach für alles, was mehr ist als ein Tippfehler, zuerst ein Issue auf. Das
kostet dich fünf Minuten und dich womöglich einen ganzen Nachmittag weniger:
einige Dinge, die naheliegend aussehen, sind bewusst so gebaut, wie sie sind,
und die Begründung steht oft im Kommentar daneben oder in `docs/plans/`.

## Aufsetzen

Voraussetzungen sind **Node ≥ 24 mit pnpm** und **Python 3.12**. Die
Schnellstartbefehle stehen in der [README](README.md). Für fast jede
Änderung reicht der Mock-Datensatz, du musst das fastText-Modell nicht
herunterladen:

```bash
python scripts/create-test-data.py --output data-e2e
```

## Was laufen muss, bevor du eine Änderung abgibst

Aus `frontend/`:

```bash
pnpm build          # Typprüfung und statischer Export, die eigentliche Autorität
pnpm test
pnpm seo:check
pnpm verify:slop --all
pnpm verify:dashes
```

Aus `backend/`, wenn du Python angefasst hast:

```bash
pytest
```

Dazu `pnpm test:e2e`, sobald `app/layout.tsx`, ein Spielclient oder sonst etwas
am Seitenaufbau betroffen ist. Der Aufbau dafür steht in der README.

`pnpm lint` benutzt du nicht: ESLint 10 verträgt sich nicht mit
eslint-plugin-react 7.x und stürzt projektweit ab, egal was du geändert hast.

## Sprache

Die Regel klingt umständlich, ist aber genau eine Zeile: **Code und interne
Dokumente sind Englisch, Nutzersichtbares ist Deutsch.**

Englisch sind also Bezeichner, Kommentare, Docstrings, Typen, Logausgaben,
Testnamen, Commit-Nachrichten, Pläne und alles unter `docs/`. Deutsch sind die
Oberflächentexte, Fehlermeldungen für Spieler, Blogbeiträge und diese Datei.
Eine Datei voller deutscher Kommentare ist Altbestand, kein Vorbild.

## Stil

**Commits** folgen Conventional Commits, so wie es die Historie zeigt:
`feat(pool): …`, `fix(solo): …`, `docs: …`. Eine Zeile, die sagt, was sich
ändert, keine, die sagt, welche Dateien du angefasst hast.

**Oberfläche** wird aus dem Designsystem gebaut, nicht daneben: die Typostufen
`text-micro` bis `text-display`, die Farbfamilien aus `app/globals.css`, das
`Panel` als einzige Karte. Rohe Tailwind-Stufen wie `bg-green-500` gehören
nicht mehr in `app/` oder `components/`. `pnpm verify:slop` prüft das
Gegenteil: kein Verlauf als Füllung, kein farbiger Schatten, kein
`transition-all`, kein `<div onClick>` ohne Tastaturzugang, kein `any`, keine
unbelegte Kennzahl.

Wenn eines dieser Muster an einer Stelle trotzdem richtig ist, schreib den
Grund daneben:

```tsx
// slop-ok: M8 Der Schatten trägt hier die Ebene, weil das Overlay keine Kante hat.
```

Ohne Begründung von mindestens acht Zeichen zählt der Kommentar nicht.
Die Regel ist gewollt: Slop ist das Fehlen einer Entscheidung, also prüft das
Skript nicht das Muster, sondern ob eine Entscheidung danebensteht.

**Kein Geviertstrich**, nirgends, auch nicht im Commit. Statt seiner ein Komma
oder ein Satzende. `pnpm verify:dashes` prüft das im ganzen Repo.

## Ein paar Dinge, die du wissen solltest, bevor du sie änderst

- **Das Frontend wird ohne laufendes Backend gebaut** (erste Docker-Stufe).
  Füg also keine Abrufe zur Bauzeit hinzu. Brauchst du Daten im Build, erzeuge
  sie aus den Dateien in `data/`.
- **Hintergrundschleifen laufen nur im WS-Worker.** Jeder Schreibvorgang muss
  idempotent sein, weil mehrere Prozesse dieselbe SQLite-Datei beschreiben.
- **Zählbare Werte kommen nie vom Client.** Nur Verteilungen tun das, und die
  sind tokengebunden, botgefiltert und dedupliziert.
- **`shadcn add` bringt `transition-all` zurück** und `--overwrite` macht
  bewusste Änderungen an `components/ui/` still rückgängig. Nach einem
  `shadcn add` also `pnpm verify:slop --all` und ein Blick in
  `git diff components/ui/`.

## Lizenz deiner Änderung

Das Projekt steht unter der [Functional Source License 1.1 mit Apache-2.0 als
Folgelizenz](LICENSE). Wenn du einen Pull Request aufmachst, gibst du deine
Änderung unter genau diesen Bedingungen ab, einschließlich der automatischen
Umwandlung in Apache-2.0 zwei Jahre nach der jeweiligen Veröffentlichung. Ein
gesondertes Contributor-Agreement gibt es nicht.
