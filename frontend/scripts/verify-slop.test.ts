import { describe, it, expect } from 'vitest';

import { RULES, pruefeInhalt, ohneKommentare, hatBegruendung } from './verify-slop.mjs';

/**
 * Tests für `verify-slop`.
 *
 * Warum es sie gibt: ein Schutz, der stillschweigend nichts tut, ist schlimmer als keiner.
 * Jede Regel bekommt deshalb einen Fall, der greifen MUSS, und einen, der NICHT greifen darf.
 *
 * Die Fälle zu M10 und M20 in `.mdx` prüfen kontextos Abweichung gegenüber metronHR: hier steht
 * der nutzersichtbare Text im TSX und im MDX-Blog, nicht in `messages/`.
 */

// Die verbotenen Striche stehen als Zeichencode, nicht literal. `pnpm verify:dashes` prüft in
// kontexto das ganze Repo, und mit den Zeichen im Klartext meldete diese Testdatei sich selbst.
const GEVIERT = String.fromCharCode(0x2014);
const HALBGEVIERT = String.fromCharCode(0x2013);

const tsx = (inhalt: string) => pruefeInhalt('components/probe.tsx', inhalt);
const ids = (inhalt: string) => tsx(inhalt).map((b) => b.id);
const mdxIds = (inhalt: string) => pruefeInhalt('content/blog/probe.mdx', inhalt).map((b) => b.id);

describe('verify-slop: jede Regel greift', () => {
  it('M1 meldet einen Dekor-Verlauf in rohen Farbstufen', () => {
    expect(ids('<div className="bg-gradient-to-br from-purple-100 via-purple-50 to-card" />')).toContain('M1');
  });

  it('M2 meldet einen Verlauf als Textfüllung', () => {
    expect(ids('<h1 className="bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent" />'))
      .toContain('M2');
  });

  it('M3 meldet einen farbigen Schatten', () => {
    expect(ids('<Card className="shadow-lg shadow-purple-200/50" />')).toContain('M3');
  });

  it('M4a meldet eine Icon-Kachel in roher Pastellstufe', () => {
    expect(ids('<div className="p-2 rounded-lg bg-blue-100">')).toContain('M4a');
  });

  it('M4b meldet eine selbstgebaute Ein-Ton-Hinweisbox', () => {
    expect(ids('<div className="bg-amber-50 border border-amber-200 rounded-md p-4">')).toContain('M4b');
  });

  it('M5 meldet transition-all', () => {
    expect(ids('<div className="transition-all duration-300" />')).toContain('M5');
  });

  it('M6 meldet federnden Hover', () => {
    expect(ids('<div className="hover:scale-105" />')).toContain('M6');
    expect(ids('<div className="hover:-translate-y-1" />')).toContain('M6');
    expect(ids('<div className="animate-bounce" />')).toContain('M6');
  });

  it('M7 meldet Overshoot-Easing im zweiten Parameter', () => {
    // Der Grund für diesen Test: die erste Fassung der Regel prüfte nur den vierten Parameter
    // und fand deshalb null Treffer, obwohl globals.css drei solche Kurven führt.
    expect(pruefeInhalt('app/globals.css', 'animation: fan-out 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;').map((b) => b.id))
      .toContain('M7');
  });

  it('M8 meldet Kante und breiten Schatten am selben Element', () => {
    expect(ids('<div className="border border-border/40 shadow-xl" />')).toContain('M8');
    expect(ids('<div className="shadow-2xl" />')).toContain('M8');
  });

  it('M9 meldet eine Glasfläche außerhalb eines Overlays', () => {
    expect(ids('<div className="bg-card/95 backdrop-blur-xl rounded-2xl" />')).toContain('M9');
  });

  it('M13 meldet eine Endlosbewegung ohne Anlass', () => {
    // Der Regex trug einmal ein Backspace-Zeichen statt der Wortgrenze und traf deshalb nie
    // etwas, obwohl die Regel im Katalog stand. Ein Schutz, der still nichts tut.
    expect(pruefeInhalt('app/globals.css', '  animation: wobble 4s ease-in-out infinite;').map((b) => b.id))
      .toContain('M13');
  });

  it('M15 meldet Blur ohne Fläche dahinter', () => {
    expect(ids('<div className="backdrop-blur-sm rounded-xl" />')).toContain('M15');
  });

  it('M16 meldet eine Klickfläche ohne Tastaturzugang', () => {
    expect(ids('<div className="fixed inset-0" onClick={close} />')).toContain('M16');
  });

  it('M17 meldet einen unerledigten Platzhalter', () => {
    // Die Regel sucht absichtlich IN Kommentaren. Gegen die kommentarfreie Fassung geprüft
    // fand sie nie etwas, obwohl sie im Katalog stand.
    expect(ids('  // TODO: Freigabe nachziehen')).toContain('M17');
  });

  it('M18 meldet die Typ-Fluchtluke any', () => {
    expect(ids('const x = wert as any;')).toContain('M18');
    expect(ids('function f(t: any) {}')).toContain('M18');
  });

  it('M19 meldet eine Kennzahl im Markup ohne Beleg', () => {
    expect(ids("const x = { text: '99.9% SLA-Garantie' };")).toContain('M19');
    expect(ids("const x = { metric: '100% Transparenz' };")).toContain('M19');
    expect(ids("const x = { name: 'ISO 27001 RZ' };")).toContain('M19');
  });

  it('M20 meldet den Gedankenstrich, aber nicht die Spanne', () => {
    expect(ids(`const t = 'zum Preis ${GEVIERT} ohne Pauschale';`)).toContain('M20');
    expect(ids(`const t = 'das Modell ${HALBGEVIERT} und der Verlustbringer';`)).toContain('M20');
    // Spannen bleiben: dort trennt der Strich zwei Werte, statt zwei Satzteile zu verbinden.
    expect(ids(`const t = 'Sprechzeit 08:00 ${HALBGEVIERT} 16:00';`)).not.toContain('M20');
    expect(ids(`const t = 'Mo${HALBGEVIERT}Fr';`)).not.toContain('M20');
  });

  it('M10 meldet ein Emoji in nutzersichtbarem Text', () => {
    expect(ids('<span>🌍</span>')).toContain('M10');
    expect(pruefeInhalt('messages/de/tour.json', '"greeting": "👋 Willkommen"').map((b) => b.id)).toContain('M10');
  });
});

