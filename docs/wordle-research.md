# Wordle - Umfassende Analyse des Originalspiels

## Inhaltsverzeichnis

1. [Geschichte & Hintergrund](#1-geschichte--hintergrund)
2. [Spielregeln & Mechaniken](#2-spielregeln--mechaniken)
3. [Farbgebungs-Algorithmus (Duplikate)](#3-farbgebungs-algorithmus-duplikate)
4. [UI/UX Design](#4-uiux-design)
5. [Animationen](#5-animationen)
6. [Hard Mode](#6-hard-mode)
7. [Statistiken & Streaks](#7-statistiken--streaks)
8. [Teilen-Funktion](#8-teilen-funktion)
9. [WordleBot (NYT Analyse-Tool)](#9-wordlebot-nyt-analyse-tool)
10. [Multiplayer / Duell-Modi](#10-multiplayer--duell-modi)
11. [Deutsche Wordle-Varianten](#11-deutsche-wordle-varianten)
12. [Technische Implementierungsdetails](#12-technische-implementierungsdetails)
13. [Bekannte Wordle-Ableger](#13-bekannte-wordle-ableger)
14. [Open-Source-Referenz: Hugo0/wordle (Wordle Global)](#14-open-source-referenz-hugo0wordle-wordle-global)

---

## 1. Geschichte & Hintergrund

### Entstehung
- **Erfinder**: Josh Wardle, ein walisischer Software-Ingenieur
- **Erster Prototyp**: 2013, ursprünglich "Mr. Bugs' Wordy Nugz" genannt
- **Inspiration**: Das Brettspiel Mastermind (Farbcode-Ratespiel)
- **Ursprüngliche Wortliste**: 13.000 englische Fünf-Buchstaben-Wörter, von seiner Partnerin Palak Shah auf ca. 2.000 bekannte Wörter gefiltert
- **Fertigstellung**: 2014, dann aber auf Eis gelegt

### Comeback & Viraler Erfolg
- **COVID-Pandemie**: Wardle griff das Projekt wieder auf, inspiriert durch NYT Spelling Bee
- **Öffentlicher Launch**: Oktober 2021
- **Wachstum**:
  - November 2021: 90 Spieler
  - 2. Januar 2022: >300.000 Spieler
  - Eine Woche später: >2 Millionen wöchentliche Spieler
  - Zwischen 1.-13. Januar 2022: ~1,2 Millionen geteilte Ergebnisse auf Twitter
- **Viraler Mechanismus**: Die Emoji-basierte Teilen-Funktion (ohne Spoiler!)

### NYT-Übernahme
- **31. Januar 2022**: New York Times kauft Wordle für einen "niedrigen siebenstelligen Betrag"
- **10. Februar 2022**: Migration auf die NYT-Website, Neuaufbau in React
- **Weiterhin kostenlos** spielbar

### Kulturelle Bedeutung
- 2022: Meistgesuchter Begriff bei Google weltweit
- 2023: 4,8 Milliarden Spiele gespielt
- 7 der 10 meistgesuchten Wortdefinitionen 2022 waren Wordle-Lösungen
- **350+ dokumentierte Sprachadaptionen** bis Februar 2022

---

## 2. Spielregeln & Mechaniken

### Grundregeln
- Errate ein **5-Buchstaben-Wort** in **6 Versuchen** oder weniger
- Jeder Versuch muss ein **gültiges Wort** aus dem akzeptierten Wörterbuch sein
- **Ein Rätsel pro Tag**, Reset um Mitternacht (lokale Zeitzone)
- Alle Spieler weltweit lösen **dasselbe Wort** am selben Tag
- Lösungen sind **niemals Pluralformen**

### Farbcodiertes Feedback
Nach jedem Versuch erhält jeder Buchstabe eine Farbe:
- **Grün** (🟩): Buchstabe ist im Wort UND an der richtigen Position
- **Gelb** (🟨): Buchstabe ist im Wort, aber an der FALSCHEN Position
- **Grau** (⬛): Buchstabe ist NICHT im Wort

### Zwei Wörterbücher
1. **Lösungsliste**: 2.309 Wörter (ursprünglich 2.315; 6 von NYT entfernt wegen anstößiger/veralteter Begriffe). Nur diese Wörter können die Tages-Lösung sein. Kuratiert: bekannte, gebräuchliche Wörter.
2. **Gültige Rateliste**: ~10.657 zusätzliche Wörter, die als Versuche akzeptiert werden, aber nie die Lösung sind. Gesamt: ~12.966 gültige Wörter.
3. Nur 36 Wordle-Lösungen enden auf "S", keine davon ist ein Plural.

### Tages-Wort-Auswahl
- **Tracy Bennett** wurde im November 2022 Wordles dedizierte Redakteurin
- Sie wählt täglich Wörter aus der kuratierten 2.309-Wort-Liste
- Prüft auf Profanität, abwertende Bedeutungen und kulturelle Sensibilität
- Thematische Ausrichtung an bedeutende Daten (z.B. "MEDAL" für Veterans Day, "FEAST" für Thanksgiving)

---

## 3. Farbgebungs-Algorithmus (Duplikate)

Dies ist einer der wichtigsten technischen Details. Der Algorithmus verwendet ein **Zwei-Pass-System**:

### Pass 1: Grüne Treffer (Exakte Position)
```
Für jede Position i (0-4):
  Wenn guess[i] === target[i]:
    Markiere als GRÜN
    "Verbrauche" diesen Buchstaben aus dem Zielwort (setze auf null)
```

### Pass 2: Gelbe Treffer (Falsche Position)
```
Für jede verbleibende (nicht-grüne) Position i:
  Wenn guess[i] in den verbleibenden (nicht-verbrauchten) Zielbuchstaben:
    Markiere als GELB
    Verbrauche diesen Zielbuchstaben
  Sonst:
    Markiere als GRAU
```

### Schlüsselregeln für Duplikate
- Enthält ein Versuch 2x den Buchstaben "E", das Zielwort aber nur 1x "E":
  - Ist ein E an der richtigen Position → dieses E ist grün, das andere grau
  - Ist kein E an der richtigen Position → ein E ist gelb, das andere grau (typischerweise das linkeste unverbrauchte wird gelb)
- **Grün hat immer Vorrang** vor Gelb
- Die Anzahl gefärbter (grün + gelb) Instanzen eines Buchstabens übersteigt **nie** die tatsächliche Anzahl dieses Buchstabens im Zielwort

### Konkretes Beispiel (Zielwort: ABBEY)
- Versuch mit doppeltem "B": Das korrekt positionierte B wird grün, das falsch positionierte B wird gelb
- Versuch mit doppeltem "E": Ein E wird gelb (falsche Position), das überschüssige E wird grau

### Pseudocode-Implementierung
```typescript
type Letter = string | null; // null = verbraucht

function evaluate(guess: string, target: string): Color[] {
  const result: Color[] = new Array(5).fill('GRAY');
  const targetLetters: Letter[] = [...target];

  // Pass 1: Grüne Treffer
  for (let i = 0; i < 5; i++) {
    if (guess[i] === targetLetters[i]) {
      result[i] = 'GREEN';
      targetLetters[i] = null; // verbraucht
    }
  }

  // Pass 2: Gelbe Treffer
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'GREEN') continue;
    const idx = targetLetters.indexOf(guess[i]);
    if (idx !== -1) {
      result[i] = 'YELLOW';
      targetLetters[idx] = null; // verbraucht
    }
  }

  return result;
}
```

---

## 4. UI/UX Design

### Gesamtlayout
```
┌─────────────────────────────────────┐
│  ☰  ?         WORDLE        📊  ⚙️  │  ← Header
├─────────────────────────────────────┤
│                                     │
│         ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
│         │ │ │ │ │ │ │ │ │ │      │  ← Reihe 1 (Versuch 1)
│         └─┘ └─┘ └─┘ └─┘ └─┘      │
│         ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
│         │ │ │ │ │ │ │ │ │ │      │  ← Reihe 2 (Versuch 2)
│         └─┘ └─┘ └─┘ └─┘ └─┘      │
│         ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
│         │ │ │ │ │ │ │ │ │ │      │  ← Reihe 3 (Versuch 3)
│         └─┘ └─┘ └─┘ └─┘ └─┘      │
│         ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
│         │ │ │ │ │ │ │ │ │ │      │  ← Reihe 4 (Versuch 4)
│         └─┘ └─┘ └─┘ └─┘ └─┘      │
│         ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
│         │ │ │ │ │ │ │ │ │ │      │  ← Reihe 5 (Versuch 5)
│         └─┘ └─┘ └─┘ └─┘ └─┘      │
│         ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
│         │ │ │ │ │ │ │ │ │ │      │  ← Reihe 6 (Versuch 6)
│         └─┘ └─┘ └─┘ └─┘ └─┘      │
│                                     │
│  ┌───┬───┬───┬───┬───┬───┬───┐    │
│  │ Q │ W │ E │ R │ T │ Z │ U │... │  ← Virtuelle Tastatur
│  ├───┼───┼───┼───┼───┼───┼───┤    │
│  │ A │ S │ D │ F │ G │ H │ J │... │
│  ├───┼───┼───┼───┼───┼───┼───┤    │
│  │ENT│ Y │ X │ C │ V │ B │ N │⌫  │
│  └───┴───┴───┴───┴───┴───┴───┘    │
└─────────────────────────────────────┘
```

### Spielfeld (Grid)
- **5 Spalten x 6 Reihen** quadratischer Kacheln
- Jede Reihe = ein Rateversuch
- Jede Kachel = ein Buchstabe
- Kacheln starten leer, füllen sich beim Tippen

### Kachel-Zustände
1. **Leer**: Standard, ungefüllter Zustand
2. **Gefüllt (ausstehend)**: Buchstabe eingetippt, aber Reihe noch nicht abgeschickt - zeigt Buchstabe mit Rahmen aber ohne Farbe
3. **Ausgewertet**: Grüner, gelber oder grauer Hintergrund nach Auswertung

### Virtuelle Tastatur
- Volles QWERTY-Layout unterhalb des Spielfelds (für Deutsch: QWERTZ)
- Drei Reihen Buchstaben-Tasten plus ENTER und BACKSPACE (⌫)
- Tasten aktualisieren Farbe basierend auf bestem bekannten Zustand:
  - **Grün**: Buchstabe in korrekter Position bestätigt
  - **Gelb**: Buchstabe im Wort bestätigt, Position unbekannt
  - **Grau**: Buchstabe nicht im Wort bestätigt
  - **Standard/ungefärbt**: Buchstabe noch nicht geraten
- **Farbpriorität**: Grün > Gelb > Grau (nie herabstufen)
- Unterstützt SOWOHL physische Tastatur ALS AUCH On-Screen-Klicks

### Header-Leiste
- Spieltitel "Wordle" zentriert
- Links: Hamburger-Menü / Hilfe-Icon (Fragezeichen) für "How to Play"
- Rechts: Statistik-Icon (Balkendiagramm), Einstellungen-Icon (Zahnrad)

### Einstellungen
Drei Toggle-Schalter:
1. **Hard Mode**: Ein/Aus (nur vor dem ersten Versuch aktivierbar)
2. **Dark Theme**: Wechsel zu schwarzem Hintergrund
3. **High Contrast Mode** (Farbenblind-Modus): Ersetzt Grün durch **Orange** und Gelb durch **Hellblau**

### Dark Mode
- Hintergrund wird schwarz/sehr dunkelgrau
- Kachel-Rahmen und Text werden heller
- Farben bleiben grün/gelb/grau, wirken aber lebhafter auf dunklem Hintergrund
- Tastatur-Tasten werden dunkel mit hellem Text

---

## 5. Animationen

### 1. Kachel-Pop beim Tippen
Wenn ein Buchstabe eingegeben wird, skaliert die Kachel kurz hoch (bounce):
```css
@keyframes pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.1); }
  100% { transform: scale(1); }
}
/* Dauer: ~100ms */
```

### 2. Kachel-Flip bei Auswertung (Kernanimation!)
Nach dem Absenden flippen die Kacheln nacheinander (links → rechts) mit gestaffelter Verzögerung:
```css
@keyframes flip {
  0%   { transform: rotateX(0deg); }
  50%  { transform: rotateX(-90deg); }  /* Kachel auf Kante, unsichtbar */
  100% { transform: rotateX(0deg); }    /* Zurück mit neuer Farbe */
}
/* Farbwechsel bei 50% (wenn Kachel unsichtbar) */
/* Verzögerung: Kachel[i] hat delay von i * 300ms */
/* Gesamtdauer pro Kachel: ~500ms */
```
- 3D-Rotation entlang der X-Achse
- Buchstabe auf beiden Seiten sichtbar
- Rückseite enthüllt die Farbe (grün/gelb/grau)
- Sequenzielles Aufdecken baut Spannung auf

### 3. Reihen-Schütteln bei ungültigem Wort
Wenn das Wort nicht im Wörterbuch ist, wackelt die gesamte Reihe horizontal:
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}
/* Dauer: ~600ms */
/* Begleitet von Toast-Nachricht: "Not in word list" */
```

### 4. Gewinn-Bounce
Bei korrektem Wort springen die Kacheln der Gewinnerreihe nacheinander nach oben:
```css
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-30px); }
}
/* Gestaffelte Verzögerung pro Kachel */
/* Beginnt nach Abschluss der Flip-Animation */
```

### 5. Toast-Benachrichtigungen
- Kurze Pop-up-Nachrichten für Fehler:
  - "Not enough letters" (weniger als 5 Buchstaben)
  - "Not in word list" (ungültiges Wort)
  - Anzeige der Lösung bei Verlust
- Erscheinen oben mittig, verschwinden nach ~2 Sekunden
- Sanftes Einblenden und Ausblenden

---

## 6. Hard Mode

### Regeln
- Jeder als **grün** enthüllte Buchstabe MUSS in allen folgenden Versuchen an derselben Position verwendet werden
- Jeder als **gelb** enthüllte Buchstabe MUSS in allen folgenden Versuchen irgendwo enthalten sein
- Graue Buchstaben haben KEINE Einschränkung (können weiterhin verwendet werden)
- Bei Verstoß wird der Versuch abgelehnt mit Nachricht (z.B. "2nd letter must be R")

### Aktivierung
- Toggle in den Einstellungen
- Kann NUR VOR dem ersten Versuch aktiviert werden
- Bleibt für das aktuelle Spiel aktiv

### Strategische Auswirkung
- Eliminiert die Strategie, "Wegwerf-Versuche" zu nutzen, um neue Buchstaben zu testen
- Erhöht die Rolle des Glücks bei Wörtern mit vielen möglichen Endungen
- Hard-Mode-Spiele werden mit Sternchen (*) in der Teilen-Notation markiert

---

## 7. Statistiken & Streaks

### Statistik-Modal
Zugriff über das Balkendiagramm-Icon im Header:

1. **Gespielt**: Gesamtanzahl abgeschlossener Spiele
2. **Gewinn-%**: (Gewonnene Spiele / Gespielte Spiele) × 100
3. **Aktuelle Serie**: Aufeinanderfolgende Siege (resets bei Verlust ODER ausgelassenem Tag)
4. **Max Serie**: Höchste jemals erreichte Siegesserie
5. **Verteilung der Versuche**: Balkendiagramm - wie viele Spiele in 1, 2, 3, 4, 5 oder 6 Versuchen gelöst. Balken des letzten Spiels grün hervorgehoben.

### Streak-Regeln
- Serie erhöht sich um 1 bei jedem aufeinanderfolgenden Sieg
- **Verlust** setzt aktuelle Serie auf 0 zurück
- **Tag auslassen** (gar nicht spielen) setzt ebenfalls zurück
- Max Serie bewahrt den höchsten jemals erreichten Wert

### Datenspeicherung
- Ursprünglich in Browser-localStorage
- Nach NYT-Übernahme: optionaler NYT-Account-Login für geräteübergreifende Synchronisation

### Globale Durchschnittswerte (2026)
- Durchschnittliche Versuche: 3,80
- Häufigster Wert: 4 Versuche (34,60%), dann 3 Versuche (31,76%)

---

## 8. Teilen-Funktion

### Format
```
Wordle [Rätselnummer] [Versuche]/6[*]

[Emoji-Grid]
```

### Beispiel
```
Wordle 210 4/6

⬛⬛🟨⬛⬛
⬛🟩⬛⬛🟨
🟩🟩⬛🟩🟩
🟩🟩🟩🟩🟩
```

### Verwendete Emoji-Zeichen
| Zustand | Light Mode | Dark Mode | High Contrast |
|---------|-----------|-----------|---------------|
| Korrekt | 🟩 (U+1F7E9) | 🟩 (U+1F7E9) | 🟧 (U+1F7E7) |
| Falsche Pos. | 🟨 (U+1F7E8) | 🟨 (U+1F7E8) | 🟦 (U+1F7E6) |
| Nicht im Wort | ⬜ (U+2B1C) | ⬛ (U+2B1B) | ⬛ (U+2B1B) |

### Funktionsweise
- Nach Sieg (oder Verlust) erscheint "Share"-Button
- Klick kopiert formatierten Text in die Zwischenablage
- Spieler teilt auf Social Media, Messaging-Apps, etc.
- **Spoilerfrei**: Keine Buchstaben sichtbar, nur Farbmuster
- Dies war der Schlüsselmechanismus für die virale Verbreitung

### Hard Mode Notation
Sternchen wird angehängt: `Wordle 1.063 4/6*`

---

## 9. WordleBot (NYT Analyse-Tool)

- **Launch**: 7. April 2022 von der New York Times
- **Voraussetzung**: NYT Games, News oder All Access Abo ($1.50/Woche oder $50/Jahr)
- **Bewertung** nach Abschluss eines Spiels auf zwei Skalen (0-99):
  - **Skill**: Wurden die erwarteten Züge minimiert?
  - **Luck**: Haben die Versuche mehr Lösungen eliminiert als erwartet?
- Zeigt Analyse jedes Versuchs mit vorgeschlagenen Alternativen
- **Empfohlene Startwörter** (Stand 2024): "TRACE" (Normal), "TROPE" (Hard Mode)

---

## 10. Multiplayer / Duell-Modi

### Übersicht existierender Plattformen

#### Wordl.games Duel Mode
- Beide Spieler erhalten dasselbe Geheimwort und rasen um die Wette
- Gewinner: weniger Versuche, bei Gleichstand schnellere Zeit
- Zufälliges Matchmaking ODER private Spielcodes für Freunde
- Elo-artiges Ratingsystem mit Liga-Stufen (Bronze bis Diamant)
- Matches dauern nur wenige Minuten

#### Wordle Duels (wordleduels.com)
- Einzelspieler (vs. Computer) und Multiplayer
- Punkte-basiertes Leaderboard-System
- Spieler-Accounts mit persönlichen Statistiken

#### Build Wordle Multiplayer
- 2-10 Spieler pro Raum
- Gegner-Fortschritt sichtbar (zeigt, wenn jemand nah an der Lösung ist, ohne Versuche zu verraten)
- Anpassbare Einstellungen: Runden, Zeitlimits, Raum-Privatsphäre

#### Victordle
- Duell-Modus: Wettrennen gegen Uhr und Gegner
- Gegner-Fortschritt in Echtzeit auf der Seite sichtbar

### Discord-Integration

#### Offizielle Wordle Discord Activity
- **Lizenziert von der New York Times**
- Echtzeit-Fortschritt für Freunde im Channel sichtbar
- Tägliche Zusammenfassung der gestrigen Ergebnisse im Channel
- Live-Channel-Embed zeigt aktive Spiele

#### Wordplay Bot
- Einzel- und Mehrspielermodi mit mehreren Sprachen
- Im Multiplayer: alle raten dasselbe Wort
- Ergebnisse automatisch im Channel gepostet
- Statistiken und Leaderboards

### Gemeinsame Duell-Mechaniken
- Beide Spieler bekommen das **gleiche Zielwort**
- Wettrennen: weniger Versuche oder schnellere Zeit gewinnt
- **Echtzeit-Gegner-Fortschritt sichtbar** (typischerweise Grid-Füllstand ohne Buchstaben zu verraten)
- Leaderboards und Ranking-Systeme
- Schnelle Sessions (2-5 Minuten pro Duell)

### Arten der Fortschrittsanzeige im Duell

| Typ | Beschreibung | Beispiel |
|-----|-------------|---------|
| **Grid-Silhouette** | Zeigt gefüllte/leere Reihen ohne Farben oder Buchstaben | ████_ / _____ |
| **Farbige Reihen** | Zeigt Farbmuster ohne Buchstaben | 🟩🟨⬛⬛🟨 |
| **Nur Zähler** | Zeigt nur Anzahl Versuche und besten Rang | "3 Versuche, Rang 5" |
| **Voller Einblick** | Zeigt alles inkl. Buchstaben (selten, nur bei kooperativen Modi) | S_A_E → 🟩⬛🟩⬛🟩 |

---

## 11. Deutsche Wordle-Varianten

### 6mal5 (6mal5.com) - Populärste deutsche Variante
- Name: "6 mal 5" (6 Versuche, 5 Buchstaben)
- Neues Rätsel täglich um 01:00 Uhr deutscher Zeit
- **Umlaut-Behandlung**: Ä→AE, Ö→OE, Ü→UE, ß→SS
- Nur Grundformen und Singular-Nomen als Lösungen
- Statistiken: Spiele, Gewinn-%, aktuelle/längste Serie
- Teilen als Emoji-Grid
- Kein Hard Mode oder Dark Mode

### Wordle Deutsch (wordledeutsch.org) - Unbegrenzte Version
- **Unbegrenzte Spiele** pro Tag
- Umlaut-Substitution: Ä→AE, Ö→OE, Ü→UE, ß→SS
- Dark Mode Toggle
- Hard Mode Option
- **Farbenblind-Modus** mit Orange und Blau
- Backspace-Taste
- Statistiken mit Teilen-Optionen
- Wordle-Archiv für vergangene Rätsel

### Wortle (wortle.dev) - Open Source
- Fork von hannahcode/wordle
- **Tech Stack**: React, TypeScript, Tailwind CSS
- MIT-lizenziert
- TypeScript: 96,1% des Codes
- Auf GitHub verfügbar (bakoe/wortle)

### Gemeinsame Anpassungen aller deutschen Varianten
- **Umlaute** werden durch Zwei-Buchstaben-Äquivalente ersetzt (Ä→AE, Ö→OE, Ü→UE)
- **ß** wird typischerweise durch SS ersetzt
- Wortlisten fokussieren auf gebräuchliche deutsche Nomen in Grund-/Singularform
- Gleiches 5×6 Grid und Farbcodierungssystem wie das Original
- Die meisten bieten Tages-Rätsel-Modus

### Herausforderungen der deutschen Sprache
- Deutsche Wörter sind im Schnitt länger als englische
- Viele zusammengesetzte Wörter (Komposita)
- Umlaute und ß erfordern Sonderbehandlung
- Konjugations- und Deklinationsformen verkomplizieren die Wortliste
- Geringere Anzahl gebräuchlicher 5-Buchstaben-Wörter

---

## 12. Technische Implementierungsdetails

### Komponentenhierarchie (React-basiert)
```
App/Game (Top-Level State Manager)
├── Header (Titel, Einstellungen, Statistiken, Hilfe)
├── Board/Grid (5×6 Grid-Container)
│   └── Row (eine pro Versuch, 6 gesamt)
│       └── Cell/Tile (eine pro Buchstabe, 5 pro Reihe)
├── Keyboard (Virtuelle QWERTZ-Tastatur)
│   └── Key (einzelne Buchstaben-/Aktions-Buttons)
├── Modal (Statistiken, Hilfe, Einstellungen)
└── Toast (temporäre Benachrichtigungen)
```

### State Management (React Hooks/Context)
```typescript
// Kern-Zustand
currentGuess: string           // Das aktuell eingetippte Wort
guesses: string[]              // Array abgesendeter Versuche
evaluations: Color[][]         // Farbergebnisse pro Versuch (GREEN/YELLOW/GRAY pro Buchstabe)
turn: number                   // Aktuelle Reihe (0-5)
gameStatus: 'playing' | 'won' | 'lost'
solution: string               // Das Zielwort

// Tastatur-Zustand
letterStates: Map<string, Color>  // Buchstabe → beste bekannte Farbe

// Statistiken
statistics: {
  played: number
  winPct: number
  currentStreak: number
  maxStreak: number
  distribution: number[]  // Index 0-5 = Versuche 1-6
}
```

### Tastatur-State-Management
```typescript
// Nach jedem Versuch aktualisieren:
for (const [i, letter] of guess.entries()) {
  const currentState = letterStates.get(letter);
  const newState = evaluations[turn][i];

  // Nur aufwerten, nie herabstufen
  if (newState === 'GREEN') {
    letterStates.set(letter, 'GREEN');
  } else if (newState === 'YELLOW' && currentState !== 'GREEN') {
    letterStates.set(letter, 'YELLOW');
  } else if (newState === 'GRAY' && !currentState) {
    letterStates.set(letter, 'GRAY');
  }
}
```

### Wort-Validierung
1. Spieler gibt 5 Buchstaben ein
2. Bei Absenden: Prüfe ob String im kombinierten Wörterbuch (Lösungen + gültige Versuche) existiert
3. **Nicht gefunden**: "Not in word list" Toast + Schüttel-Animation; verbraucht KEINEN Versuch
4. **Gefunden**: Farben auswerten und zur nächsten Reihe vorrücken

### Datenspeicherung
- `localStorage` für Spielzustand, Statistiken und Einstellungen
- NYT-Version: optionaler Account-basierter Cloud-Sync

### CSS-Variablen für Theming
```css
/* Light Mode */
--color-correct: #6aaa64;    /* Grün */
--color-present: #c9b458;    /* Gelb */
--color-absent: #787c7e;     /* Grau */
--tile-border: #d3d6da;
--key-bg: #d3d6da;

/* Dark Mode */
--color-correct: #538d4e;
--color-present: #b59f3b;
--color-absent: #3a3a3c;
--tile-border: #3a3a3c;
--key-bg: #818384;

/* High Contrast */
--color-correct: #f5793a;    /* Orange */
--color-present: #85c0f9;    /* Blau */
--color-absent: #787c7e;     /* Grau (unverändert) */
```

---

## 13. Bekannte Wordle-Ableger

| Name | Beschreibung |
|------|-------------|
| **Absurdle** | Adversarielle Version: Zielwort ändert sich nach jedem Versuch |
| **Semantle** | Semantische Ähnlichkeit statt Buchstaben |
| **Worldle** | Geographische Silhouetten-Identifikation |
| **Heardle** | Musik-Identifikation (von Spotify gekauft, Juli 2022) |
| **Quordle** | Vier Rätsel gleichzeitig lösen (von Merriam-Webster gekauft, Jan 2023) |
| **Poeltl** | NBA-Spieler raten |
| **Termo** | Brasilianisch-portugiesische Adaption (100.000 tägliche Spieler in 10 Tagen) |
| **Hasbro "Wordle: The Party Game"** | Physisches Brettspiel für 2-4 Spieler (Oktober 2022) |
| **Kontexto** | Semantisches Wörterraten mit FastText-Embeddings (dieses Projekt!) |

---

## 14. Open-Source-Referenz: Hugo0/wordle (Wordle Global)

### Überblick
- **Repository**: https://github.com/Hugo0/wordle
- **Live**: wordle.global
- **Tech Stack**: Vue 3 + Nuxt 3 + Tailwind CSS v4 + Pinia + Vite
- **Sprachen**: 79 Sprachen unterstützt (inkl. Deutsch)
- **Spielmodi**: Classic (täglich), Unlimited, Speed Streak, Dordle (2 Boards), Tridle (3), Quordle (4), Semantic Explorer
- **Stats**: 68 Stars, 43 Forks, 534 Commits

### Lizenz: PolyForm Noncommercial 1.0.0
- **Nicht-kommerziell**: Persönliche, bildungsbezogene, Forschungs- und Hobby-Projekte erlaubt
- **Kommerziell**: Schriftliche Genehmigung von Hugo Montenegro erforderlich
- Distribution mit Attribution erlaubt
- Änderungen und abgeleitete Werke für nicht-kommerzielle Zwecke erlaubt

### Deutsche Wortliste (`data/languages/de/words.json`)
3.9 MB große, kuratierte Wortliste mit folgender Struktur pro Eintrag:
```json
{
  "word": "kraft",
  "length": 5,
  "tier": "daily",        // "daily" = Lösungswort, "valid" = gültiger Versuch, "blocked" = gesperrt
  "frequency": 4.52,      // Zipf-Score (1.0-6.0) via wordfreq
  "difficulty": 0.35,     // 0.0-1.0
  "sources": ["frequencywords", "hunspell"],
  "flags": [],            // optional: "foreign", "profanity", "proper_noun"
  "llm": {                // optional: KI-Kuratierung
    "tier": "daily",
    "confidence": 4,
    "reason": "Geläufiges deutsches Substantiv"
  },
  "history": [42, 156],   // Tage, an denen das Wort Lösung war
  "reviewed": true
}
```

**Tier-Verteilung**:
- `daily`: Bekannte, gebräuchliche Wörter → werden als Tages-Lösung verwendet
- `valid`: Akzeptierte Versuche, aber nie die Lösung
- `blocked`: Abgelehnte Wörter (Profanität, Eigennamen, etc.)

### Deutsche Wort-Definitionen (`data/definitions/de.json`)
5.621 Einträge mit deutschen Definitionen:
```json
{
  "aalen": "sich ausstrecken, faulenzen",
  "kraft": "Stärke, Energie, physische Leistungsfähigkeit",
  ...
}
```

### Umlaut-Handling via Diacritic Map
Definiert in `data/languages/de/language_config.json`:
```json
{
  "diacritic_map": {
    "a": ["ae"],
    "o": ["oe"],
    "u": ["ue"],
    "s": ["ss"]
  }
}
```

**Implementierung** (`utils/diacritics.ts`):
1. `buildNormalizeMap()` - Erstellt Reverse-Lookup (ae→a, oe→o, etc.)
2. `normalizeChar()` - Konvertiert diakritische Zeichen zu Basisbuchstaben
3. `charsMatch()` - Vergleicht Zeichen mit diakritischer Äquivalenz (tippe `a`, matcht `ae`)
4. `buildNormalizedWordMap()` - Bei identischer Normalisierung wird die akzentuierte Form bevorzugt

**Design-Entscheidung**: Umlaute werden als *Varianten* der Basisbuchstaben behandelt, NICHT als eigenständige Buchstaben. Alternative Implementierungen (z.B. `caco3/wordle-de`) behandeln Umlaute als völlig separate Zeichen.

### Deutsche Tastatur-Layouts (`data/languages/de/de_keyboard.json`)
**Zwei Layouts verfügbar**:

1. **`german_qwertz`** - Volle Tastatur mit Ä, Ö, Ü, ß:
```
Q W E R T Z U I O P Ü
A S D F G H J K L Ö Ä
  ENTER Y X C V B N M ß ⌫
```

2. **`simple_qwertz`** (Standard) - Ohne Sonderzeichen:
```
Q W E R T Z U I O P
A S D F G H J K L
  ENTER Y X C V B N M ⌫
```

### Komplette deutsche UI-Übersetzungen
Alles in `language_config.json`:
- Spielanweisungen, Einstellungen, Statistik-Labels
- Fehlermeldungen ("Nicht im Wörterbuch", "Nicht genug Buchstaben")
- Modal-Texte (Hilfe, Statistiken, Einstellungen)
- Spielmodus-Beschreibungen

### Farbgebungs-Algorithmus (`utils/game/colorAlgorithm.ts`)
Standardmäßiger Zwei-Pass-Algorithmus:
1. **Pass 1**: Grüne Treffer (exakte Position) → Buchstabe verbraucht
2. **Pass 2**: Gelbe Treffer (falsche Position) → Buchstabe verbraucht
3. Rest wird grau

Besonderheit: Berücksichtigt Graphem-Cluster und diakritische Äquivalenz beim Vergleich.

### Wort-Pipeline (`scripts/word_pipeline/`)
Python-basierte Pipeline zur Wortlisten-Kuratierung:
- `source.py` - Wörter aus FrequencyWords, Hunspell, Leipzig Corpora holen
- `normalize.py` - Kleinschreibung, Deduplizierung, Längenfixierung
- `score.py` - Zipf-Frequenz-Bewertung via wordfreq
- `curate.py` - Profanitäts-/Eigennamen-Filter, Community-Overrides

### Weitere relevante Dateien
| Datei | Beschreibung |
|-------|-------------|
| `utils/graphemes.ts` | Graphem-Cluster-Splitting (Intl.Segmenter) |
| `composables/useSounds.ts` | Sound-Effekte |
| `composables/useHaptics.ts` | Haptisches Feedback (mobil) |
| `utils/game/useGameAnimations.ts` | Tile-Animationen |
| `server/utils/word-selection.ts` | Tageswort-Algorithmus (SHA-256 Consistent Hashing) |

### Alternative Open-Source-Projekte (permissivere Lizenzen)

| Projekt | Lizenz | Beschreibung |
|---------|--------|-------------|
| **caco3/wordle-de** | MIT | JavaScript/PHP, Umlaute als eigenständige Zeichen, `target-words.json` + `other-words.json`, Quellen: Wikipedia.de, OpenThesaurus.de |
| **wordle-helper/words** | Apache-2.0 | Deutsche Wortliste speziell für Wordle |
| **hoffmann2109/germanWordle** | - | Deutsche Wordle-Adaption |
| **bakoe/wortle** | MIT | React + TypeScript + Tailwind CSS, 96% TypeScript |

---

## Quellen

- NYT Wordle Hilfeseite: https://help.nytimes.com/24611727334932-Wordle
- NYT "How to Talk About Wordle": https://www.nytimes.com/2023/08/01/crosswords/how-to-talk-about-wordle.html
- NYT "Best Wordle Tips": https://www.nytimes.com/2022/02/10/crosswords/best-wordle-tips.html
- Wikipedia: Wordle (https://en.wikipedia.org/wiki/Wordle)
- 6mal5.com (deutsche Variante)
- wordledeutsch.org (deutsche Variante)
- wortle.dev / GitHub bakoe/wortle (Open Source, deutsch)
- Verschiedene Wordle-Multiplayer-Plattformen (wordl.games, wordleduels.com, victordle, etc.)
- Discord Wordle Activity und Bot-Dokumentationen
- Hugo0/wordle (Wordle Global): https://github.com/Hugo0/wordle
- caco3/wordle-de: https://github.com/caco3/wordle-de
- wordle-helper/words: https://github.com/wordle-helper/words
