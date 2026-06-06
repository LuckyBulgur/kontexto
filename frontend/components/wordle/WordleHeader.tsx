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
  Copy,
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
 * von `components/Header.tsx`, zeigt aber Wördle-eigene Menüpunkte – beide
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
  const hasPrimaryItems =
    Boolean(onHelp) || Boolean(onRandom) || showDuelCreate || Boolean(onStats);
  const hasMenu = Boolean(onCopyLink) || hasPrimaryItems || Boolean(onSettings);

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
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            KONTEXTO
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <Link href="/wordle">WÖRDLE</Link>
        </div>
        {hasMenu && (
          <div className="absolute right-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Menü">
                  <EllipsisVertical className="h-6! w-6!" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onCopyLink && (
                  <DropdownMenuItem onClick={onCopyLink}>
                    <Copy className="h-4 w-4" />
                    Link kopieren
                  </DropdownMenuItem>
                )}
                {onCopyLink && hasPrimaryItems && <DropdownMenuSeparator />}
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
                  <DropdownMenuItem asChild>
                    <Link href="/wordle/duel/create">
                      <Swords className="h-4 w-4" />
                      Duell erstellen
                    </Link>
                  </DropdownMenuItem>
                )}
                {onStats && (
                  <DropdownMenuItem onClick={onStats}>
                    <BarChart3 className="h-4 w-4" />
                    Statistik
                  </DropdownMenuItem>
                )}
                {onSettings && (onCopyLink || hasPrimaryItems) && <DropdownMenuSeparator />}
                {onSettings && (
                  <DropdownMenuItem onClick={onSettings}>
                    <Settings className="h-4 w-4" />
                    Einstellungen
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
    </header>
  );
}
