"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscribeAdConsentReopen, writeAdConsent, type AdConsentChoice } from "@/lib/ad-consent";
import { ADCASH_ENABLED, isAdcashLoaded, isAdcashPath } from "@/lib/adcash";
import { useAdConsent } from "@/lib/use-ad-consent";

/** Banner copy. Changing what it says about processing requires bumping AD_CONSENT_VERSION. */
const COPY = {
  region: "Werbung auf Kontexto",
  lead: "Kurz ehrlich:",
  what:
    " Kontexto kostet dich nix, uns aber Server und Zeit. Wenn du akzeptierst, zeigt unser " +
    "Partner Adcash auf den Spielseiten ein, zwei Banner am Rand. Keine Pop-ups, keine Videos, " +
    "nichts, was dich beim Raten stört. Dafür speichert Adcash Kennungen auf deinem Gerät. " +
    "Sagst du nein, spielst du ganz normal weiter. ",
  policy: "Details",
  granted: "Aktuell akzeptiert.",
  denied: "Aktuell abgelehnt.",
  close: "Einstellungen schließen, Auswahl bleibt",
  reject: "Ablehnen",
  accept: "Akzeptieren",
} as const;

/**
 * Pages that never show the banner. The stream overlay is a browser source in
 * OBS that nobody can click, and the admin dashboard is a tool, not a page
 * with visitors.
 */
function isBannerHiddenPath(pathname: string | null): boolean {
  return pathname !== null && (pathname.startsWith("/live/overlay") || pathname.startsWith("/admin"));
}

/**
 * Consent banner for Adcash, mounted once in the root layout. The slots that
 * load the script live in `components/AdcashSlots.tsx`.
 *
 * Legal frame, and where each part of it is implemented:
 * - Nothing optional runs before a decision: the script is injected only for
 *   a stored "granted" and only on an Adcash page (`AdcashSlots`).
 * - Rejecting is as easy as accepting: both buttons sit side by side on the
 *   first layer, same height, same text size, the refusal outlined and fully
 *   legible (DSK guidance for telemedia providers, Higher Regional Court of
 *   Cologne, 2024-01-19, 6 U 80/23). The grant carries the fill: the EDPB
 *   cookie banner taskforce (report of 2023-01-17) judges colour case by case
 *   and objects to a refusal that is hard to see, not to an accent on the
 *   grant. No close button on the first ask, because closing without a choice
 *   is not a choice.
 * - The banner does not block the page. The game stays playable without an
 *   answer, which is what makes the consent voluntary.
 * - Revocation takes effect technically: the Adcash storage keys are removed
 *   and the page reloads, because a loaded ad script cannot be unloaded.
 *
 * The same reload keeps the scope promise. A loaded aclib.js keeps running in
 * the document after a client-side navigation from `/` to a content page, so
 * leaving an Adcash page with the script loaded turns into a full page load of
 * the destination.
 */
export default function AdConsent() {
  const pathname = usePathname();
  const choice = useAdConsent();
  const [reopened, setReopened] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const textId = useId();

  useEffect(() => {
    if (!ADCASH_ENABLED) return;
    return subscribeAdConsentReopen(() => setReopened(true));
  }, []);

  useEffect(() => {
    if (reopened) regionRef.current?.focus();
  }, [reopened]);

  useEffect(() => {
    if (!ADCASH_ENABLED || choice === "server") return;
    const eligible = isAdcashPath(pathname);
    if (isAdcashLoaded() && (choice !== "granted" || !eligible)) {
      window.location.reload();
    }
  }, [choice, pathname]);

  if (!ADCASH_ENABLED || choice === "server" || isBannerHiddenPath(pathname)) return null;
  if (choice !== "unset" && !reopened) return null;

  const decide = (next: AdConsentChoice) => {
    writeAdConsent(next);
    setReopened(false);
  };

  return (
    <div
      ref={regionRef}
      role="region"
      aria-label={COPY.region}
      aria-describedby={textId}
      tabIndex={-1}
      data-testid="ad-consent"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-xl bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-card-foreground shadow-lg outline-none sm:flex-row sm:items-center sm:gap-4 sm:px-4"
    >
      <p id={textId} className="flex-1 text-micro leading-snug text-muted-foreground sm:text-small">
        <span className="font-semibold text-foreground">{COPY.lead}</span>
        {COPY.what}
        <Link href="/datenschutz/#werbung-adcash" className="underline underline-offset-2 hover:no-underline">
          {COPY.policy}
        </Link>
        {choice !== "unset" && (
          <span className="ml-1 text-foreground">{choice === "granted" ? COPY.granted : COPY.denied}</span>
        )}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none sm:px-5" onClick={() => decide("denied")}>
          {COPY.reject}
        </Button>
        <Button type="button" className="h-10 flex-1 sm:flex-none sm:px-5" onClick={() => decide("granted")}>
          {COPY.accept}
        </Button>
        {choice !== "unset" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setReopened(false)}
            aria-label={COPY.close}
            className="size-10 shrink-0 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
