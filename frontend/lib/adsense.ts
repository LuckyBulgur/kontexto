/**
 * Zentrale Google-AdSense-Konfiguration.
 *
 * Die Publisher-ID ist bewusst fest verdrahtet (identisch mit dem Loader-Script
 * in `app/layout.tsx` und dem `google-adsense-account`-Verifizierungs-Meta-Tag).
 * Sie ist ohnehin öffentlich.
 *
 * Die einzelnen Ad-Slot-IDs stammen aus `NEXT_PUBLIC_*`-Umgebungsvariablen, die
 * bei diesem Static Export zur Build-Zeit inlined werden. Ist ein Slot nicht
 * gesetzt, rendert die zugehörige `<AdUnit>` nichts, unkonfigurierte
 * Platzierungen bleiben so ein sauberer No-op, ohne Platzhalter-IDs im Quellcode.
 *
 * Slots werden im AdSense-Dashboard unter „Ads → By ad unit“ angelegt; die
 * resultierenden `data-ad-slot`-Werte werden anschließend in der Build-Umgebung
 * gesetzt (siehe `.env.development` für die Variablennamen):
 *   NEXT_PUBLIC_AD_SLOT_KONTEXTO_RESULT
 *   NEXT_PUBLIC_AD_SLOT_WORDLE_RESULT
 *   NEXT_PUBLIC_AD_SLOT_RAIL_LEFT
 *   NEXT_PUBLIC_AD_SLOT_RAIL_RIGHT
 */

export const ADSENSE_CLIENT_ID = "ca-pub-3545758989514084";

export const AD_SLOTS = {
  kontextoResult: process.env.NEXT_PUBLIC_AD_SLOT_KONTEXTO_RESULT,
  wordleResult: process.env.NEXT_PUBLIC_AD_SLOT_WORDLE_RESULT,
  railLeft: process.env.NEXT_PUBLIC_AD_SLOT_RAIL_LEFT,
  railRight: process.env.NEXT_PUBLIC_AD_SLOT_RAIL_RIGHT,
} as const;
