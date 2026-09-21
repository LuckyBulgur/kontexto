"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  EllipsisVertical,
  BookOpen,
  LayoutGrid,
  BarChart3,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ShareLinkButton from "@/components/ShareLinkButton";
import WordleModeDialog from "@/components/wordle/WordleModeDialog";
import { useFeatureDiscovery } from "@/lib/feature-discovery";
import { WordmarkName } from "@/components/design";

interface WordleHeaderProps {
  /** Spielanleitung öffnen */
  onHelp?: () => void;
  /** Zufallsspiel starten, falls diese Seite eines kennt */
  onRandom?: () => void;
  /** Statistik öffnen */
  onStats?: () => void;
  /** Einstellungen öffnen */
  onSettings?: () => void;
  /** Duell-Link kopieren */
  onCopyLink?: () => void;
  /** Zentrierte Unterzeile unter dem Titel (z. B. Duell-/Random-Kontext) */
  subtitle?: ReactNode;
  /** Zeigt einen Zurück-Pfeil links und verlinkt dorthin */
  backHref?: string;
}

/**
 * Wördle-Header im Kontexto-Stil: zentrierter Titel, keine Trennlinie, alle
 * Aktionen gebündelt in einem 3-Punkte-Dropdown. Repliziert bewusst die Hülle
 * von `components/Header.tsx`, zeigt aber Wördle-eigene Menüpunkte, beide
 * Spiele bleiben so entkoppelt bei identischem Erscheinungsbild.
 *
 * Every way into another round sits behind one entry, the mode dialog. The menu
 * used to list the random round and the duel separately, and the Wordle duel
 * additionally hung in the Kontexto picker, which offered a round of the other
 * game from a Kontexto board.
 */
export default function WordleHeader({
  onHelp,
  onRandom,
  onStats,
  onSettings,
  onCopyLink,
  subtitle,
  backHref,
}: WordleHeaderProps) {
  const [showModes, setShowModes] = useState(false);
  // The badge used to sit on the duel entry. That entry is now one of three in
  // the dialog, so the hint moves to the door in front of it.
  const { highlight: modesHighlight, dismiss: dismissModesHighlight } =
    useFeatureDiscovery("wordle_duel_discovered");

  return (
    <header className="relative flex flex-col items-center px-4 pt-5 pb-1">
      <div className="relative flex items-center justify-center w-full">
        {backHref && (
          <a href={backHref} className="absolute left-4">
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Zurück">
              <ArrowLeft className="h-6! w-6!" />
            </Button>
          </a>
        )}
        <div className="flex items-center gap-1.5 font-display text-h3 font-extrabold tracking-tight">
          <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
            <WordmarkName name="Kontexto" />
          </Link>
          <span className="text-border" aria-hidden="true">/</span>
          <Link href="/wordle/">Wördle</Link>
        </div>
        <div className="absolute right-4 flex items-center gap-0.5">
          {onCopyLink && <ShareLinkButton onClick={onCopyLink} />}
          <DropdownMenu onOpenChange={(open) => {
            if (!open && modesHighlight) dismissModesHighlight();
          }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10"
                aria-label={
                  modesHighlight ? "Menü, neue Funktion: weitere Spielmodi" : "Menü"
                }
              >
                <EllipsisVertical className="h-6! w-6!" />
                {modesHighlight && (
                  <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onHelp && (
                <DropdownMenuItem onClick={onHelp}>
                  <BookOpen className="h-4 w-4" />
                  Spielanleitung
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setShowModes(true)}
                className={modesHighlight ? "bg-primary/5 focus:bg-primary/10" : undefined}
              >
                <LayoutGrid className="h-4 w-4" />
                Spielmodi
                {modesHighlight && (
                  <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-micro font-semibold leading-none text-primary-foreground">
                    NEU
                  </span>
                )}
              </DropdownMenuItem>
              {onStats && (
                <DropdownMenuItem onClick={onStats}>
                  <BarChart3 className="h-4 w-4" />
                  Statistik
                </DropdownMenuItem>
              )}
              {onSettings && <DropdownMenuSeparator />}
              {onSettings && (
                <DropdownMenuItem onClick={onSettings}>
                  <Settings className="h-4 w-4" />
                  Einstellungen
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {subtitle && <div className="text-small text-muted-foreground mt-1">{subtitle}</div>}
      <WordleModeDialog
        open={showModes}
        onClose={() => setShowModes(false)}
        onRandom={onRandom}
      />
    </header>
  );
}
