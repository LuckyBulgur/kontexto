"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT_ID } from "@/lib/adsense";

interface AdUnitProps {
  /** `data-ad-slot`-Wert aus dem AdSense-Dashboard. Ohne Slot rendert nichts. */
  slot?: string;
  /** Responsives Anzeigenformat (Standard: "auto"). Bei `fixed` ignoriert. */
  format?: string;
  /** Volle Breite auf Mobilgeräten (nur im responsiven Modus). */
  fullWidthResponsive?: boolean;
  /** Feste Größe statt responsiv, z. B. für vertikale Side-Rails. */
  fixed?: { width: number; height: number };
  /** Reservierte Mindesthöhe gegen Layout-Shift (CLS) im responsiven Modus. */
  minHeight?: number;
  className?: string;
  /** Sichtbare Werbe-Kennzeichnung. */
  label?: string;
}

/**
 * Eine einzelne AdSense-Anzeigeneinheit.
 *
 * Robustheit:
 * - Ohne konfigurierten `slot` wird gar nichts gerendert (No-op, kein Markup).
 * - `pushedRef` verhindert ein doppeltes `push()` (React-19-StrictMode in Dev).
 * - Das von AdSense gesetzte `data-adsbygoogle-status`-Attribut wird geprüft, um
 *   bei einem Remount (z. B. erzwungen über `key` bei Client-Navigation) keinen
 *   `TagError` („already have ads") auszulösen.
 * - `try/catch` stellt sicher, dass geblockte Skripte / verweigerter Consent /
 *   noch nicht geladene Library die UI niemals brechen.
 *
 * Lebt eine `<AdUnit>` in einer über Navigationen hinweg gemounteten Komponente
 * (z. B. den Side-Rails im Root-Layout), sollte sie aufrufseitig mit
 * `key={pathname}` versehen werden, damit pro Route eine frische Anzeige geladen
 * wird.
 */
export function AdUnit({
  slot,
  format = "auto",
  fullWidthResponsive = true,
  fixed,
  minHeight = 280,
  className,
  label = "Anzeige",
}: AdUnitProps) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!slot || pushedRef.current) return;
    const ins = insRef.current;
    if (!ins) return;
    if (ins.getAttribute("data-adsbygoogle-status")) {
      pushedRef.current = true;
      return;
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      /* geblockt / Consent verweigert / nicht geladen: UI nie brechen */
    }
  }, [slot]);

  if (!slot) return null;

  const insStyle: React.CSSProperties = fixed
    ? { display: "inline-block", width: fixed.width, height: fixed.height }
    : { display: "block", minHeight };

  return (
    <div className={className} aria-hidden="true">
      <span className="block text-center text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </span>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={insStyle}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        {...(fixed
          ? {}
          : {
              "data-ad-format": format,
              "data-full-width-responsive": fullWidthResponsive ? "true" : "false",
            })}
      />
    </div>
  );
}
