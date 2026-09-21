"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  EllipsisVertical,
  Lightbulb,
  Flag,
  BookOpen,
  Settings,
  History,
  BarChart3,
  Infinity,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFeatureDiscovery } from "@/lib/feature-discovery";
import ShareLinkButton from "@/components/ShareLinkButton";
import ModePickerDialog from "@/components/ModePickerDialog";
import { WordmarkName } from "@/components/design";

interface HeaderProps {
  onTip: () => void;
  onGiveUp: () => void;
  onHowToPlayOpen: () => void;
  onSettingsOpen: () => void;
  onPastGamesOpen: () => void;
  onInfiniteStart?: () => void;
  onStatsOpen?: () => void;
  tipDisabled?: boolean;
  giveUpDisabled?: boolean;
  showCountdown?: boolean;
  /** Duel mode props */
  subtitle?: string;
  onCopyLink?: () => void;
  hideTip?: boolean;
  hideGiveUp?: boolean;
  hidePastGames?: boolean;
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
  onSettingsOpen,
  onPastGamesOpen,
  onInfiniteStart,
  onStatsOpen,
  tipDisabled,
  giveUpDisabled,
  showCountdown,
  subtitle,
  onCopyLink,
  hideTip,
  hideGiveUp,
  hidePastGames,
  backHref,
}: HeaderProps) {
  const pathname = usePathname();
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  // The picker is owned here rather than passed in: every client that renders
  // the menu would otherwise have to carry the same three lines of state.
  const [showModePicker, setShowModePicker] = useState(false);
  const { highlight: infiniteHighlight, dismiss: dismissInfiniteHighlight } =
    useFeatureDiscovery("kontexto_infinite_discovered");
  const showInfiniteHighlight = !!onInfiniteStart && infiniteHighlight;
  // Duel and koop used to sit in this menu as their own entries with their own
  // badge. They are modes, so they live behind the one door that shows every
  // mode, and the badge moved to that door with them.
  const { highlight: modesHighlight, dismiss: dismissModesHighlight } =
    useFeatureDiscovery("kontexto_modes_discovered");
  const showModesHighlight = modesHighlight;
  // Ping am Kebab, falls ein neuer Menüpunkt hervorgehoben werden soll.
  const showPing = showModesHighlight;
  // Der Unendlich-Button ist unter sm ausgeblendet, sein Hinweis wandert dort an den Kebab.
  const pingClass = showPing
    ? "flex"
    : showInfiniteHighlight
      ? "flex sm:hidden"
      : null;

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
        <div className="flex items-center gap-1.5 font-display text-h3 font-extrabold tracking-tight">
          <Link
            href="/"
            className={pathname.startsWith("/wordle") ? "text-muted-foreground transition-colors hover:text-foreground" : ""}
          >
            <WordmarkName name="Kontexto" />
          </Link>
          <span className="text-border" aria-hidden="true">/</span>
          <Link
            href="/wordle/"
            className={!pathname.startsWith("/wordle") ? "text-muted-foreground transition-colors hover:text-foreground" : ""}
          >
            Wördle
          </Link>
        </div>
      <div className="absolute right-4 flex items-center gap-0.5">
        {onCopyLink && <ShareLinkButton onClick={onCopyLink} />}
        {onInfiniteStart && (
          <Button
            variant="ghost"
            size="icon"
            className="relative hidden h-10 w-10 sm:inline-flex"
            aria-label={showInfiniteHighlight ? "Unendlich-Modus, neue Funktion" : "Unendlich-Modus"}
            onClick={() => {
              if (showInfiniteHighlight) dismissInfiniteHighlight();
              onInfiniteStart();
            }}
          >
            <Infinity className="h-6! w-6!" />
            {showInfiniteHighlight && (
              <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:hidden" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
            )}
          </Button>
        )}
        <DropdownMenu onOpenChange={(open) => {
          if (!open) {
            if (showInfiniteHighlight) dismissInfiniteHighlight();
            if (showModesHighlight) dismissModesHighlight();
          }
        }}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10"
              aria-label={
                showModesHighlight
                  ? "Menü, neue Funktion: weitere Spielmodi"
                  : showInfiniteHighlight
                    ? "Menü, neue Funktion: Unendlich-Modus"
                    : "Menü"
              }
            >
              <EllipsisVertical className="h-6! w-6!" />
              {pingClass && (
                <span
                  className={`absolute right-1.5 top-1.5 ${pingClass} h-2.5 w-2.5`}
                  aria-hidden
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
              )}
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onHowToPlayOpen}>
              <BookOpen className="h-4 w-4" />
              Spielanleitung
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowModePicker(true)}
              className={showModesHighlight ? "bg-primary/5 focus:bg-primary/10" : undefined}
            >
              <LayoutGrid className="h-4 w-4" />
              Spielmodi
              {showModesHighlight && (
                <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-micro font-semibold leading-none text-primary-foreground">
                  NEU
                </span>
              )}
            </DropdownMenuItem>
            {!hidePastGames && (
              <DropdownMenuItem onClick={onPastGamesOpen}>
                <History className="h-4 w-4" />
                Vergangene Spiele
              </DropdownMenuItem>
            )}
            {onInfiniteStart && (
              <DropdownMenuItem onClick={onInfiniteStart} className={showInfiniteHighlight ? "bg-primary/5 focus:bg-primary/10" : undefined}>
                <Infinity className="h-4 w-4" />
                Unendlich-Modus
                {showInfiniteHighlight && (
                  <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-micro font-semibold leading-none text-primary-foreground">
                    NEU
                  </span>
                )}
              </DropdownMenuItem>
            )}
            {onStatsOpen && (
              <DropdownMenuItem onClick={onStatsOpen}>
                <BarChart3 className="h-4 w-4" />
                Statistik
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSettingsOpen}>
              <Settings className="h-4 w-4" />
              Einstellungen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
      {subtitle && (
        // The subtitle names what this page is. It used to whisper under the
        // brand at 14px muted, which put the mode below the wordmark in rank.
        <p className="mt-1 font-display text-lead font-bold">{subtitle}</p>
      )}
      {showCountdown && (
        <p className="text-micro text-muted-foreground mt-1">Nächstes Rätsel in: {countdown}</p>
      )}
      <ModePickerDialog open={showModePicker} onClose={() => setShowModePicker(false)} />
    </header>
  );
}
