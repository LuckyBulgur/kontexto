"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { Newspaper, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RELAUNCH_DESCRIPTION,
  RELAUNCH_TITLE,
  RelaunchBody,
} from "@/components/RelaunchContent";
import { useRelaunch } from "@/components/RelaunchProvider";

/**
 * Relaunch-Hinweis in zwei voneinander unabhängigen Darstellungen, gesteuert über
 * {@link useRelaunch}:
 *
 * - **Desktop (≥ lg):** dezente Floating-Card unten rechts (nicht-modal, ohne
 *   Overlay), bei Erstbesuch automatisch ausgeklappt. X minimiert sie zum runden
 *   Newspaper-Button; der Button klappt sie wieder aus.
 * - **Mobile (< lg):** keine Card/kein Button – erreichbar über den Menü-Eintrag im
 *   `Header`, der diesen zentrierten Dialog öffnet. Das Overlay ist leicht
 *   verschwommen.
 */
export function RelaunchAnnouncement() {
  const { expanded, mobileOpen, expand, minimize, closeMobile } = useRelaunch();

  return (
    <>
      {/* Desktop: Floating-Card bzw. minimierter Button (reine CSS-Sichtbarkeit). */}
      <div className="hidden lg:block">
        {expanded ? (
          <section
            role="region"
            aria-label="Neuigkeiten zum Relaunch"
            className="fixed right-6 bottom-6 z-40 w-96 rounded-lg border bg-background p-4 shadow-lg duration-200 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none sm:p-6"
          >
            <div className="flex flex-col gap-2 pr-7">
              <h2 className="text-lg leading-none font-semibold">{RELAUNCH_TITLE}</h2>
              <p className="text-sm text-muted-foreground">{RELAUNCH_DESCRIPTION}</p>
            </div>
            <div className="mt-4">
              <RelaunchBody />
            </div>
            <button
              type="button"
              onClick={minimize}
              aria-label="Hinweis minimieren"
              className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <XIcon className="size-4" />
              <span className="sr-only">Hinweis minimieren</span>
            </button>
          </section>
        ) : (
          <button
            type="button"
            onClick={expand}
            aria-label="Neuigkeiten zum Relaunch anzeigen"
            className="fixed right-6 bottom-6 z-40 flex size-12 items-center justify-center rounded-full border bg-background text-foreground shadow-lg transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Newspaper className="size-5" />
          </button>
        )}
      </div>

      {/* Mobile: zentrierter Dialog, nur über den Menü-Eintrag erreichbar. */}
      <Dialog
        open={mobileOpen}
        onOpenChange={(next) => {
          if (!next) closeMobile();
        }}
      >
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-[12.8px] lg:hidden" />
          <DialogPrimitive.Content
            className={cn(
              "fixed top-[50%] left-[50%] z-50 grid w-[calc(100%-3rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-4 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg sm:p-6 lg:hidden",
            )}
          >
            <DialogHeader>
              <DialogTitle>{RELAUNCH_TITLE}</DialogTitle>
              <DialogDescription>{RELAUNCH_DESCRIPTION}</DialogDescription>
            </DialogHeader>
            <RelaunchBody />
            <DialogPrimitive.Close
              aria-label="Schließen"
              className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <XIcon />
              <span className="sr-only">Schließen</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}
