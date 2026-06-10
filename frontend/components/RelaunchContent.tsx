/**
 * Gemeinsamer Text des Relaunch-Hinweises – ein Wartungsort für beide Darstellungen
 * (Desktop-Floating-Card und Mobile-Dialog). Titel und Beschreibung werden als
 * Konstanten exportiert, damit jede Oberfläche sie in ihre eigene semantische
 * Hülle (Card-Heading bzw. `DialogTitle`/`DialogDescription`) setzen kann.
 */

export const RELAUNCH_TITLE = "Neustart – Schluss mit Namen als Lösungswörter";
export const RELAUNCH_DESCRIPTION =
  "Der Algorithmus hinter den Lösungswörtern wurde komplett neu gebaut.";

import { DANIEL_TIKTOK_URL } from "@/components/DanielTribute";

/** Reiner Fließtext-Body ohne eigenen State oder Wrapper. */
export function RelaunchBody() {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>
        Ab sofort tauchen{" "}
        <strong className="font-medium text-foreground">keine nervigen Namen</strong> mehr als
        Lösung auf – nur noch echte deutsche Wörter, die wirklich jeder kennt. Deshalb startet das
        Spiel wieder bei <strong className="font-medium text-foreground">Tag&nbsp;1</strong>.
      </p>
      <p>
        Riesigen Dank an alle für euer Feedback – ganz besonders an{" "}
        <a
          href={DANIEL_TIKTOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
        >
          @danielschueler auf TikTok
        </a>
        . Ihr habt diesen Neustart möglich gemacht!
      </p>
    </div>
  );
}
