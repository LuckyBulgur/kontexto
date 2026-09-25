"use client";

import { useEffect, useState } from "react";

/**
 * Footer link "Cookie-Einstellungen" that reopens the consent message of
 * Google's CMP, so visitors can change or withdraw their consent at any time
 * (GDPR Art. 7(3)).
 *
 * Google injects the `googlefc` API only once a privacy message (CMP) is
 * published in the AdSense dashboard. While it is unavailable (before that
 * setup, or outside the EU without a consent flow) the link is not rendered,
 * so it never becomes a dead click.
 *
 * References:
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
    // The CMP loads asynchronously after the AdSense loader, so wait briefly.
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (window.googlefc?.showRevocationMessage) {
        setAvailable(true);
        window.clearInterval(id);
      } else if (tries >= 30) {
        // About 15 s without a CMP: no consent to withdraw, the link stays hidden.
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
