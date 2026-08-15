"use client";

import { usePathname } from "next/navigation";
import { AdUnit } from "@/components/AdUnit";
import { AD_SLOTS } from "@/lib/adsense";

/**
 * Vertikale Side-Rail-Anzeigen links und rechts neben dem (schmalen, `max-w-lg`)
 * Spielinhalt. Erst ab `xl` (≥ 1280px) sichtbar, darunter (Mobile/Tablet)
 * komplett ausgeblendet, damit es keine Überlappung mit dem zentrierten Inhalt
 * gibt.
 *
 * Anzeigen laufen ausschließlich auf den Einzelspieler-Spielseiten `/` und
 * `/wordle/`, die von echtem Publisher-Content umgeben sind. Bewusst werbefrei
 * bleiben: Content-, Rechts- und Admin-Seiten sowie alle flüchtigen,
 * inhaltsleeren Duell-/Koop-Lobby- und Live-Screens (Pfade unter `/duel`,
 * `/wordle/duel`, die Erstellen-Formulare und die noindex-Live-Räume). AdSense
 * untersagt Anzeigen auf Screens ohne Publisher-Content.
 *
 * Wird einmal im Root-Layout gemountet; `key={pathname}` erzwingt pro Route eine
 * frische Anzeige.
 */
function isAdEligibleRoute(pathname: string): boolean {
  return pathname === "/" || pathname === "/wordle/";
}

export function SideRailAds() {
  const pathname = usePathname();

  if (!pathname || !isAdEligibleRoute(pathname)) return null;
  if (!AD_SLOTS.railLeft && !AD_SLOTS.railRight) return null;

  return (
    <>
      {AD_SLOTS.railLeft && (
        <div className="hidden xl:block fixed left-4 top-1/2 z-10 -translate-y-1/2">
          <AdUnit
            key={`rail-left-${pathname}`}
            slot={AD_SLOTS.railLeft}
            fixed={{ width: 160, height: 600 }}
          />
        </div>
      )}
      {AD_SLOTS.railRight && (
        <div className="hidden xl:block fixed right-4 top-1/2 z-10 -translate-y-1/2">
          <AdUnit
            key={`rail-right-${pathname}`}
            slot={AD_SLOTS.railRight}
            fixed={{ width: 160, height: 600 }}
          />
        </div>
      )}
    </>
  );
}
