"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  EllipsisVertical,
  BookOpen,
  ChevronRight,
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
import ModesButton from "@/components/ModesButton";
import WordleModeDialog from "@/components/wordle/WordleModeDialog";
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
  const pathname = usePathname();
  const [showModes, setShowModes] = useState(false);

  return (
    <header className="relative flex flex-col items-center px-4 pt-5 pb-1">
      {/* Same three slots as components/Header.tsx, and for the same reason. */}
      <div className="flex w-full items-center gap-1">
        <div className="flex flex-1 basis-0 items-center">
          {backHref && (
            <a href={backHref}>
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Zurück">
                <ArrowLeft className="h-6! w-6!" />
              </Button>
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 font-display text-lead font-extrabold tracking-tight sm:text-h3">
          <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
            <WordmarkName name="Kontexto" />
          </Link>
          <span className="text-border" aria-hidden="true">/</span>
          <Link href="/wordle/">Wördle</Link>
        </div>
        <div className="flex flex-1 basis-0 items-center justify-end gap-0.5">
          {onCopyLink && <ShareLinkButton onClick={onCopyLink} />}
          <ModesButton
            onOpen={() => setShowModes(true)}
            hintKey="wordle_modes_button_discovered"
            hintEnabled={pathname === "/wordle/"}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Menü">
                <EllipsisVertical className="h-6! w-6!" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onHelp && (
                <DropdownMenuItem onClick={onHelp}>
                  <BookOpen className="h-4 w-4" />
                  Spielanleitung
                </DropdownMenuItem>
              )}
              {/* Same weighting as in the Kontexto menu: the entry that leads
                  to another round carries the accent, the upkeep entries do
                  not. */}
              <DropdownMenuItem
                onClick={() => setShowModes(true)}
                className="relative overflow-hidden bg-primary font-semibold text-primary-foreground focus:bg-primary focus:text-primary-foreground"
              >
                {/* Same two corner circles as in the Kontexto menu. */}
                <span
                  className="pointer-events-none absolute -left-3 -top-4 h-9 w-9 rounded-full bg-primary-foreground/15"
                  aria-hidden
                />
                <span
                  className="pointer-events-none absolute -bottom-5 -right-2 h-11 w-11 rounded-full bg-primary-foreground/10"
                  aria-hidden
                />
                <LayoutGrid className="relative h-4 w-4" />
                <span className="relative">Spielmodi</span>
                <ChevronRight className="relative ml-auto h-4 w-4 opacity-80" />
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
