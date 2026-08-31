"use client";

import type { ReactNode } from "react";
import {
  ArrowLeft,
  EllipsisVertical,
  BookOpen,
  Dices,
  Swords,
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
import { useFeatureDiscovery } from "@/lib/feature-discovery";

interface WordleHeaderProps {
  /** Spielanleitung öffnen */
  onHelp?: () => void;
  /** Zufallsspiel starten */
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
  /** Blendet den "Duell erstellen"-Menüpunkt aus */
  hideDuelCreate?: boolean;
}

/**
 * Wördle-Header im Kontexto-Stil: zentrierter Titel, keine Trennlinie, alle
 * Aktionen gebündelt in einem 3-Punkte-Dropdown. Repliziert bewusst die Hülle
 * von `components/Header.tsx`, zeigt aber Wördle-eigene Menüpunkte, beide
 * Spiele bleiben so entkoppelt bei identischem Erscheinungsbild.
 */
export default function WordleHeader({
  onHelp,
  onRandom,
  onStats,
  onSettings,
  onCopyLink,
  subtitle,
  backHref,
  hideDuelCreate,
}: WordleHeaderProps) {
  const showDuelCreate = !hideDuelCreate;
  const { highlight: duelHighlight, dismiss: dismissDuelHighlight } =
    useFeatureDiscovery("wordle_duel_discovered");
  const showDuelHighlight = showDuelCreate && duelHighlight;
  const hasPrimaryItems =
    Boolean(onHelp) || Boolean(onRandom) || showDuelCreate || Boolean(onStats);
  const hasMenu = hasPrimaryItems || Boolean(onSettings);

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
        <div className="flex items-center gap-1 text-[20px] font-bold tracking-wider">
          <Link href="/" className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300">
            KONTEXTO
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <Link href="/wordle">WÖRDLE</Link>
        </div>
        {(onCopyLink || hasMenu) && (
          <div className="absolute right-4 flex items-center gap-0.5">
            {onCopyLink && <ShareLinkButton onClick={onCopyLink} />}
            {hasMenu && (
            <DropdownMenu onOpenChange={(open) => { if (!open && showDuelHighlight) dismissDuelHighlight(); }}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10"
                  aria-label={showDuelHighlight ? "Menü, neue Funktion: Duell" : "Menü"}
                >
                  <EllipsisVertical className="h-6! w-6!" />
                  {showDuelHighlight && (
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
                {onRandom && (
                  <DropdownMenuItem onClick={onRandom}>
                    <Dices className="h-4 w-4" />
                    Zufallsspiel
                  </DropdownMenuItem>
                )}
                {showDuelCreate && (
                  <DropdownMenuItem asChild className={showDuelHighlight ? "bg-primary/5 focus:bg-primary/10" : undefined}>
                    <Link href="/wordle/duel/create">
                      <Swords className="h-4 w-4" />
                      Duell erstellen
                      {showDuelHighlight && (
                        <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                          NEU
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                )}
                {onStats && (
                  <DropdownMenuItem onClick={onStats}>
                    <BarChart3 className="h-4 w-4" />
                    Statistik
                  </DropdownMenuItem>
                )}
                {onSettings && hasPrimaryItems && <DropdownMenuSeparator />}
                {onSettings && (
                  <DropdownMenuItem onClick={onSettings}>
                    <Settings className="h-4 w-4" />
                    Einstellungen
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        )}
      </div>
      {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
    </header>
  );
}
