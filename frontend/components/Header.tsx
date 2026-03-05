"use client";
import { useEffect, useState } from "react";
import {
  EllipsisVertical,
  Lightbulb,
  Flag,
  BookOpen,
  CircleHelp,
  Settings,
  Info,
  History,
  Shield,
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
        <h1 className="text-[24px] font-bold tracking-wider">KONTEXTO</h1>
      <div className="absolute right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Menü">
              <EllipsisVertical className="h-6! w-6!" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onTip} disabled={tipDisabled}>
              <Lightbulb className="h-4 w-4" />
              Tipp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onGiveUp} disabled={giveUpDisabled} className="text-destructive focus:text-destructive">
              <Flag className="h-4 w-4" />
              Aufgeben
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onHowToPlayOpen}>
              <BookOpen className="h-4 w-4" />
              Spielanleitung
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onFAQOpen}>
              <CircleHelp className="h-4 w-4" />
              FAQ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPastGamesOpen}>
              <History className="h-4 w-4" />
              Vergangene Spiele
            </DropdownMenuItem>
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
      {showCountdown && (
        <p className="text-xs text-muted-foreground mt-1">Nächstes Rätsel in: {countdown}</p>
      )}
    </header>
  );
}
