# Wördle - Deutsches Wordle Design-Dokument

## Zusammenfassung

Deutsches Wordle-Spiel ("Wördle") als neues Spiel auf der bestehenden Kontexto-Plattform. Tägliches 5-Buchstaben-Wörterraten in 6 Versuchen mit farbcodiertem Feedback. Inklusive Duell-Modus mit Echtzeit-Gegner-Fortschritt (farbige Reihen ohne Buchstaben). Moderne UI mit Flip-, Pop-, Shake- und Bounce-Animationen.

## Entscheidungen

| Thema | Entscheidung |
|-------|-------------|
| Umlaute | Keine - nur Wörter ohne Ä/Ö/Ü/ß |
| Integration | Eigene Route `/wordle` |
| Spielmodus | Täglich (ein Wort pro Tag) |
| Duell-Fortschritt | Farbige Reihen ohne Buchstaben |
| Hard Mode | Ja, als Toggle in Einstellungen |
| Lizenz | Nicht-kommerziell, Hugo0/wordle Wortliste (PolyForm Noncommercial) |
| Farbenblind-Modus | Nein |
| Duell-Start | Link teilen (wie bestehender Kontexto-Duell) |
| Tastatur | QWERTZ |
| Architektur | Eigenständiges Backend-Modul, geteilte Infrastruktur |

---

## 1. Datenmodell & Wortliste

### Wortliste

- **Quelle**: Hugo0/wordle `data/languages/de/words.json` (PolyForm Noncommercial 1.0.0)
- **Filter**: `len(word) == 5` und nur Zeichen a-z (filtert automatisch Umlaut-Substitutionen wie "boerde"/"suelze" aus, da diese 6+ Zeichen haben)
- **Zwei Listen**:
  - `solutions.json`: Wörter mit `tier: "daily"` - bekannte, gebräuchliche Wörter die als Tages-Lösung kommen können
  - `valid_words.json`: Wörter mit `tier: "valid"` - akzeptierte Versuche die nie Lösung sind
- **Format**: Einfache JSON-Arrays
- **Build**: Einmaliges Script extrahiert und filtert aus Hugo0-Daten

### Tageswort-Algorithmus

```
game_number = (today - epoch_date).days
solution = solutions[game_number % len(solutions)]
```

- Epoch: Fester Starttag (Launch-Datum)
- Deterministisch: alle Spieler bekommen dasselbe Wort
- Lösungsliste beim Build in gute Reihenfolge gebracht (Frequenz/Schwierigkeit variierend)

### Datenbank-Tabellen (SQLite)

```sql
wordle_duels (
  id TEXT PRIMARY KEY,
  game_number INTEGER,
  created_by TEXT,
  created_at TIMESTAMP,
  last_activity TIMESTAMP
)

wordle_duel_players (
  id INTEGER PRIMARY KEY,
  duel_id TEXT REFERENCES wordle_duels(id),
  nickname TEXT,
  player_token TEXT UNIQUE,
  guesses_used INTEGER DEFAULT 0,
  solved BOOLEAN DEFAULT FALSE,
  connected BOOLEAN DEFAULT FALSE
)

wordle_duel_guesses (
  id INTEGER PRIMARY KEY,
  duel_id TEXT REFERENCES wordle_duels(id),
  player_token TEXT,
  word TEXT,
  result TEXT,    -- JSON: ["GREEN","YELLOW","GRAY","GRAY","GREEN"]
  guessed_at TIMESTAMP
)
```

### Einzelspieler-Persistenz

Kein serverseitiger State. Alles in `localStorage`:
- Spielzustand (Versuche, Auswertungen, Spielnummer)
- Statistiken & Streaks
- Einstellungen (Hard Mode)

---

## 2. API-Endpunkte

### Einzelspieler

```
POST /api/wordle/guess
  Body: {
    "word": "halle",
    "game_number": 42,
    "hard_mode": true,
    "previous": [
      { "word": "stern", "result": ["GRAY","GRAY","GRAY","GRAY","GRAY"] }
    ]
  }
  Response: { "valid": true, "result": ["GREEN","GRAY","YELLOW","GRAY","GRAY"] }
  Fehler:   { "valid": false, "error": "not_in_word_list" }
            { "valid": false, "error": "hard_mode_violation", "message": "Position 1 muss 'S' sein" }

GET /api/wordle/game
  Response: { "game_number": 42 }

GET /api/wordle/reveal?game_number=42
  Response: { "word": "halle" }
  // Nur fuer vergangene Spiele (game_number < today). Heutiges Spiel wird nicht enthüllt.
```

