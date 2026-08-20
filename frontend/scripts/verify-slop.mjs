#!/usr/bin/env node
/**
 * verify-slop: statische Prüfung auf Gestaltungsmuster, die eine Oberfläche maschinell
 * gebaut aussehen lassen.
 *
 * Leitsatz, aus dem die ganze Datei folgt: **Slop ist das Fehlen einer Entscheidung.** Ein
 * Muster ist erst dann ein Befund, wenn es ein Default ist, den niemand gewählt hat. Dasselbe
 * Muster, bewusst gewählt und begründet, ist in Ordnung. Deshalb prüft dieses Werkzeug nicht
 * das Muster allein, sondern ob daneben eine Begründung steht:
 *
 *     // slop-ok: M8 Die Karte liegt auf einem dunklen Bild, ein shadow-sm verschwindet darauf
 *     <Card className="shadow-2xl">
 *
 * Ohne Begründungstext gilt der Kommentar nicht. Wer nichts zu schreiben hat, hat nichts
 * entschieden.
 *
 * WARUM DIE REGELN HIER STEHEN UND NICHT AUS EINEM FERTIGEN KATALOG KOMMEN
 *
 * Der Scanner von kill-ai-slop (github.com/yetone/kill-ai-slop), unverändert gegen dieses Repo
 * gelaufen, meldete 3.567 Treffer in 1.974 Dateien. Angeführt wurde die Liste von Mustern, die
 * dieses Projekt bewusst gewählt und dokumentiert hat: `rounded-full` ist hier jedes Badge,
 * `text-amber-*` die festgelegte Farbe für Überstunden, `rounded-xl` die definierte Kartenform.
 * Trefferquote rund 8 Prozent.
 *
 * Eine Prüfung mit dieser Quote wird binnen einer Woche abgeschaltet und schützt danach nichts.
 * Dieselbe Lehre steht im Kopf von `verify-ui.mjs` und in `metron-style` § R6. Die Regeln unten
 * sind deshalb gegen diesen Bestand kalibriert, in vier Runden, bei einer Trefferquote über
 * 95 Prozent. Die vergleichbare Teilmenge (M1 bis M9 über components und app) fiel dabei von
 * 3.567 auf 296; mit den beiden Regeln für messages sind es 500 Befunde im ganzen Repo.
 * Was dabei gelernt wurde, steht als Kommentar an der jeweiligen Regel, damit es beim
 * nächsten Ändern mitgelesen wird.
 *
 * Der vollständige Katalog für das menschliche Urteil liegt im Skill `augenmass`.
 *
 * ABWEICHUNGEN DIESER KOPIE GEGENÜBER metronHR
 *
 * kontexto hat kein `messages/`. Der nutzersichtbare Text steht direkt im TSX und im MDX-Blog
 * unter `content/blog/`. Daraus folgen vier Unterschiede, jeder an seiner Stelle kommentiert:
 *
 *   1. `SCAN_KANDIDATEN` kennt `content` und `types`, `SCANNED_EXT` kennt `mdx`.
 *   2. M10 (Emoji) und M20 (Gedankenstrich) greifen auch in `.mdx`. Ohne das liefe der
 *      groesste Textbestand des Projekts an beiden Regeln vorbei.
 *   3. Die Fix-Texte von M4b und M10 nennen keine Bausteine, die es hier nicht gibt
 *      (NoticeBanner, FontAwesome Pro). kontexto nutzt lucide-react und hat keine Hinweisbox.
 *   4. Die verbotenen Striche stehen als \u-Escape, nicht literal.
 *
 * `pruefeKennzahlen` sucht `messages/{de,en}/home.json` und ist hier folgerichtig wirkungslos.
 * Kennzahlen im Markup deckt M19 ab. Das bleibt absichtlich unverändert, damit die Datei beim
 * Abgleich mit den Schwesterprojekten vergleichbar bleibt.
 *
 * Aufruf: `pnpm verify:slop` (geänderte Dateien) | `--branch` | `--all`
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();

/**
 * Geprüft wird, was es gibt.
 *
 * Dieselbe Datei läuft in mehreren Projekten (metronHR, metronhr-www, metron-crm, kontexto).
 * Eine feste Liste hätte in jedem eine andere Zeile, und drei von vier Kopien wären nach der
 * ersten Regeländerung veraltet. Die Kandidaten werden deshalb gefiltert, statt gesetzt:
 * `messages/` gibt es nur in zweien, `lib/` trägt in einem die Farbtabellen, `content/` und
 * `types/` nur in kontexto, wo der Blog als MDX im Repo liegt.
 */
const SCAN_KANDIDATEN = [
  'components', 'app', 'src', 'messages', 'lib', 'hooks', 'content', 'types',
];
const SCAN_DIRS = SCAN_KANDIDATEN.filter((d) => existsSync(join(ROOT, d)));
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo', '.vercel',
  'playwright-report', 'test-results', '.visual-check', 'drizzle', '.astro',
]);
const SCANNED_EXT = /\.(tsx|ts|css|json|mdx)$/;

// Die verbotenen Striche stehen als \u-Escape, nicht literal. `pnpm verify:dashes` prüft in
// kontexto das ganze Repo, und mit den Zeichen im Klartext meldete diese Datei sich selbst.
// Dieselbe Begründung steht im Kopf von `verify-dashes.mjs`.
const GEVIERT = '\u2014';
const HORIZONTAL_BAR = '\u2015';
const HALBGEVIERT = '\u2013';

// ────────────────────────────────────────────────────────────────────────────
// Regeln
// ────────────────────────────────────────────────────────────────────────────

/**
 * Jede Regel: id, Schwere, Name, der Fix in einem Satz, und die Muster.
 *
 * `notIf`   Muster, die auf derselben Zeile den Treffer aufheben. Für Bauformen, die das
 *            Projekt dokumentiert führt.
 * `boxOnly` nur echte Container melden, kein beliebiges Klassenfragment.
 * `files`   Dateimuster, auf die die Regel überhaupt angewendet wird.
 */