describe('verify-slop: der Kanon des Projekts wird nicht gemeldet', () => {
  it('lässt rounded-full als Badge in Ruhe', () => {
    expect(ids('<Badge className="rounded-full bg-blue-100 text-blue-700 border-blue-200" />')).toEqual([]);
  });

  it('lässt die kanonische Filterbar in Ruhe', () => {
    expect(ids('<div className="backdrop-blur-sm bg-card/60 border border-border/50 rounded-2xl px-4 py-3 shadow-sm" />'))
      .not.toContain('M9');
  });

  it('lässt die Sticky-Kopfzeile in Ruhe', () => {
    expect(ids('<header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" />'))
      .not.toContain('M9');
  });

  it('lässt eine Deckschicht über verdecktem Inhalt in Ruhe', () => {
    expect(ids('<div className="absolute inset-0 z-20 bg-card/95 backdrop-blur-sm" />')).not.toContain('M9');
  });

  it('lässt ein Häkchen als Textzeichen in Ruhe', () => {
    // Der generische Katalog zählt den Dingbat-Block mit und kommt dadurch auf ein Vielfaches
    // der echten Treffer. Häkchen und Pfeile sind Textzeichen, keine Emoji.
    expect(ids('<span>✓ erledigt</span>')).not.toContain('M10');
    expect(pruefeInhalt('messages/de/common.json', '"ok": "✓ Gespeichert"')).toEqual([]);
  });

  it('lässt Lade-Bewegung in Ruhe', () => {
    // animate-spin und animate-pulse tragen die Aussage "es passiert gerade etwas". Der
    // globale reduced-motion-Block in globals.css beruhigt sie ohnehin.
    expect(pruefeInhalt('app/globals.css', '  .x { animation: animate-spin 1s linear infinite; }')).toEqual([]);
  });

  it('lässt Blur MIT Fläche in Ruhe', () => {
    // Dort greift M9, wenn die Fläche kein Overlay ist. M15 ist der umgekehrte Fall.
    expect(ids('<div className="backdrop-blur-sm bg-card/60 border" />')).not.toContain('M15');
  });

  it('lässt eine Klickfläche mit Tastaturzugang in Ruhe', () => {
    expect(ids('<div role="button" tabIndex={0} onClick={f} onKeyDown={k} />')).not.toContain('M16');
    expect(ids('<button onClick={f} />')).not.toContain('M16');
  });

  it('lässt unknown und Generics in Ruhe', () => {
    expect(ids('function f(d: unknown) {}')).not.toContain('M18');
    expect(ids('function f<T>(items: T[]) {}')).not.toContain('M18');
    // `company` enthält die Zeichenfolge any, ist aber keine.
    expect(ids('const company: Company = x;')).not.toContain('M18');
  });

  it('liest Produkttext nicht als Marketing-Behauptung', () => {
    // Ohne diese Trennung lag M19 bei 40 Prozent Trefferquote: ein Schwellwert beschreibt
    // eine Funktion, ein Schichtmodell ist ein Fachbegriff, ein SVG-Attribut ist Geometrie.
    expect(ids("const x = { detail: 'Gelb ab 80 %, Rot über 100 %' };")).not.toContain('M19');
    expect(ids("const x = { options: ['2-Schicht', '24/7'] };")).not.toContain('M19');
    expect(ids('<stop offset="100%" stopColor={GREEN} />')).not.toContain('M19');
  });

  it('lässt transition-colors in Ruhe', () => {
    expect(ids('<div className="transition-colors duration-200" />')).toEqual([]);
  });

  it('liest border-color in einer Eigenschaftsliste nicht als Rahmen', () => {
    // Sonst meldet M8 ausgerechnet die Schreibweise, zu der M5 rät.
    expect(ids('<button className="shadow-lg transition-[color,border-color,box-shadow] hover:shadow-xl" />'))
      .not.toContain('M8');
    // Der echte Fall bleibt gemeldet.
    expect(ids('<div className="border border-border shadow-xl" />')).toContain('M8');
  });
});