Auswertung passiert serverseitig - das Lösungswort wird nie an den Client geschickt bis das Spiel vorbei ist.

### Duell

```
POST /api/wordle/duel
  Body: { "nickname": "Max", "game_number": 42 }
  Response: { "duel_id": "abc123", "player_token": "tok_xyz" }

POST /api/wordle/duel/{duel_id}/join
  Body: { "nickname": "Anna" }
  Response: { "player_token": "tok_abc", "players": [...], "game_number": 42 }

POST /api/wordle/duel/{duel_id}/guess
  Body: { "word": "halle", "player_token": "tok_xyz" }
  Response: { "valid": true, "result": ["GREEN","GRAY","YELLOW","GRAY","GRAY"] }
  // Kein Hard Mode im Duell - Duell ist casual, serverseitiger State-Tracking waere noetig

GET /api/wordle/duel/{duel_id}/history?token=tok_xyz
  Response: { "guesses": [{ "word": "stern", "result": [...], "guessed_at": "..." }, ...] }

GET /api/wordle/duel/{duel_id}
  Response: { "game_number": 42, "players": [{ "nickname": "Max", "guesses_used": 3, "solved": false, "connected": true }] }
```

### WebSocket

```
WS /ws/wordle/duel/{duel_id}?token={player_token}

Nachrichten:
{ "type": "state", "players": [...] }
{ "type": "player_joined", "nickname": "Anna" }
{ "type": "guess_made", "nickname": "Max", "guess_number": 3, "result": ["GREEN","GRAY","YELLOW","GRAY","GRAY"] }
{ "type": "player_solved", "nickname": "Max", "guesses_used": 4 }
{ "type": "player_failed", "nickname": "Max" }
{ "type": "player_disconnected", "nickname": "Max" }
{ "type": "player_reconnected", "nickname": "Max" }
```

`guess_made` sendet Farb-Ergebnis des Gegners aber NICHT das geratene Wort.

---

## 3. Frontend-Architektur

### Routing

```
/wordle              -> Einzelspieler
/wordle/duel/create  -> Duell erstellen
/wordle/duel/[id]    -> Duell spielen/beitreten
```

### Komponentenstruktur

```
frontend/
  app/wordle/
    page.tsx                      # Einzelspieler-Seite
    duel/
      create/page.tsx             # Duell erstellen
      page.tsx                    # Duell spielen

  components/wordle/
    WordleGame.tsx                # Haupt-Spiellogik & State
    Board.tsx                     # 5x6 Grid-Container
    TileRow.tsx                   # Eine Reihe (5 Tiles)
    Tile.tsx                      # Einzelne Kachel
    Keyboard.tsx                  # Virtuelle QWERTZ-Tastatur
    Key.tsx                       # Einzelne Taste mit Farbzustand
    StatsModal.tsx                # Statistiken & Guess-Distribution
    HelpModal.tsx                 # Spielanleitung
    SettingsModal.tsx             # Hard Mode Toggle
    ShareButton.tsx               # Emoji-Grid kopieren
    duel/
      OpponentBoard.tsx           # Gegner-Grid (Farben ohne Buchstaben)
      DuelHeader.tsx              # Spieler-Uebersicht & Status
      DuelResultCard.tsx          # Duell-Ergebnis

  lib/
    wordle-api.ts                 # API-Client
    wordle-types.ts               # TypeScript-Typen
    wordle-storage.ts             # localStorage Management
    use-wordle-duel-ws.ts         # WebSocket-Hook
```

### State (WordleGame.tsx)

```typescript
currentGuess: string                                    // Aktuell getippt (0-5 Buchstaben)
guesses: string[]                                       // Abgesendete Versuche (max 6)
evaluations: ('GREEN' | 'YELLOW' | 'GRAY')[][]          // Farbergebnisse
gameStatus: 'playing' | 'won' | 'lost'
gameNumber: number
hardMode: boolean
letterStates: Map<string, 'green' | 'yellow' | 'gray'> // Tastatur-Farben
stats: { played, won, currentStreak, maxStreak, distribution, lastPlayed }
```

### Physische Tastatur

- `keydown`-Event-Listener auf `document`
- A-Z: Buchstabe einfuegen (wenn currentGuess.length < 5)
- Enter: Versuch absenden
- Backspace: Letzten Buchstaben loeschen
- Alle anderen Tasten: ignorieren

### Duell-Layout

