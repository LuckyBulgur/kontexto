"use client";
import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Einziger Ort für Daniels TikTok-Link – wird auch vom Relaunch-Hinweis
 * (`RelaunchContent.tsx`) importiert, damit es nur eine Quelle der Wahrheit gibt.
 */
export const DANIEL_TIKTOK_URL = "https://www.tiktok.com/@danielschueler";
const DANIEL_NAME = "Daniel Schüler";

/** TikTok-Glyphe (Simple Icons), 24×24 – konsistent mit den Social-Icons im Footer. */
const TIKTOK_ICON_PATH =
  "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";

/**
 * Kleine „Danke"-Card (Herz + Name). Öffnet einen Dialog mit persönlichem Dank
 * und Weiterleitung auf Daniels TikTok-Profil. Selbstständig (eigener State),
 * damit sie ohne Prop-Drilling überall eingesetzt werden kann. Die Positionierung
 * gibt der aufrufende Kontext über `className` vor (z. B. `ml-auto` in der
 * Statuszeile, um die Card nach ganz rechts zu schieben).
 */
export default function DanielTribute({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Danke an ${DANIEL_NAME} – mehr erfahren`}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium normal-case text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          className,
        )}
      >
        <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" aria-hidden />
        <span className="hidden sm:inline">{DANIEL_NAME}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Heart className="h-5 w-5 fill-rose-500 text-rose-500" aria-hidden />
              Danke, Daniel!
            </DialogTitle>
            <DialogDescription className="sr-only">
              Dankeschön an {DANIEL_NAME}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
            <p>
              Dieses Spiel hat durch dich einen riesigen Aufwind bekommen. Deine
              Unterstützung auf TikTok hat Kontexto bekannt gemacht und diesen
              kompletten Neustart überhaupt erst möglich gemacht.
            </p>
            <p>
              Schaut unbedingt bei ihm vorbei, unterstützt ihn und folgt ihm auf
              TikTok. Er hat es sich mehr als verdient.
            </p>

            <Button asChild className="w-full">
              <a
                href={DANIEL_TIKTOK_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d={TIKTOK_ICON_PATH} />
                </svg>
                @danielschueler auf TikTok
              </a>
            </Button>

            <p className="pt-1 text-left text-lg font-semibold text-foreground">~ Ugur</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