export const RULES = [
  {
    id: 'M1',
    schwere: 'hoch',
    name: 'Dekor-Verlauf als Füllung',
    fix: 'flache Fläche aus einem Token; Tiefe über Haarlinie und Abstand',
    files: /\.(tsx|css)$/,
    // Ein Verlauf aus Tokens ist genauso ein Verlauf. Die erste Fassung prüfte nur rohe
    // Farbstufen und schwieg deshalb zu `from-primary to-brand` im Hilfe-Dialog, wo drei
    // Verläufe übereinander lagen. Ausgenommen bleibt der Verlauf nach `transparent`: eine
    // ausblendende Kante ist eine Maske, keine Füllung.
    notIf: [/to-transparent|from-transparent/],
    patterns: [
      /bg-gradient-to-[a-z]{1,2}[^"'`\n]{0,80}?from-(?:purple|pink|indigo|violet|fuchsia|rose|blue|sky|cyan|teal|emerald|green|lime|amber|orange|yellow|red)-\d+/i,
      /['"`]from-(?:purple|pink|indigo|violet|fuchsia|rose|blue|sky|cyan|teal|emerald|green|lime|amber|orange|yellow|red)-\d+\s+(?:via-[a-z]+-\d+\s+)?to-/i,
      /bg-gradient-to-[a-z]{1,2}[^"'`\n]{0,80}?from-(?:primary|brand|secondary|accent|card|muted|destructive|success|warning|info)\b/i,
    ],
  },
  {
    // Eine Tabelle, die N Farben auf dieselbe Form abbildet: `-100` Fläche, `-600` Icon,
    // `-200` Rahmen. Das ist die Standard-Semantikpalette aus der Taxonomie (Tell 04), und
    // sie ist genau dann Slop, wenn die Farbe nichts unterscheidet: vier Schritte einer
    // Abfolge in vier Bonbonfarben sind vier Farben ohne Aussage, denn die Reihenfolge steht
    // schon in den Pfeilen dazwischen.
    //
    // Gefunden im Hilfe-Dialog, wo M4a schwieg, weil dort `rounded-full` und `bg-blue-100`
    // nicht in derselben Zeile stehen, sondern in einer Konstante weit darüber. Trägt die
    // Farbe eine echte Unterscheidung (Status, Kategorie), steht die Begründung daneben.
    // Der Befund ist die TABELLE, nicht die einzelne Farbnutzung. Eine erste Fassung prüfte
    // jede Zeile mit zwei Klassen derselben Farbfamilie und meldete 463 Treffer, praktisch
    // alle davon Status-Badges, die `metron-style` § R1 ausdrücklich erlaubt. Genau die
    // Trefferquote, wegen der ein Werkzeug abgeschaltet wird.
    //
    // Geprüft wird deshalb der Eintrag einer Farbtabelle: ein Schlüssel, der selbst ein
    // Farbname ist, und daneben Klassen derselben Farbe. Das trifft `blue: { bg: 'bg-blue-100',
    // … }` und sonst fast nichts.
    id: 'M14',
    schwere: 'hoch',
    name: 'Farbtabelle ohne Bedeutung',
    fix: 'eine Farbe für alle, oder die Farbe an eine echte Unterscheidung binden (Status, Kategorie)',
    files: /\.(tsx|ts)$/,
    patterns: [
      /^\s*['"]?(blue|sky|cyan|teal|emerald|green|lime|amber|orange|yellow|red|rose|pink|fuchsia|purple|violet|indigo)['"]?\s*:\s*[{[][^\n]{0,160}?(?:bg|text|border)-\1-\d{2,3}/i,
    ],
  },
  {
    id: 'M2',
    schwere: 'hoch',
    name: 'Verlauf als Textfüllung',
    fix: 'volle Farbe; Hierarchie über Größe, Gewicht, Abstand',
    files: /\.(tsx|css)$/,
    patterns: [
      /bg-clip-text[\s\S]{0,60}?text-transparent|text-transparent[\s\S]{0,60}?bg-clip-text/,
      /-webkit-text-fill-color:\s*transparent/i,
    ],
  },
  {
    // Auch der getönte Glow um ein Icon zählt dazu: `drop-shadow-[0_0_15px_rgba(96,165,250,.3)]`
    // ist derselbe Gedanke wie ein farbiger Kartenschatten, nur eine Ebene tiefer. Gefunden
    // beim Bereinigen der Dashboard-Widgets, wo beides übereinander lag.
    id: 'M3',
    schwere: 'hoch',
    name: 'Farbiger Schatten',
    fix: 'Schatten bleibt farblos; ein getönter Schein ist keine Erhebung',
    files: /\.(tsx|css)$/,
    // Schwarz ist keine Farbe im Sinne dieser Regel: `rgba(0,0,0,0.35)` ist ein gewöhnlicher
    // Schatten. Gemeint ist der GETÖNTE Schein. Die erste Fassung nahm Schwarz nur bei der
    // CSS-Eigenschaft aus und meldete deshalb 23 saubere `drop-shadow-[0_1px_2px_rgba(0,0,0,…)]`
    // in der Marketing-Site. Tailwind schreibt Leerzeichen als Unterstrich, daher `[\s_]*`.
    patterns: [
      /shadow-(?:purple|violet|indigo|pink|fuchsia|blue|sky|cyan|teal|emerald|green|lime|amber|orange|yellow|red|rose)-\d+/i,
      /drop-shadow-\[[^\]]*rgba?\((?![\s_]*0[\s_]*,[\s_]*0[\s_]*,[\s_]*0)/i,
      /(?:box-|drop-)?shadow:[^;{}]*rgba?\(\s*(?!0\s*,\s*0\s*,\s*0)/i,
    ],
  },
  {
    // Der schwebende Farbklecks: ein Kreis in einer Akzentfarbe, weich gezeichnet, halb aus der
    // Karte herausgeschoben. Er trägt keine Information und ist der Griff, mit dem eine Fläche
    // „Tiefe" behaupten soll. hallmark führt ihn als Floating-orb decoration, kill-ai-slop als
    // Teil von Tell 06. In diesem Repo lag er in jedem der fünf Dashboard-Widgets, jeweils
    // zusätzlich zu einem Verlauf und einem farbigen Schatten.
    id: 'M12',
    schwere: 'hoch',
    name: 'Schwebender Farbklecks als Tiefe',
    fix: 'ersatzlos streichen; Tiefe kommt aus Haarlinie, Fläche und Abstand',
    files: /\.(tsx|css)$/,
    patterns: [
      /rounded-full[^"'`\n]{0,80}?\bblur-(?:xl|2xl|3xl)\b|\bblur-(?:xl|2xl|3xl)\b[^"'`\n]{0,80}?rounded-full/i,
    ],
  },
  {
    id: 'M4a',
    schwere: 'hoch',
    name: 'Icon-Kachel in roher Pastellstufe',
    fix: 'Icon erbt die Textfarbe; braucht es eine Fläche, dann ein Token',
    files: /\.(tsx|css)$/,
    // Dieselbe Freigabe wie bei M4b: ein `Badge` trägt seine Farbe als inhaltlichen Akzent,
    // und das erlaubt `metron-style` § R1-Allowlist ausdrücklich. Gemeint ist hier die
    // Icon-Kachel, also ein div oder span, das ein Icon in eine Pastellfläche setzt.
    notIf: [/\bBadge\b/],
    patterns: [
      /(?:p-\d|h-\d+\s+w-\d+)[^"'`\n]{0,40}?rounded-(?:md|lg|xl|2xl|full)[^"'`\n]{0,40}?bg-(?:blue|indigo|purple|violet|pink|green|emerald|teal|cyan|amber|orange|yellow|red|rose)-(?:50|100|200)\b/i,
      /rounded-(?:md|lg|xl|2xl|full)\s+bg-(?:blue|indigo|purple|violet|pink|green|emerald|teal|cyan|amber|orange|yellow|red|rose)-(?:50|100|200)\b/i,
    ],
  },
  {
    // Nur echte Container. Ein Status-Badge in rohen Skalenfarben ist nach
    // `metron-style` § R1-Allowlist ein inhaltlicher Akzent und ausdrücklich erlaubt.
    // Runde 2 der Kalibrierung meldete 105 Treffer, von denen die Mehrheit genau
    // solche Badges waren; mit `boxOnly` blieben 40, und die sind alle echt.
    id: 'M4b',
    schwere: 'mittel',
    name: 'Selbstgebaute Ein-Ton-Hinweisbox',
    fix: 'Fläche aus einem Token plus Haarlinie, statt Rahmen und Fläche im selben Farbton',
    files: /\.tsx$/,
    boxOnly: true,
    patterns: [
      /bg-(blue|amber|orange|yellow|green|emerald|red|rose)-(?:50|100)\b[^"'`\n]{0,60}?border-\1-(?:100|200|300)\b/i,
      /border-(blue|amber|orange|yellow|green|emerald|red|rose)-(?:100|200|300)\b[^"'`\n]{0,60}?bg-\1-(?:50|100)\b/i,
    ],
  },
  {
    // `transition-all` geht auch über `width`, `height` und `padding` und erzwingt
    // Layout-Arbeit bei jedem Hover. Es ist zugleich der Tell im Tell: jede Eigenschaft
    // zu animieren ist die Abwesenheit der Entscheidung, welche etwas bedeutet.
    id: 'M5',
    schwere: 'mittel',
    name: 'transition-all',
    fix: 'nur die Eigenschaft übergehen, die sich ändert: transition-colors, transition-shadow',
    files: /\.(tsx|css)$/,
    patterns: [/\btransition-all\b/],
  },
  {
    id: 'M6',
    schwere: 'hoch',
    name: 'Federnder Hover',
    fix: 'Hover ändert Fläche und Rahmen, nicht die Geometrie',
    files: /\.(tsx|css)$/,
    patterns: [/(?:group-)?hover:(?:scale-|-?translate-y-)/i, /\banimate-bounce\b/],
  },
  {
    // Overshoot sitzt im ZWEITEN oder VIERTEN Parameter, nicht nur im vierten. Runde 1
    // prüfte nur den vierten und fand deshalb null Treffer, obwohl `globals.css` drei
    // Kurven mit `cubic-bezier(0.34, 1.56, 0.64, 1)` führt.
    id: 'M7',
    schwere: 'mittel',
    name: 'Overshoot-Easing',
    fix: 'Standard-Ease; Federphysik nur für Dinge, die sich wirklich durch den Raum bewegen',
    files: /\.(tsx|css)$/,
    patterns: [
      /cubic-bezier\(\s*-?[\d.]+\s*,\s*(?:1\.\d|[2-9])[^)]*\)/,
      /cubic-bezier\([^)]*,\s*(?:1\.\d|[2-9])[\d.]*\s*\)/,
    ],
  },
  {
    id: 'M8',
    schwere: 'mittel',
    name: 'Kante und breiter Schatten zugleich',
    fix: 'entweder Kante oder Erhebung; shadow-2xl nur wo die Fläche wirklich schwebt',
    files: /\.(tsx|css)$/,
    patterns: [
      /\bshadow-2xl\b/,
      // `border` muss die Tailwind-Klasse sein, nicht ein Wortteil. Ohne die beiden
      // Ausschluesse trifft die Regel auch `transition-[...,border-color,...]`, und damit
      // ausgerechnet die Schreibweise, zu der sie andernorts raet.
      /(?<![-\w])border(?:-\d)?(?![-\w])[^"'`\n]{0,80}?\bshadow-xl\b|\bshadow-xl\b[^"'`\n]{0,80}?(?<![-\w])border(?:-\d)?(?![-\w])/,
    ],
  },
  {
    // Die kanonische Filterbar (`bg-card/60` + `backdrop-blur-sm`) und die Sticky-Kopfzeile
    // (`bg-background/95` + `supports-[backdrop-filter]`) sind dokumentierte Bausteine, keine
    // Glasdeko. Sie wiederholen sich identisch über rund zwanzig Seiten. Eine Deckschicht
    // (`absolute inset-0 z-*`, `sticky top-0`) verschleiert verdeckten Inhalt, dort ist der
    // Blur funktional. Ohne diese vier Ausnahmen meldete die Regel 58 statt 11 Treffer.
    id: 'M9',
    schwere: 'hoch',
    name: 'Glasfläche außerhalb eines Overlays',
    fix: 'deckende Fläche aus einem Token; Tiefe über Haarlinie',
    files: /\.(tsx|css)$/,
    notIf: [
      /bg-card\/60\b/,
      /bg-background\/9\d\b/,
      /supports-\[backdrop-filter\]/,
      /pointer-events-none/,
      /absolute\s+inset-0[^"'`\n]{0,40}z-\d/,
      /\bsticky\s+top-0\b/,
    ],
    patterns: [
      /backdrop-blur[^"'`\n]{0,60}?bg-(?:card|white|black|background)\/\d+/i,
      /bg-(?:card|white|black|background)\/\d+[^"'`\n]{0,60}?backdrop-blur/i,
    ],
  },
  {
    // Endlosbewegung ohne Anlass. Ein Element, das sich dauerhaft bewegt, ohne dass sich
    // etwas ändert, zieht Aufmerksamkeit ab und ist für Menschen mit vestibulärer
    // Empfindlichkeit unangenehm (WCAG 2.3.3). Gefunden, als der Nutzer die Tour-Dialoge
    // in Frage stellte: das Maskottchen wackelte alle vier Sekunden, dazu drei weitere
    // Endlosschleifen, und `prefers-reduced-motion` gab es im ganzen Projekt genau einmal.
    //
    // `animate-pulse` und `animate-spin` sind ausgenommen: das eine ist die Ladefläche,
    // das andere die Ladeanzeige, und beide tragen die Aussage "es passiert gerade etwas".
    // Der globale Block in globals.css beruhigt sie ohnehin, wenn das System danach fragt.
    id: 'M13',
    schwere: 'mittel',
    name: 'Endlosbewegung ohne Anlass',
    fix: 'Bewegung an ein Ereignis binden, oder streichen; trägt sie einen Zustand, gehört die Begründung daneben',
    files: /\.css$/,
    notIf: [/animate-(?:pulse|spin)/, /--tw-/],
    patterns: [/animation:[^;{}]*\binfinite\b/i],
  },
  {
    // Blur ohne Fläche dahinter: der Filter läuft, aber es gibt nichts zu verschleiern.
    // Reine GPU-Arbeit ohne sichtbares Ergebnis. Das Gegenstück zu M9, wo die Fläche da ist
    // und der Blur die Deko. Aus `blur-bg-only-decoration` von ux-skill übernommen.
    id: 'M15',
    schwere: 'mittel',
    name: 'Blur ohne Fläche dahinter',
    fix: 'entweder eine durchscheinende Fläche dazu (bg-card/60), oder den Blur streichen',
    files: /\.(tsx|css)$/,
    notIf: [/bg-(?:card|background|white|black|muted|popover|primary|foreground)\//, /supports-\[backdrop-filter\]/],
    patterns: [/\bbackdrop-blur(?:-(?:sm|md|lg|xl|2xl|3xl))?\b/],
  },
  {
    // Eine Fläche mit onClick, die kein Knopf ist. Für Maus da, für Tastatur und
    // Screenreader nicht (WCAG 2.1.1 und 4.1.2). Gehört hierher, weil es dasselbe Muster ist
    // wie der Rest des Katalogs: es SIEHT aus wie eine Schaltfläche und ist keine.
    // `accessibility.md` verbietet es bereits, geprüft wurde es bisher nicht.
    id: 'M16',
    schwere: 'hoch',
    name: 'Klickfläche ohne Tastaturzugang',
    fix: '<button> nehmen; muss es ein div bleiben, dann role="button", tabIndex und onKeyDown',
    files: /\.tsx$/,
    notIf: [/role=["']button["']/, /\brole=\{/, /tabIndex/, /onKeyDown/, /<(?:button|a|Button|Link)\b/],
    patterns: [/<div\b[^>]{0,400}?\sonClick=/],
  },
  {
    // TODO und FIXME im Produktivcode. Die globale PRIO-1-Regel des Nutzers verbietet
    // ausdrücklich „TODO-/FIXME-Platzhalter für später"; geprüft wurde es nie.
    // Beispiel- und Vorlagendateien sind ausgenommen, dort ist der Platzhalter der Inhalt.
    id: 'M17',
    schwere: 'mittel',
    name: 'Unerledigter Platzhalter im Code',
    fix: 'auflösen oder ins Ticketsystem verschieben; ein TODO im Code ist ein Versprechen ohne Termin',
    files: /\.(tsx|ts|css)$/,
    imKommentar: true,
    patterns: [/(?:\/\/|\/\*|\*)\s*(?:TODO|FIXME|HACK|XXX)\b/],
  },
  {
    // `as any` und `: any`. CLAUDE.md führt „NIEMALS any verwenden" als Kritische Regel 1,
    // und `typescript.md` sagt: es gibt KEINE legitimen Ausnahmen. Trotzdem stehen im
    // Bestand hunderte. Eine Regel ohne Prüfung ist eine Absichtserklärung.
    id: 'M18',
    schwere: 'hoch',
    name: 'Typ-Fluchtluke any',
    fix: 'unknown mit Type Guard, ein Generic oder ein konkreter Union-Typ (typescript.md)',
    files: /\.(tsx|ts)$/,
    notIf: [/eslint-disable/, /@ts-expect-error/],
    patterns: [/\bas\s+any\b/, /:\s*any\b(?!\w)/, /<any>/],
  },
  {
    // Kennzahlen, die direkt im Markup stehen statt in den Übersetzungsdateien. M11 sieht
    // nur `messages/`; auf der Marketing-Site steht `'99.9% SLA-Garantie'` als Literal im
    // TSX und lief deshalb durch.
    //
    // Verlangt wird ZAHL PLUS TEXT im selben Literal. Ohne diese Bedingung trifft die Regel
    // jedes `offset="0%"` und `width="220%"` in einem SVG, und davon hat allein die
    // Deutschlandkarte ein halbes Dutzend. Eine Zahl ohne Wort daneben ist eine Koordinate,
    // keine Behauptung.
    // Der lange Strich ist im Deutschen typografisch falsch und zugleich einer der
    // sichtbarsten Marker maschinell erzeugten Textes. Der Halbgeviertstrich ist als
    // Gedankenstrich korrekt, wird hier aber ebenfalls gemeldet: das ist eine
    // Projektentscheidung, kein Rechtschreibbefund (`core/no-em-dash.md`).
    //
    // Spannen bleiben: `10:00-12:00`, `Mo-Fr`, `S. 24-31`. Erkannt an dem, was links und
    // rechts steht, nicht am Zeichen selbst.
    //
    // Kommentare prüft die Regel nicht, weil `pruefeInhalt` sie ohnehin ausblendet. In
    // metronHR sind das 3.661 von 4.197 Vorkommen; die Regel meldet also den Text, nicht
    // die Erklärungen darüber.
    id: 'M20',
    schwere: 'mittel',
    name: 'Gedankenstrich',
    fix: 'Komma; trägt es den Satz nicht, wird umformuliert oder geteilt. Ein Bindestrich ist kein Ersatz',
    files: /\.(tsx|ts|json|mdx)$/,
    patterns: [
      new RegExp(`[${GEVIERT}${HORIZONTAL_BAR}]`),
      new RegExp(`(?<![\\d:]|Mo|Di|Mi|Do|Fr|Sa|So)\\s${HALBGEVIERT}\\s(?![\\d:])`),
    ],
  },
  {
    id: 'M19',
    schwere: 'hoch',
    name: 'Kennzahl im Markup ohne Beleg',
    fix: 'Beleg nach docs/marketing/claims.md, oder die Angabe entfernen; siehe Skill augenmass, claims.md',
    files: /\.tsx$/,
    // Ausgenommen: SVG-Attribute (eine Zahl ohne Wort ist eine Koordinate) und
    // Schwellwerte mit Präposition. „Gelb ab 80 %" beschreibt eine Funktion des Produkts,
    // „100 % Transparenz" behauptet etwas über die Welt. Ohne diese Trennung lag die
    // Trefferquote bei 40 Prozent, und die Hälfte der Meldungen war Produkttext.
    notIf: [
      /\b(?:offset|width|height|x1|y1|x2|y2|stdDeviation|viewBox|stopOpacity)=/,
      /@media/,
      /\b(?:ab|über|unter|bis|von|zwischen|maximal|mindestens)\s+\d/i,
    ],
    patterns: [
      // Zwei Neunen: die Zahl, die für Verfügbarkeit erfunden wird.
      /['"`][^'"`\n]*\b9[89][.,]\d+\s*%[^'"`\n]*[A-Za-zÄÖÜäöüß]{3,}[^'"`\n]*['"`]/,
      // Runde Schwelle mit k und Plus: 10k+ Nutzer.
      /['"`][^'"`\n]*\b\d+\s*k\+[^'"`\n]*['"`]/i,
      // Rund um die Uhr, aber nur als Zusage. Als Schichtmodell ist 24/7 ein Fachbegriff.
      /['"`][^'"`\n]*\b24\s*\/\s*7\b[^'"`\n]*\b(?:Support|Erreichbar|Verfügbar|Hotline|Betreuung|Service)/i,
      // Zertifikatsanspruch: gehört mit Nummer und Stelle ins Belegregister.
      /['"`][^'"`\n]*\bISO\s*\d{4,5}\b[^'"`\n]*['"`]/i,
      // Absolutes Versprechen. Konformität ist kein Prozentsatz.
      /['"`][^'"`\n]*\b100\s*%\s*(?:Transparen|Konform|Sicher|Garant|DSGVO|Compliance|Zufrieden|Verfügbar|Genau|Rechtssicher)/i,
    ],
  },
  {
    // Nur der echte Emoji-Bereich. Der Dingbat-Block (U+2700 bis U+27BF) enthält Häkchen und
    // Pfeile, die als Textzeichen legitim sind; der generische Katalog zählt sie mit und kommt
    // dadurch auf 1.709 statt 148 Treffer.
    id: 'M10',
    schwere: 'hoch',
    name: 'Emoji in nutzersichtbarem Text',
    fix: 'lucide-react-Icon statt Emoji, oder das Zeichen streichen; kontexto führt keine Emoji im Inhalt',
    // `.mdx` kommt mit: kontextos Blog ist der groesste Textbestand des Projekts und liegt
    // als MDX im Repo, nicht in `messages/`.
    files: /messages[\\/].+\.json$|\.(tsx|mdx)$/,
    patterns: [/[\u{1F300}-\u{1FAFF}\u{1F004}\u{1F0CF}\u{2B50}\u{2728}]/u],
  },
];

/**
 * Flächen, auf denen ein Muster seine Berechtigung hat.
 *
 * Jeder Eintrag ist ein belegter Fall aus diesem Repo, keine vorsorgliche Freigabe. Der Grund
 * steht dabei, weil eine Ausnahme, die niemand lesen kann, eine Ausnahme ist, die niemand
 * zurücknehmen kann.
 */
export const ALLOW = [
  {
    rule: /^M8$/,
    path: /components[\\/]ui[\\/](chart|tooltip|popover|dropdown-menu|dialog|sheet|command)\.tsx$/,
    grund: 'Overlay schwebt über dem Blatt, hohe Erhebung ist dort richtig',
  },
  {
    rule: /^M(1|4a|4b)$/,
    path: /print-view|[\\/]pdf[\\/]/,
    grund: 'Druckfarben sind kein UI-Theme (metron-style R1-Allowlist)',
  },
  {
    rule: /^M1$/,
    path: /auth-background\.css$|onboarding[\\/]dashboard-background\.tsx$/,
    grund: 'ganzflächiger Seitenhintergrund, nicht die Füllung einer Kachel',
  },
  {
    rule: /^M17$/,
    path: /components[\\/]examples[\\/]/,
    grund: 'Vorlagendatei: dort ist der Platzhalter der Inhalt, nicht ein Rest',
  },
];

/**
 * Projekteigene Ausnahmen aus `slop.config.mjs` im Wurzelverzeichnis, falls vorhanden.
 *
 * Damit bleibt diese Datei in allen Projekten wortgleich und trotzdem anpassbar. Das Format
 * ist dasselbe wie oben, `rule` und `path` als Zeichenketten (sie werden zu RegExp), `grund`
 * als Satz:
 *
 *     export const allow = [
 *       { rule: '^M4b$', path: 'components/legacy/', grund: 'Altbestand, Umbau geplant' },
 *     ];
 *
 * Der Grund ist Pflicht. Eine Ausnahme, die niemand lesen kann, ist eine Ausnahme, die
 * niemand zurücknehmen kann.
 */
async function projektAusnahmen() {
  const pfad = join(ROOT, 'slop.config.mjs');
  if (!existsSync(pfad)) return [];
  try {
    const mod = await import(pathToFileURL(pfad).href);
    const liste = Array.isArray(mod.allow) ? mod.allow : [];
    return liste
      .filter((a) => a && a.rule && a.path && typeof a.grund === 'string' && a.grund.length >= 8)
      .map((a) => ({ rule: new RegExp(a.rule), path: new RegExp(a.path), grund: a.grund }));
  } catch (err) {
    console.error(`slop.config.mjs konnte nicht geladen werden: ${err.message}`);
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Prüfung
// ────────────────────────────────────────────────────────────────────────────

/**
 * Kommentare ausleeren, Zeilenumbrüche erhalten, damit die Zeilennummern stimmen.
 *
 * Ohne das meldet die Prüfung ihre eigene Dokumentation. Real aufgetreten, dreimal in diesem
 * Repo: `auth-shell.tsx:55` begründet sein `shadow-2xl` in einem Kommentar und wurde deswegen
 * als Verstoß gemeldet; `event-grid.tsx:1168` trägt ein Emoji in einem JSX-Kommentar
 * (`{@literal /}* … *{@literal /}`); `staffing-rule-dialog.tsx:433` ist eine Fortsetzungszeile
 * in einem Blockkommentar, die gar nicht mit einem Kommentarzeichen beginnt.
 *
 * Eine Zeilenprüfung fängt nur den ersten Fall. Deshalb wird über die ganze Datei entfernt,
 * nicht je Zeile entschieden. Vorbild und dieselbe Begründung: `scripts/verify-ui.mjs`.
 */
export function ohneKommentare(quelle) {
  return quelle
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

/**
 * Steht in dieser oder der vorigen Zeile eine Begründung?
 *
 * Form: `slop-ok: <Grund>` oder `slop-ok: M3 M8 <Grund>`. Ohne Grundtext (mindestens acht
 * Zeichen) gilt der Kommentar nicht, sonst wäre er ein Freibrief ohne Entscheidung dahinter.
 */
export function hatBegruendung(zeilen, index, id, codeZeilen = null) {
  const fenster = [zeilen[index] ?? '', zeilen[index - 1] ?? ''];

  // Steht die Begründung in einem mehrzeiligen Doc-Kommentar, ist sie nicht die unmittelbar
  // vorige Zeile, sondern irgendwo im Block darüber. Deshalb rückwärts über den
  // zusammenhängenden Kommentarblock lesen, bis die erste Zeile mit Code kommt. Eine reine
  // Kommentarzeile erkennt man daran, dass sie nach dem Entfernen der Kommentare leer ist,
  // im Original aber nicht.
  if (codeZeilen) {
    // Ab index-1 rückwärts, und zwar nur über ZUSAMMENHÄNGENDE reine Kommentarzeilen. Sobald
    // eine Zeile mit Code kommt, endet der Block: eine Begründung, zwischen der und der
    // geprüften Zeile noch anderer Code steht, gehört nicht zu dieser Zeile. Ein Start bei
    // index-2 übersprang genau diese Trennung und ließ eine fremde Begründung durch.
    for (let j = index - 1; j >= 0 && index - j <= 30; j -= 1) {
      const istReinerKommentar = (codeZeilen[j] ?? '').trim() === '' && (zeilen[j] ?? '').trim() !== '';
      if (!istReinerKommentar) break;
      fenster.push(zeilen[j]);
    }
  }

  // `[ \t]*` statt `\s*`: `\s` schließt den Zeilenumbruch ein, und dann liest ein leeres
  // `slop-ok:` die FOLGENDE Zeile als seinen Grund. Ein Freibrief ohne Satz hätte damit
  // gewirkt, also genau das Gegenteil des Ansatzes. Vom Test gefunden, nicht vom Auge.
  const treffer = fenster.join('\n').match(/slop-ok:[ \t]*(.*)/);
  if (!treffer) return false;

  const rest = treffer[1].trim();
  const woerter = rest.split(/\s+/);
  const ids = [];
  let i = 0;
  while (i < woerter.length && /^M\d+[a-z]?$/.test(woerter[i])) {
    ids.push(woerter[i]);
    i += 1;
  }
  if (ids.length > 0 && !ids.includes(id)) return false;
  return woerter.slice(i).join(' ').trim().length >= 8;
}

// Kern-Ausnahmen plus die projekteigenen aus slop.config.mjs.
const AKTIVE_AUSNAHMEN = [...ALLOW];
const istErlaubt = (id, rel) => AKTIVE_AUSNAHMEN.find((a) => a.rule.test(id) && a.path.test(rel));

/**
 * `slop-ok-datei: M8 <Grund>` gilt für die genannten Regeln in der ganzen Datei.
 *
 * Warum es das braucht: die zeilengenaue Form greift nicht, wenn der Treffer eine
 * Fortsetzungszeile eines mehrzeiligen Ausdrucks ist. Ein Ternär über zwei Zeilen, ein
 * `cn(...)` über vier, ein `@keyframes` mit seinen Schritten: dort steht zwischen Begründung
 * und Treffer immer Code, und die Blockgrenze bricht korrekt ab. Alle drei Formen sind hier
 * real aufgetreten.
 *
 * Regel-IDs sind Pflicht, sonst wäre es ein Generalfreibrief für die Datei. Damit gilt die
 * Ausnahme genau für das eine Muster, über das jemand entschieden hat, und die Datei bleibt
 * für alle anderen Regeln streng.
 */
export function dateiBegruendungen(inhalt) {
  const ids = new Set();
  for (const treffer of inhalt.matchAll(/slop-ok-datei:[ \t]*(.*)/g)) {
    const woerter = treffer[1].trim().split(/\s+/);
    const genannt = [];
    let i = 0;
    while (i < woerter.length && /^M\d+[a-z]?$/.test(woerter[i])) {
      genannt.push(woerter[i]);
      i += 1;
    }
    const grund = woerter.slice(i).join(' ').trim();
    if (genannt.length === 0 || grund.length < 8) continue;
    for (const id of genannt) ids.add(id);
  }
  return ids;
}

/** Prüft den Inhalt einer Datei. Exportiert, damit die Tests ohne Dateisystem auskommen. */
export function pruefeInhalt(relPfad, inhalt) {
  const befunde = [];
  // JSON kennt keine Kommentare, dort würde `//` in einer URL Text wegschneiden. MDX ebenso:
  // dort ist `//` Prosa oder gehört zu einer Adresse in einem Markdown-Link, es ist kein
  // Kommentarzeichen.
  const istJson = relPfad.endsWith('.json');
  const istMdx = relPfad.endsWith('.mdx');
  const zeilen = inhalt.split(/\r?\n/);
  // Geprüft wird der Code ohne Kommentare, gemeldet und nach `slop-ok` durchsucht wird das
  // Original: die Begründung steht ja gerade in einem Kommentar.
  const codeZeilen = (istJson || istMdx ? inhalt : ohneKommentare(inhalt)).split(/\r?\n/);
  // In MDX bleibt die Freigabe auf Dateiebene möglich, als `{/* slop-ok-datei: M20 Grund */}`.
  // Ein wörtliches Zitat aus fremdem Bestand ist der Fall, für den es sie dort braucht.
  const dateiweit = istJson ? new Set() : dateiBegruendungen(inhalt);

  codeZeilen.forEach((code, i) => {
    for (const regel of RULES) {
      if (regel.files && !regel.files.test(relPfad)) continue;

      // `imKommentar`: diese Regel sucht absichtlich IN Kommentaren und bekommt deshalb die
      // Originalzeile. Ein TODO steht definitionsgemäß in einem Kommentar; gegen die
      // kommentarfreie Fassung geprüft fand die Regel nie etwas, obwohl sie im Katalog stand.
      const zuPruefen = regel.imKommentar ? (zeilen[i] ?? '') : code;

      if (!regel.patterns.some((p) => p.test(zuPruefen))) continue;
      if (regel.notIf?.some((p) => p.test(zuPruefen))) continue;
      if (regel.boxOnly && (!/<(?:div|section|aside)\b/.test(zuPruefen) || /\bBadge\b/.test(zuPruefen))) continue;
      if (dateiweit.has(regel.id)) continue;
      if (istErlaubt(regel.id, relPfad)) continue;
      if (hatBegruendung(zeilen, i, regel.id, codeZeilen)) continue;

      befunde.push({
        id: regel.id,
        schwere: regel.schwere,
        name: regel.name,
        fix: regel.fix,
        file: relPfad,
        line: i + 1,
        text: (zeilen[i] ?? '').trim().slice(0, 120),
      });
    }
  });

  return befunde;
}

// ────────────────────────────────────────────────────────────────────────────
// Dateiauswahl
// ────────────────────────────────────────────────────────────────────────────

function sammle(dir, out = []) {
  let eintraege;
  try {
    eintraege = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of eintraege) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      sammle(join(dir, e.name), out);
    } else if (SCANNED_EXT.test(e.name)) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

const scanAll = process.argv.includes('--all');

/**
 * Geänderte und unversionierte Dateien, `--branch` zusätzlich alles gegen master.
 *
 * Der schmale Default ist Absicht und derselbe wie bei `verify:ui`: das Repo trägt
 * Bestandsschulden bei mehreren dieser Muster, und eine Prüfung, die über sie reihenweise rot
 * läuft, wird abgeschaltet. Auf das Angefasste zugeschnitten kann sie dauerhaft streng bleiben,
 * und `--all` liefert weiterhin die vollständige Bestandsaufnahme.
 */
function geaenderteDateien(alleDateien) {
  // execFileSync mit Argumentliste, nicht execSync mit Zeichenkette: hier fließt mit `basis`
  // ein ermittelter Wert in einen Aufruf, und ohne Shell dazwischen kann er nichts anderes
  // sein als ein Argument.
  const lauf = (...args) => {
    try {
      return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return '';
    }
  };
  const teile = [
    lauf('diff', '--name-only', 'HEAD'),
    lauf('ls-files', '--others', '--exclude-standard'),
  ];
  if (process.argv.includes('--branch')) {
    const basis =
      lauf('merge-base', 'HEAD', 'origin/master').trim() || lauf('merge-base', 'HEAD', 'master').trim();
    if (basis) teile.push(lauf('diff', '--name-only', basis));
  }
  const beruehrt = new Set(
    teile
      .join('\n')
      .split('\n')
      .map((z) => z.trim())
      .filter(Boolean)
      .map((rel) => join(ROOT, rel))
  );
  return alleDateien.filter((f) => beruehrt.has(f));
}

// ────────────────────────────────────────────────────────────────────────────
// Kennzahlen auf Marketingflächen, gegen das Belegregister
// ────────────────────────────────────────────────────────────────────────────

const REGISTER = join(ROOT, 'docs', 'marketing', 'claims.md');

/**
 * Formen, an denen eine erfundene Zahl erkennbar ist. Nicht daran, ob sie stimmt, sondern an
 * ihrer Form: gerundete Zahlen in Dreierreihen sind Bühnenbild, keine Messung. Begründung je
 * Form im Skill augenmass, `references/claims.md`.
 */
const KENNZAHL_FORMEN = [
  /\b\d{1,3}[.,]\d\s*%/, // zwei Neunen: 99,9 %
  /\b\d+\s*k\+/i, // runde Schwelle mit k: 25k+
  /\b\d{1,3}(?:[.,]\d{3})+\s*\+/, // 25.000+
  // Kein Lookahead auf ein Folgezeichen: geprüft wird der extrahierte Wert, und dort steht
  // `500+` am Stringende. Mit `(?=["\s])` fielen 5+, 15+ und 500+ stillschweigend durch.
  /\b\d+\s*\+/,
  /\b100\s*%/, // absolutes Versprechen
  /\b24\/7\b/,
  /\bISO\s*\d{4,5}\b/i, // Zertifikatsname ohne Nummer und Stelle
  // Kein `\b` vor Mio: in `50Mio€+` stehen Ziffer und M direkt nebeneinander, dort gibt es
  // keine Wortgrenze, und der Treffer fiel deshalb aus.
  /Mio\s*€?\s*\+/i,
  /bis zu \d+\s*%/i,
];

function pruefeKennzahlen(dateien) {
  const belegt = existsSync(REGISTER) ? readFileSync(REGISTER, 'utf8') : '';
  const befunde = [];

  for (const datei of dateien) {
    const rel = relative(ROOT, datei);
    if (!/messages[\\/](de|en)[\\/]home\.json$/.test(rel)) continue;

    const zeilen = readFileSync(datei, 'utf8').split(/\r?\n/);
    zeilen.forEach((zeile, i) => {
      const wert = zeile.match(/"(?:value|uptime|title|subtitle)":\s*"([^"]+)"/);
      if (!wert) return;
      if (!KENNZAHL_FORMEN.some((f) => f.test(wert[1]))) return;
      if (belegt.includes(wert[1])) return;

      befunde.push({
        id: 'M11',
        schwere: 'hoch',
        name: 'Kennzahl ohne Beleg auf einer Marketingfläche',
        fix: 'Beleg nach docs/marketing/claims.md eintragen oder die Angabe entfernen',
        file: rel,
        line: i + 1,
        text: wert[1].slice(0, 120),
      });
    });
  }
  return befunde;
}

// ────────────────────────────────────────────────────────────────────────────
// Ausgabe
// ────────────────────────────────────────────────────────────────────────────

/**
 * Was diese Prüfung NICHT sieht. Mitgesagt, nicht verschwiegen: „keine Befunde" ist sonst
 * schon einmal als „die Fläche ist in Ordnung" gelesen worden.
 */
const GRENZE =
  'Ungeprüft bleibt alles, was nur am Bildschirm sichtbar ist: Rhythmus der Abschnitte, ' +
  'Verschachtelung von Karten, Abstandslogik, Schriftwirkung. Dafür ist der Skill augenmass ' +
  'zuständig, und dafür braucht es einen Screenshot. Das Schweigen hier ist kein Nachweis.';

async function main() {
  AKTIVE_AUSNAHMEN.push(...(await projektAusnahmen()));
  const alleDateien = SCAN_DIRS.flatMap((d) => sammle(join(ROOT, d)));
  const dateien = scanAll ? alleDateien : geaenderteDateien(alleDateien);

  const befunde = [
    ...dateien.flatMap((f) => {
      try {
        return pruefeInhalt(relative(ROOT, f), readFileSync(f, 'utf8'));
      } catch {
        return [];
      }
    }),
    ...pruefeKennzahlen(dateien),
  ];

  // Maschinenlesbar für CI und für die Auswertung nach Datei. Die Textausgabe kappt bewusst bei
  // zwölf Fundstellen je Regel, damit sie lesbar bleibt; wer zählen will, nimmt diesen Weg.
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ dateien: dateien.length, befunde }, null, 2));
    return befunde.length === 0 ? 0 : 1;
  }

  const umfang = scanAll
    ? `${dateien.length} Datei(en), gesamtes Repo`
    : process.argv.includes('--branch')
      ? `${dateien.length} Datei(en) im Branch`
      : `${dateien.length} Datei(en) mit ungesicherten Änderungen`;

  if (befunde.length === 0) {
    console.log(`verify-slop: keine Befunde (${umfang}).`);
    console.log(`             ${GRENZE}`);
    return 0;
  }

  const nachRegel = new Map();
  for (const b of befunde) {
    const liste = nachRegel.get(b.id) ?? [];
    liste.push(b);
    nachRegel.set(b.id, liste);
  }

  const rang = { hoch: 0, mittel: 1 };
  const sortiert = [...nachRegel.entries()].sort(
    (a, b) => rang[a[1][0].schwere] - rang[b[1][0].schwere] || a[0].localeCompare(b[0])
  );

  console.error(`verify-slop: ${befunde.length} Befund(e) in ${umfang}.\n`);
  for (const [id, liste] of sortiert) {
    console.error(`── ${id} [${liste[0].schwere}] ${liste[0].name}  (${liste.length})`);
    console.error(`   Fix: ${liste[0].fix}`);
    for (const b of liste.slice(0, 12)) console.error(`   → ${b.file}:${b.line}`);
    if (liste.length > 12) console.error(`   → und ${liste.length - 12} weitere`);
    console.error('');
  }
  console.error('Bewusste Ausnahme? Begründung in die Zeile darüber:');
  console.error('  // slop-ok: M8 Grund, warum das Muster hier richtig ist');
  console.error(`\n${GRENZE}`);
  return 1;
}

// Nur ausführen, wenn die Datei direkt gestartet wurde. Beim Import aus dem Test liefe sonst
// der ganze Durchlauf mit, inklusive `process.exit`, und die Testdatei bräche ab, bevor ein
// einziger Fall geprüft wäre. Genau so ist es beim ersten Lauf passiert.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