```
Desktop:
+------------------------------------------+
|  DuelHeader: Spieler-Status & Verbindung |
+-------------------+----------------------+
|   Eigenes Board   |   Gegner-Board(s)    |
|   5x6 + Farben    |   5x6 nur Farben,    |
|   + Buchstaben    |   keine Buchstaben    |
+-------------------+----------------------+
|           Virtuelle Tastatur             |
+------------------------------------------+

Mobile: Gegner-Board(s) kompakter ueber dem eigenen Board
oder als ausklappbare Leiste.
```

---

## 4. Animationen

### Tile-Pop beim Tippen
- Scale 1 -> 1.1 -> 1 ueber ~100ms
- Triggert bei jedem eingegebenen Buchstaben

### Tile-Flip bei Auswertung (Kern-Animation)
- 3D-Rotation um X-Achse: 0deg -> -90deg -> 0deg
- Farbwechsel bei 50% (Kachel unsichtbar auf Kante)
- Gestaffelt: Kachel[i] startet nach i * 300ms
- Dauer pro Kachel: ~500ms
- Gesamtdauer pro Reihe: ~1.8s
- Benoetigt: `transform-style: preserve-3d`, `backface-visibility: hidden`

### Row-Shake bei ungueltigem Wort
- 5 Zyklen links-rechts (+-5px) ueber ~600ms
- Begleitet von Toast-Nachricht

### Win-Bounce
- Kacheln der Gewinnerreihe springen nacheinander hoch
- translateY(0 -> -30px -> 0) ueber ~400ms pro Kachel
- Gestaffelt: 100ms Versatz
- Startet NACH Abschluss der Flip-Animation
- Begleitet von Confetti (canvas-confetti)

### Toast-Nachrichten (Sonner)

| Ausloeser | Nachricht |
|-----------|-----------|
| < 5 Buchstaben | "Nicht genug Buchstaben" |
| Ungueltiges Wort | "Nicht im Woerterbuch" |
| Hard Mode Verstoss (Position) | "Buchstabe {X} muss an Position {N} sein" |
| Hard Mode Verstoss (enthalten) | "Buchstabe {X} muss enthalten sein" |
| Gewonnen (1 Versuch) | "Genial!" |
| Gewonnen (2 Versuche) | "Grossartig!" |
| Gewonnen (3 Versuche) | "Stark!" |
| Gewonnen (4 Versuche) | "Gut!" |
| Gewonnen (5 Versuche) | "Knapp!" |
| Gewonnen (6 Versuche) | "Gerade so!" |
| Verloren | Zeigt Loesungswort |

### Duell-spezifisch
- Gegner-Versuch: Reihe fuellt sich mit Fade-In (~200ms)
- Gegner loest: Highlight auf Board + Toast "{Name} hat geloest in {N} Versuchen!"
- Gegner scheitert: Toast "{Name} hat nicht geloest"

---

## 5. Teilen & Statistiken

### Teilen-Format (Einzelspieler)

```
Woerdle 42 4/6

(schwarz)(schwarz)(gelb)(schwarz)(schwarz)
(schwarz)(gruen)(schwarz)(schwarz)(gelb)
(gruen)(gruen)(schwarz)(gruen)(gruen)
(gruen)(gruen)(gruen)(gruen)(gruen)

woerdle.kontexto.de
```

- Hard Mode: Sternchen -> `Woerdle 42 4/6*`
- Verloren: `Woerdle 42 X/6`
- Dark Mode: schwarze Quadrate fuer Grau. Light Mode: weisse Quadrate.
- Button kopiert in Zwischenablage + Toast "Kopiert!"

### Teilen-Format (Duell)

```
Woerdle Duell 42

Max: (gruen) 4/6
Anna: (rot-x) X/6

woerdle.kontexto.de
```

### Statistiken (localStorage)

```typescript
{
  played: number,
  won: number,
  currentStreak: number,
  maxStreak: number,
  distribution: number[],  // Index 0-5 = Versuche 1-6
  lastPlayed: number       // Letzte gespielte Tagesnummer
}
```

### Streak-Logik
- Sieg: `currentStreak++`, `maxStreak = max(maxStreak, currentStreak)`
- Verlust: `currentStreak = 0`
- Tag uebersprungen: `currentStreak = 0` (erkannt ueber `lastPlayed !== today - 1`)

### StatsModal
- Vier Zahlen: Gespielt, Gewinn-%, Aktuelle Serie, Max Serie
- Balkendiagramm der Versuchs-Verteilung (1-6)
- Letzter Versuch gruen hervorgehoben
- "Teilen"-Button
- Countdown bis Mitternacht (naechstes Wort)

