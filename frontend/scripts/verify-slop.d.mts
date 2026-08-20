/**
 * Typen für `verify-slop.mjs`, damit die Tests unter `tsc` durchlaufen.
 *
 * Das Prüfwerkzeug selbst bleibt reines ESM ohne Buildschritt: es läuft über `node` in einem
 * pnpm-Skript und soll das auch ohne Transpilation tun. Die Deklaration hier bildet nur die
 * Oberfläche ab, die der Test benutzt.
 */

export interface SlopRegel {
  id: string;
  schwere: 'hoch' | 'mittel';
  name: string;
  fix: string;
  files?: RegExp;
  notIf?: RegExp[];
  boxOnly?: boolean;
  patterns: RegExp[];
}

export interface SlopBefund {
  id: string;
  schwere: 'hoch' | 'mittel';
  name: string;
  fix: string;
  file: string;
  line: number;
  text: string;
}

export interface SlopAusnahme {
  rule: RegExp;
  path: RegExp;
  grund: string;
}

export declare const RULES: SlopRegel[];
export declare const ALLOW: SlopAusnahme[];

/** Entfernt Kommentare, erhält Zeilenumbrüche, damit Zeilennummern stimmen. */
export declare function ohneKommentare(quelle: string): string;

/** Steht in dieser oder der vorigen Zeile eine `slop-ok`-Begründung für diese Regel-ID? */
export declare function hatBegruendung(
  zeilen: string[],
  index: number,
  id: string,
  codeZeilen?: string[] | null,
): boolean;

/** Regel-IDs, die eine `slop-ok-datei`-Direktive für die ganze Datei freigibt. */
export declare function dateiBegruendungen(inhalt: string): Set<string>;

/** Prüft den Inhalt einer Datei und liefert die Befunde. */
export declare function pruefeInhalt(relPfad: string, inhalt: string): SlopBefund[];