describe('verify-slop: Kommentare werden nicht geprüft', () => {
  it('meldet ein Muster nicht, das nur in einem Zeilenkommentar steht', () => {
    expect(ids('// niemals shadow-2xl auf einer Standardkarte')).toEqual([]);
  });

  it('meldet ein Muster nicht in einer Fortsetzungszeile eines Blockkommentars', () => {
    // Real aufgetreten: staffing-rule-dialog.tsx:433 trägt ein Emoji in einer Zeile ohne
    // führendes Kommentarzeichen. Eine reine Zeilenprüfung übersieht das.
    const quelle = ['/**', ' * Erklärung, die weitergeht', '   Stundenzahl (🕐:00) im Text', ' */'].join('\n');
    expect(tsx(quelle)).toEqual([]);
  });

  it('meldet ein Muster nicht in einem JSX-Kommentar', () => {
    expect(ids('{/* 🔒 Sperrhinweis */}')).toEqual([]);
  });

  it('erhält die Zeilennummern beim Entfernen der Kommentare', () => {
    const quelle = ['/* eins', 'zwei', 'drei */', '<div className="shadow-2xl" />'].join('\n');
    expect(ohneKommentare(quelle).split('\n')).toHaveLength(4);
    expect(tsx(quelle)[0]?.line).toBe(4);
  });

  it('zerschneidet keine URL an ihrem doppelten Schrägstrich', () => {
    expect(ohneKommentare('const u = "https://example.com/x";')).toContain('https://example.com/x');
  });
});

describe('verify-slop: die Begründungspflicht', () => {
  const verstoss = '<Card className="shadow-2xl">';

  it('lässt einen begründeten Verstoß durch', () => {
    const quelle = ['// slop-ok: M8 Die Karte liegt auf einem dunklen Bild', verstoss].join('\n');
    expect(tsx(quelle)).toEqual([]);
  });

  it('meldet weiter, wenn die Begründung fehlt', () => {
    // Der Kern des Ansatzes: ein Freibrief ohne Satz ist keine Entscheidung.
    expect(ids(['// slop-ok:', verstoss].join('\n'))).toContain('M8');
    expect(ids(['// slop-ok: M8', verstoss].join('\n'))).toContain('M8');
  });

  it('meldet weiter, wenn die Begründung eine andere Regel nennt', () => {
    expect(ids(['// slop-ok: M3 Ein Grund, der lang genug ist', verstoss].join('\n'))).toContain('M8');
  });

  it('akzeptiert eine Begründung ohne Regel-ID für jede Regel', () => {
    expect(tsx(['// slop-ok: Diese Fläche ist bewusst so gebaut', verstoss].join('\n'))).toEqual([]);
  });

  it('akzeptiert die Begründung auch auf derselben Zeile', () => {
    expect(tsx(`${verstoss} // slop-ok: M8 Grund an derselben Zeile`)).toEqual([]);
  });

  it('findet die Begründung in einem mehrzeiligen Doc-Kommentar darüber', () => {
    // Der Normalfall, nicht die Ausnahme: eine Begründung, die eine Erklärung wert ist, steht
    // in einem Block, und dann ist sie nicht die unmittelbar vorige Zeile. Real aufgetreten
    // an der Auffächer-Kurve in globals.css, die trotz Begründung weiter gemeldet wurde.
    const quelle = [
      '  /*',
      '    Auffächer-Kurve für die schwebenden Aktionsknöpfe.',
      '',
      '    slop-ok: M7 Die Knöpfe fahren wirklich durch den Raum, hier überschwingt eine',
      '    Bewegung und kein Zustandswechsel.',
      '  */',
      '  --ease-fan-out: cubic-bezier(0.34, 1.56, 0.64, 1);',
    ].join('\n');
    expect(pruefeInhalt('app/globals.css', quelle)).toEqual([]);
  });

  it('greift nicht über den Kommentarblock hinaus auf eine fremde Begründung', () => {
    const quelle = [
      '// slop-ok: M8 Begründung, die zu einer ganz anderen Zeile gehört',
      '<div className="p-4" />',
      '<Card className="shadow-2xl">',
    ].join('\n');
    expect(ids(quelle)).toContain('M8');
  });
});