---

## 6. Backend

### Modul `backend/wordle.py`

**Wortlisten**: Beim Start `solutions.json` und `valid_words.json` laden. Beides als `set` fuer O(1)-Lookup, Loesungen zusaetzlich als Array fuer Index-Zugriff.

**Farbgebungs-Algorithmus** (Zwei-Pass):

```python
def evaluate(guess: str, solution: str) -> list[str]:
    result = ["GRAY"] * 5
    solution_chars = list(solution)

    # Pass 1: Gruen (exakte Position)
    for i in range(5):
        if guess[i] == solution_chars[i]:
            result[i] = "GREEN"
            solution_chars[i] = None

    # Pass 2: Gelb (falsche Position)
    for i in range(5):
        if result[i] == "GREEN":
            continue
        if guess[i] in solution_chars:
            result[i] = "YELLOW"
            solution_chars[solution_chars.index(guess[i])] = None

    return result
```

**Hard-Mode-Validierung**:

```python
def validate_hard_mode(guess: str, previous: list) -> str | None:
    for prev_guess, prev_result in previous:
        for i, color in enumerate(prev_result):
            if color == "GREEN" and guess[i] != prev_guess[i]:
                return f"Position {i+1} muss '{prev_guess[i].upper()}' sein"
            if color == "YELLOW" and prev_guess[i] not in guess:
                return f"'{prev_guess[i].upper()}' muss enthalten sein"
    return None
```

Hard Mode: Client sendet bisherige Versuche mit (Einzelspieler ist stateless).

### Modul `backend/wordle_duel.py`

Analog zu `backend/duel.py`:
- `create_duel()` -> Insert in wordle_duels + wordle_duel_players
- `join_duel()` -> Spieler hinzufuegen, State zurueckgeben
- `record_guess()` -> Versuch speichern mit Farb-Ergebnis, guesses_used erhoehen, solved setzen
- `get_duel_state()` -> Alle Spieler mit Status
- `get_opponent_guesses()` -> Nur Farb-Ergebnisse ohne Woerter
- `cleanup_stale_duels()` -> Alte Duells loeschen wenn alle Spieler >1h disconnected (analog zu Kontexto)

### WebSocket-Erweiterung

Bestehenden `DuelConnectionManager` erweitern:
- `/ws/wordle/duel/{id}` -> Wordle-Duell
- `/ws/duel/{id}` -> Kontexto-Duell (unveraendert)
- Gleiche Polling-Logik, unterschiedliche Tabellen und Nachrichtentypen

### Daten-Vorbereitung

Script `scripts/prepare-wordle-data.py`:
1. Hugo0/wordle `words.json` einlesen
2. Filtern: len(word) == 5 und nur a-z Zeichen (keine Umlaute/Sonderzeichen)
3. Aufteilen: `tier: "daily"` -> `solutions.json`, `tier: "valid"` -> `valid_words.json`
4. Ablegen unter `/data/wordle/`

---

## 7. Navigation & Integration

### Header

```
+-------------------------------------------+
|  (menu) (?)   Kontexto | Woerdle   (stats) (gear) |
+-------------------------------------------+
```

- Beide Titel als klickbare Links
- Aktives Spiel visuell hervorgehoben (bold/unterstrichen)
- Auf Wordle-Routen: "Woerdle" aktiv, auf /-Routen: "Kontexto" aktiv

### Einstellungen

Getrennt pro Spiel:
- **Global**: Theme (Dark/Light) - geteilt
- **Wordle**: Hard Mode
- **Kontexto**: Schwierigkeit, Sortierung (unveraendert)

SettingsModal erkennt anhand der Route welche Optionen angezeigt werden.

### Duell-Erstellung

Separate Create-Seiten:
- `/duel/create` -> Kontexto-Duell (unveraendert)
- `/wordle/duel/create` -> Wordle-Duell

### Nginx-Routing

```nginx
# Bestehend (unveraendert)
/ws/         -> port 8001
/api/        -> port 8000
/duel/       -> /duel/index.html

# Neu
/wordle/     -> /wordle/index.html (SPA fallback)
/api/wordle/ -> port 8000 (selber FastAPI-Server)
/ws/wordle/  -> port 8001 (selber WS-Server)
```

### SEO

Eigene Metadata fuer `/wordle`:
- Title: "Woerdle - Taegliches deutsches Wordle"
- Description: "Errate das deutsche Wort in 6 Versuchen. Taeglich ein neues Raetsel."
- OG-Image: Eigenes Preview-Bild mit Wordle-Grid
