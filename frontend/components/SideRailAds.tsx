"use client";

import { usePathname } from "next/navigation";
import { AdUnit } from "@/components/AdUnit";
import { AD_SLOTS } from "@/lib/adsense";

/**
 * Vertikale Side-Rail-Anzeigen links und rechts neben dem (schmalen, `max-w-lg`)
 * Spielinhalt. Nur auf den Spiel-Seiten aktiv – Content-, Rechts- und
 * Admin-Seiten bleiben werbefrei. Erst ab `xl` (≥ 1280px) sichtbar, darunter
 * (Mobile/Tablet) komplett ausgeblendet, damit es keine Überlappung mit dem
 * zentrierten Inhalt gibt.
 *
 * Wird einmal im Root-Layout gemountet; `key={pathname}` erzwingt pro Route eine
 * frische Anzeige.
 */
function isGameRoute(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return false;
  return (
    pathname === "/" ||
    pathname.startsWith("/wordle") ||
    pathname.startsWith("/duel")
  );
}

export function SideRailAds() {
  const pathname = usePathname();

  if (!pathname || !isGameRoute(pathname)) return null;
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