describe('verify-slop: kontextos MDX-Blog', () => {
  it('meldet den Gedankenstrich in einem Beitrag', () => {
    expect(mdxIds(`Der Rang ${GEVIERT} und was er wirklich aussagt.`)).toContain('M20');
  });

  it('meldet ein Emoji in einem Beitrag', () => {
    expect(mdxIds('Gelöst 🎉')).toContain('M10');
  });

  it('liest zwei Schrägstriche in einer Adresse nicht als Kommentaranfang', () => {
    // In MDX ist `\\` Prosa oder Teil einer Adresse. Würden Kommentare ausgeblendet, wäre
    // alles rechts davon unsichtbar, und der Strich dahinter fiele stillschweigend durch.
    expect(mdxIds(`Siehe kontexto.de\\blog ${GEVIERT} dort steht mehr.`)).toContain('M20');
  });

  it('nimmt eine begründete Freigabe auf Dateiebene an', () => {
    const quelle = `{/* slop-ok-datei: M20 Wörtliches Zitat aus fremdem Bestand */}
Im Original steht: "Kontexto ${GEVIERT} das Wortspiel".`;
    expect(pruefeInhalt('content/blog/probe.mdx', quelle)).toEqual([]);
  });

  it('lässt eine Rangspanne in Ruhe', () => {
    expect(mdxIds(`Rang 1${HALBGEVIERT}500 gilt als nah.`)).not.toContain('M20');
  });

  it('prüft die Tailwind-Regeln nicht gegen Prosa', () => {
    // M5 und M9 greifen nur in `.tsx` und `.css`. Ein Beitrag, der die Klasse erklärt, ist
    // kein Verstoss.
    expect(mdxIds('Die Klasse `transition-all` animiert jede Eigenschaft.')).not.toContain('M5');
  });
});

describe('verify-slop: die Pfad-Ausnahmen', () => {
  it('lässt einen hohen Schatten im Overlay-Baustein zu', () => {
    expect(pruefeInhalt('components/ui/chart.tsx', '<div className="border shadow-xl" />')).toEqual([]);
  });

  it('meldet denselben Schatten außerhalb der Overlay-Bausteine', () => {
    expect(pruefeInhalt('components/ui/stat-card.tsx', '<div className="border shadow-xl" />').map((b) => b.id))
      .toContain('M8');
  });

  it('lässt den ganzflächigen Seitenhintergrund zu', () => {
    expect(pruefeInhalt('app/(auth)/auth-background.css', 'background: linear-gradient(to bottom, from-blue-500 to-purple-600);'))
      .toEqual([]);
  });
});

describe('verify-slop: Struktur der Regeln', () => {
  it('jede Regel hat Id, Schwere, Name, Fix und mindestens ein Muster', () => {
    for (const regel of RULES) {
      expect(regel.id, 'Id fehlt').toMatch(/^M\d+[a-z]?$/);
      expect(['hoch', 'mittel'], `${regel.id}: unbekannte Schwere`).toContain(regel.schwere);
      expect(regel.name.length, `${regel.id}: Name fehlt`).toBeGreaterThan(3);
      // Der Fix-Satz ist Pflicht: ein Befund ohne Weg heraus wird ignoriert, nicht behoben.
      expect(regel.fix.length, `${regel.id}: Fix-Satz fehlt`).toBeGreaterThan(10);
      expect(regel.patterns.length, `${regel.id}: kein Muster`).toBeGreaterThan(0);
    }
  });

  it('vergibt keine Id doppelt', () => {
    const alle = RULES.map((r) => r.id);
    expect(new Set(alle).size).toBe(alle.length);
  });

  it('hatBegruendung verlangt mindestens acht Zeichen Text', () => {
    expect(hatBegruendung(['// slop-ok: kurz'], 0, 'M1')).toBe(false);
    expect(hatBegruendung(['// slop-ok: ein tragfähiger Grund'], 0, 'M1')).toBe(true);
  });
});
