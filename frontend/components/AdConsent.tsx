"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  adConsentEvent, isAdConsentRequired, subscribeAdConsentReopen, writeAdConsent, type AdConsentChoice,
} from "@/lib/ad-consent";
import { reportAdConsent } from "@/lib/analytics";
import { ADCASH_ENABLED, isAdcashLoaded, isAdcashPath } from "@/lib/adcash";
import { useAdConsent } from "@/lib/use-ad-consent";

/** Banner copy. Changing what it says about processing requires bumping AD_CONSENT_VERSION. */
const COPY = {
  /** Landmark name of the bottom banner, read by screen readers; it names the subject. */
  region: "Werbung auf Kontexto",
  /** Visible heading of the blocking dialog. The text right under it (`what`) names ads and Adcash. */
  title: "Kontexto bleibt kostenlos",
  lead: "Kurz ehrlich:",
  what:
    " Kontexto kostet dich nix, uns aber Server und Zeit. Wenn du akzeptierst, zeigt unser " +
    "Partner Adcash auf den Spielseiten Werbung in gekennzeichneten Flächen: Banner und kleine " +
    "Videos, die stumm starten und sich wegklicken lassen. Keine Pop-ups, kein Vollbild, keine " +
    "Weiterleitung ohne Klick. Dafür speichert Adcash Kennungen auf deinem Gerät. " +
    "Sagst du nein, spielst du ganz normal weiter. ",
  policy: "Details",
  privacy: "Datenschutz",
  imprint: "Impressum",
  granted: "Aktuell akzeptiert.",
  denied: "Aktuell abgelehnt.",
  close: "Einstellungen schließen, Auswahl bleibt",
  reject: "Ablehnen",
  accept: "Akzeptieren",
} as const;

let shownReported = false;
let requiredReported = false;

/** Longest a revocation waits for its beacon before it takes effect. */
const REVOKE_REPORT_WAIT_MS = 800;

/**
 * Pages that never show the banner. The stream overlay is a browser source in
 * OBS that nobody can click, and the admin dashboard is a tool, not a page
 * with visitors.
 */
function isBannerHiddenPath(pathname: string | null): boolean {
  return pathname !== null && (pathname.startsWith("/live/overlay") || pathname.startsWith("/admin"));
}

/**
 * Pages on which an unanswered banner never blocks, even for a returning
 * player: the pages a visitor must be able to read before deciding (DSK
 * guidance: imprint and privacy policy stay reachable), and the stream mode,
 * whose board a streamer shows to an audience that cannot click it away.
 */
const NEVER_BLOCKING_PREFIXES = [
  "/impressum", "/datenschutz", "/cookies", "/nutzungsbedingungen", "/kontakt", "/live",
] as const;

function isNeverBlockingPath(pathname: string | null): boolean {
  return pathname !== null && NEVER_BLOCKING_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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
 * - A first visit is never blocked: the banner sits at the bottom and the game
 *   stays playable without an answer. A returning player who has still not
 *   answered (`isAdConsentRequired`) gets the same two buttons as a dialog
 *   that asks for a choice. That is not a cookie wall, because "Ablehnen"
 *   opens the page exactly as fast as "Akzeptieren" (EDPB guidelines 05/2020
 *   object to access that depends on a yes, not to a question that needs an
 *   answer), and the dialog links the privacy policy and the imprint, which
 *   themselves never block.
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
  const [required, setRequired] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const textId = useId();

  // Evaluated on each route, never while one is open: a round in progress is
  // not interrupted, the question comes with the next page. Reading storage
  // happens in the effect, because the static export renders without it.
  useEffect(() => {
    if (!ADCASH_ENABLED || choice !== "unset" || isNeverBlockingPath(pathname)) {
      setRequired(false);
      return;
    }
    let result = false;
    try {
      result = isAdConsentRequired(window.localStorage);
    } catch {
      result = false;
    }
    setRequired(result);
  }, [choice, pathname]);

  useEffect(() => {
    if (!ADCASH_ENABLED) return;
    return subscribeAdConsentReopen(() => setReopened(true));
  }, []);

  useEffect(() => {
    if (reopened) regionRef.current?.focus();
  }, [reopened]);

  // Counts that the first ask was on screen, once per page load. The server
  // dedups per visitor as well; this only keeps a client-side navigation from
  // sending the same beacon again.
  const firstAsk = ADCASH_ENABLED && choice === "unset" && !isBannerHiddenPath(pathname);
  useEffect(() => {
    if (!firstAsk || shownReported) return;
    shownReported = true;
    void reportAdConsent("shown");
  }, [firstAsk]);

  const blocking = firstAsk && required && !reopened;
  useEffect(() => {
    if (!blocking || requiredReported) return;
    requiredReported = true;
    void reportAdConsent("required");
  }, [blocking]);

  useEffect(() => {
    if (!ADCASH_ENABLED || choice === "server") return;
    const eligible = isAdcashPath(pathname);
    if (isAdcashLoaded() && (choice !== "granted" || !eligible)) {
      window.location.reload();
    }
  }, [choice, pathname]);

  if (!ADCASH_ENABLED || choice === "server" || isBannerHiddenPath(pathname)) return null;
  if (choice !== "unset" && !reopened) return null;

  const decide = async (next: AdConsentChoice) => {
    const event = adConsentEvent(choice, next);
    // A revocation with Adcash loaded reloads the page (effect above), so its
    // beacon is sent before the choice is written. The wait is capped: a slow
    // network may lose the count, it must never delay the revocation.
    if (event === "revoked") {
      await Promise.race([
        reportAdConsent(event),
        new Promise<void>((resolve) => window.setTimeout(resolve, REVOKE_REPORT_WAIT_MS)),
      ]);
    } else if (event) {
      void reportAdConsent(event);
    }
    writeAdConsent(next);
    setReopened(false);
  };

  if (blocking) {
    return (
      <AlertDialog open>
        <AlertDialogContent
          data-testid="ad-consent"
          data-blocking="true"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{COPY.title}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{COPY.lead}</span>
              {COPY.what}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-small">
            <Link href="/datenschutz/#werbung-adcash" className="underline underline-offset-2 hover:no-underline">
              {COPY.privacy}
            </Link>
            <Link href="/impressum/" className="underline underline-offset-2 hover:no-underline">
              {COPY.imprint}
            </Link>
          </p>
          <AlertDialogFooter className="flex-row gap-2">
            <Button type="button" variant="outline" className="h-10 flex-1 sm:px-5" onClick={() => void decide("denied")}>
              {COPY.reject}
            </Button>
            <Button type="button" className="h-10 flex-1 sm:px-5" onClick={() => void decide("granted")}>
              {COPY.accept}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

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
        <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none sm:px-5" onClick={() => void decide("denied")}>
          {COPY.reject}
        </Button>
        <Button type="button" className="h-10 flex-1 sm:flex-none sm:px-5" onClick={() => void decide("granted")}>
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
