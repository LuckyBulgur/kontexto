#!/usr/bin/env node
/**
 * verify-dashes: haelt Gedankenstriche aus dem ganzen Repository heraus.
 *
 * Verboten sind:
 *
 *   U+2014  Geviertstrich ("em dash")   immer
 *   U+2015  Horizontal Bar              immer
 *   U+2013  Halbgeviertstrich           nur als Gedankenstrich, also mit Leerzeichen auf beiden
 *                                       Seiten. Als Spannenzeichen bleibt er erlaubt:
 *                                       `10:00-12:00` als Spanne, `Mo-Fr`, `S. 24-31`.
 *
 * Ersatz beim Schreiben: Komma. Traegt das Komma den Satz nicht, wird umformuliert oder der Satz
 * geteilt; ein Doppelpunkt nur, wenn eine Aufzaehlung oder eine Definition folgt. Ein
 * Bindestrich `-` ist KEIN Ersatz, er bleibt Komposita (`Soll-Stunden`), Flags (`--all`),
 * Listenpunkten und Tabellentrennern vorbehalten. Die Regel steht vollstaendig in
 * `.claude/rules/content/no-em-dash.md`.
 *
 * WARUM DER PRUEFBEREICH HIER DAS GANZE REPO IST
 *
 * metronHR prueft nur `messages/de` und `messages/en`, weil dort rund 9.600 weitere
 * Geviertstriche in Kommentaren und Doku liegen und eine repoweite Pruefung dauerhaft rot
 * gewesen waere. Eine Pruefung mit dieser Quote wird abgeschaltet und schuetzt danach nichts.
 *
 * kontexto hat diesen Bestand nicht mehr: die 95 Vorkommen ausserhalb von
 * `docs/superpowers/plans/` sind am 2026-08-20 bereinigt worden. Der strenge Bereich ist deshalb
 * das ganze Repository, und die Ausnahmen stehen einzeln mit Grund in `AUSNAHMEN`.
 *
 * Diese Pruefung ergaenzt zwei andere, sie ersetzt keine davon:
 *
 *   `pnpm verify:slop`  Regel M20, aber nur in `app/`, `components/`, `lib/`, `content/`,
 *                       `types/` und nur in `.tsx`, `.ts`, `.json`, `.mdx`.
 *   `pnpm seo:check`    die gerenderten Content-Seiten in `out/`, also das Ergebnis statt der
 *                       Quelle, dazu die deutschen Anfuehrungszeichen.
 *
 * Nur diese Pruefung sieht Python, Shell, Dockerfile, nginx.conf, die Workflows, Markdown
 * und `.claude/` (Regeln, Skills, Agenten), das `.gitignore` ausschliesst.
 *
 * Aufruf: `pnpm verify:dashes` | `--json` (maschinenlesbar)
 *
 * Die verbotenen Zeichen stehen in dieser Datei nur als Zeichencode, nie literal. Sonst meldet
 * die Pruefung sich selbst.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const GEVIERT = String.fromCharCode(0x2014);
const HORIZONTAL_BAR = String.fromCharCode(0x2015);
const HALBGEVIERT = String.fromCharCode(0x2013);

const IMMER_VERBOTEN = new Set([GEVIERT, HORIZONTAL_BAR]);

const NAMEN = {
  [GEVIERT]: 'U+2014 Geviertstrich',
  [HORIZONTAL_BAR]: 'U+2015 Horizontal Bar',
  [HALBGEVIERT]: 'U+2013 Halbgeviertstrich als Gedankenstrich',
};

/**
 * Ausnahmen, jede mit Grund.
 *
 * Vorbild und dieselbe Begruendung wie bei `ALLOW` in `verify-slop.mjs`: eine Ausnahme, die
 * niemand lesen kann, ist eine Ausnahme, die niemand zuruecknehmen kann. Die Liste bleibt kurz,
 * sonst ist sie keine Ausnahme mehr, sondern der Normalfall.
 */
const AUSNAHMEN = [
  {
    path: /^docs[/]superpowers[/]plans[/]/,
    grund:
      'historische Planungsdokumente. Sie halten einen Stand fest und werden nicht rueckdatiert '
      + 'umgeschrieben; neue Plaene entstehen unter derselben Regel wie jeder andere Text.',
  },
  {
    path: /^frontend[/](AGENTS|CLAUDE)\.md$/,
    grund:
      'schreibt `next dev` selbst, siehe node_modules/next/dist/server/lib/generate-agent-files.js. '
      + 'Fremder Bestand: eine Korrektur waere beim naechsten Start des Dev-Servers wieder weg.',
  },
];

/** Dateien, die als Text zu lesen sind. Alles andere waere Rauschen aus Binaerinhalt. */
const BINAER = /\.(png|jpe?g|gif|webp|avif|ico|icns|woff2?|ttf|otf|eot|pdf|zip|gz|bz2|xz|7z|npz|npy|bin|db|sqlite3?|mp[34]|wav|webm|mov|pyc|so|dll|exe|wasm)$/i;
const MAX_BYTES = 4 * 1024 * 1024;

