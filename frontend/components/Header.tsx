"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  EllipsisVertical,
  Lightbulb,
  Flag,
  BookOpen,
  CircleHelp,
  Settings,
  Info,
  History,
  Shield,
  Swords,
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

interface HeaderProps {
  onTip: () => void;
  onGiveUp: () => void;
  onHowToPlayOpen: () => void;
  onFAQOpen: () => void;
  onSettingsOpen: () => void;
  onCreditsOpen: () => void;
  onPastGamesOpen: () => void;
  tipDisabled?: boolean;
  giveUpDisabled?: boolean;
  showCountdown?: boolean;
  /** Duel mode props */
  subtitle?: string;
  onCopyLink?: () => void;
  hideTip?: boolean;
  hideGiveUp?: boolean;
  hidePastGames?: boolean;
  hideDuelCreate?: boolean;
  backHref?: string;
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function Header({
  onTip,
  onGiveUp,
  onHowToPlayOpen,
  onFAQOpen,
  onSettingsOpen,
  onCreditsOpen,
  onPastGamesOpen,
  tipDisabled,
  giveUpDisabled,
  showCountdown,
  subtitle,
  onCopyLink,
  hideTip,
  hideGiveUp,
  hidePastGames,
  hideDuelCreate,
  backHref,
}: HeaderProps) {
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());

  useEffect(() => {
    if (!showCountdown) return;
    const interval = setInterval(() => setCountdown(getTimeUntilMidnight()), 1000);
    return () => clearInterval(interval);
  }, [showCountdown]);

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
        <h1 className="text-[24px] font-bold tracking-wider">KONTEXTO</h1>
      <div className="absolute right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Menü">
              <EllipsisVertical className="h-6! w-6!" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!hideTip && (
              <DropdownMenuItem onClick={onTip} disabled={tipDisabled}>
                <Lightbulb className="h-4 w-4" />
                Tipp
              </DropdownMenuItem>
            )}
            {!hideGiveUp && (
              <DropdownMenuItem onClick={onGiveUp} disabled={giveUpDisabled} className="text-destructive focus:text-destructive">
                <Flag className="h-4 w-4" />
                Aufgeben
              </DropdownMenuItem>
            )}
            {onCopyLink && (
              <DropdownMenuItem onClick={onCopyLink}>
                <Copy className="h-4 w-4" />
                Link kopieren
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onHowToPlayOpen}>
              <BookOpen className="h-4 w-4" />
              Spielanleitung
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onFAQOpen}>
              <CircleHelp className="h-4 w-4" />
              FAQ
            </DropdownMenuItem>
            {!hideDuelCreate && (
              <DropdownMenuItem asChild>
                <Link href="/duel/create/">
                  <Swords className="h-4 w-4" />
                  Duell erstellen
                </Link>
              </DropdownMenuItem>
            )}
            {!hidePastGames && (
              <DropdownMenuItem onClick={onPastGamesOpen}>
                <History className="h-4 w-4" />
                Vergangene Spiele
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSettingsOpen}>
              <Settings className="h-4 w-4" />
              Einstellungen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreditsOpen}>
              <Info className="h-4 w-4" />
              Credits
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/datenschutz">
                <Shield className="h-4 w-4" />
                Datenschutz
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
      {showCountdown && (
        <p className="text-xs text-muted-foreground mt-1">Nächstes Rätsel in: {countdown}</p>
      )}
    </header>
  );
}
