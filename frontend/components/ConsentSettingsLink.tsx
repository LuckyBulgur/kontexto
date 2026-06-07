"use client";

import { useEffect, useState } from "react";

/**
 * Footer-Link „Cookie-Einstellungen", der das Einwilligungsbanner von Googles
 * CMP erneut öffnet, damit Nutzer ihre Einwilligung jederzeit ändern oder
 * widerrufen können (DSGVO Art. 7 Abs. 3).
 *
 * Die `googlefc`-API wird erst injiziert, sobald im AdSense-Dashboard eine
 * Datenschutz-Nachricht (CMP) veröffentlicht ist. Solange sie nicht verfügbar
 * ist (vor der Einrichtung, oder außerhalb der EU ohne Consent-Flow), wird der
 * Link gar nicht angezeigt – so entsteht nie ein toter Klick.
 *
 * Referenzen:
 * - https://support.google.com/adsense/answer/10959060
 * - https://developers.google.com/funding-choices/fc-api-docs
 */
export default function ConsentSettingsLink({ className }: { className?: string }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (window.googlefc?.showRevocationMessage) {
      setAvailable(true);
      return;
    }
    // Die CMP lädt asynchron nach dem AdSense-Loader – kurz darauf warten.
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (window.googlefc?.showRevocationMessage) {
        setAvailable(true);
        window.clearInterval(id);
      } else if (tries >= 30) {
        // ~15s ohne CMP → keine Einwilligung zu widerrufen, Link bleibt aus.
        window.clearInterval(id);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={() => window.googlefc?.showRevocationMessage?.()}
      className={className}
    >
      Cookie-Einstellungen
    </button>
  );
}