function repoWurzel() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

/**
 * Zusaetzliche Baeume, die `.gitignore` ausschliesst und die trotzdem geprueft werden.
 *
 * `.claude/` ist in kontexto komplett ignoriert, enthaelt aber Regeln, Skills und Agenten, also
 * genau den Text, der in jeden Kontext geladen wird und dort als Vorbild wirkt. Die globale
 * Regel nennt `.claude/` ausdruecklich im Geltungsbereich. Ohne diesen Zusatz waere der Ordner
 * die einzige Stelle im Repo, an der der Strich unbemerkt zurueckkaeme.
 */
const ZUSATZ_BAEUME = ['.claude'];
const ZUSATZ_UEBERSPRINGEN = new Set(['node_modules', '.git', 'out', 'dist', 'build']);

function sammle(root, rel, out) {
  let eintraege;
  try {
    eintraege = readdirSync(join(root, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of eintraege) {
    if (e.isDirectory()) {
      if (ZUSATZ_UEBERSPRINGEN.has(e.name)) continue;
      sammle(root, `${rel}/${e.name}`, out);
    } else if (e.isFile()) {
      out.push(`${rel}/${e.name}`);
    }
  }
  return out;
}

/**
 * Versionierte und unversionierte Dateien.
 *
 * Ueber `git ls-files`, nicht ueber einen eigenen Verzeichnislauf: damit bleiben `node_modules`,
 * `.next`, `out` und das generierte `data/` ohne Extraliste draussen, und zwar genau nach dem,
 * was `.gitignore` sagt. Unversionierte Dateien kommen mit, sonst faellt eine gerade angelegte
 * Datei erst nach dem Commit auf. Dazu die Baeume aus `ZUSATZ_BAEUME`, die `.gitignore`
 * ausschliesst und die trotzdem hierher gehoeren.
 */
function dateien(root) {
  const lauf = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0')
      .filter(Boolean);

  const alle = new Set([
    ...lauf('ls-files', '-z'),
    ...lauf('ls-files', '--others', '--exclude-standard', '-z'),
    ...ZUSATZ_BAEUME.flatMap((b) => sammle(root, b, [])),
  ]);

  return [...alle].sort().filter((rel) => {
    if (BINAER.test(rel)) return false;
    if (AUSNAHMEN.some((a) => a.path.test(rel))) return false;
    try {
      const s = statSync(join(root, rel));
      return s.isFile() && s.size <= MAX_BYTES;
    } catch {
      return false;
    }
  });
}

/** Befunde einer Datei: Zeile, Zeichen, Ausschnitt um die Fundstelle. */
export function pruefeInhalt(rel, inhalt) {
  const befunde = [];
  inhalt.split(/\r?\n/).forEach((zeile, index) => {
    for (let i = 0; i < zeile.length; i += 1) {
      const zeichen = zeile[i];
      if (!IMMER_VERBOTEN.has(zeichen) && zeichen !== HALBGEVIERT) continue;
      // Der Halbgeviertstrich ist als Spannenzeichen korrekt. Gemeldet wird nur der
      // Gedankenstrich, erkennbar am Leerzeichen auf beiden Seiten.
      if (zeichen === HALBGEVIERT && !(zeile[i - 1] === ' ' && zeile[i + 1] === ' ')) continue;
      befunde.push({
        file: rel,
        line: index + 1,
        char: NAMEN[zeichen],
        excerpt: zeile.slice(Math.max(0, i - 45), i + 46).trim(),
      });
    }
  });
  return befunde;
}

function main() {
  const root = repoWurzel();
  const liste = dateien(root);
  const befunde = liste.flatMap((rel) => {
    try {
      return pruefeInhalt(rel, readFileSync(join(root, rel), 'utf8'));
    } catch {
      return [];
    }
  });

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ dateien: liste.length, befunde }, null, 2));
    return befunde.length === 0 ? 0 : 1;
  }

  if (befunde.length === 0) {
    console.log(`verify-dashes: kein Gedankenstrich in ${liste.length} Datei(en).`);
    for (const a of AUSNAHMEN) console.log(`             ausgenommen: ${a.path.source} (${a.grund})`);
    return 0;
  }

  console.error(`\nverify-dashes: ${befunde.length} Befund(e) in ${liste.length} Datei(en).\n`);
  for (const b of befunde) {
    console.error(`── ${b.file}:${b.line}   ${b.char}`);
    console.error(`   > ...${b.excerpt}...`);
  }
  console.error(
    '\nErsatz: Komma, sonst Satz umformulieren oder teilen. Kein Bindestrich als Ersatz.'
      + '\nRegel: .claude/rules/content/no-em-dash.md\n',
  );
  return 1;
}

// Nur ausfuehren, wenn die Datei direkt gestartet wurde, damit ein Import aus einem Test nicht
// den ganzen Durchlauf mitzieht.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
