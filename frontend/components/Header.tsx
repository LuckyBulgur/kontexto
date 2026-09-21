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
import ModesButton from "@/components/ModesButton";
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
  /** The back arrow leads home and opens the mode question there, instead of
   *  leaving for the article that describes the modes. Used where "back" means
   *  "somewhere else in the game", which is a choice and not a text. */
  backOpensModes?: boolean;
}

/** Marker on the home URL that opens the mode question on arrival. */
const MODES_PARAM = "modi";

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
  backOpensModes,
}: HeaderProps) {
  const pathname = usePathname();
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  // The picker is owned here rather than passed in: every client that renders
  // the menu would otherwise have to carry the same three lines of state.
  const [showModePicker, setShowModePicker] = useState(false);
  // Set when the home page was opened by a back arrow that carried the
  // question with it, so the hint does not talk over the open dialog.
  const [pickerFromLink, setPickerFromLink] = useState(false);
  const { highlight: infiniteHighlight, dismiss: dismissInfiniteHighlight } =
    useFeatureDiscovery("kontexto_infinite_discovered");
  // Endless mode lost its own icon button to the modes button and is a menu
  // entry now, so its hint has one place instead of two.
  const showInfiniteHighlight = !!onInfiniteStart && infiniteHighlight;

  // A back arrow elsewhere in the game links to /?modi=1: the player lands on
  // the board, which is where they came from, and the question is already
  // open. The marker is removed right away so a reload is an ordinary visit
  // and the address stays the canonical one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has(MODES_PARAM)) return;
    setShowModePicker(true);
    setPickerFromLink(true);
    params.delete(MODES_PARAM);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash
    );
  }, []);

  useEffect(() => {
    if (!showCountdown) return;
    const interval = setInterval(() => setCountdown(getTimeUntilMidnight()), 1000);
    return () => clearInterval(interval);
  }, [showCountdown]);

  return (
    <header className="relative flex flex-col items-center px-4 pt-5 pb-1">
      {/* Three slots, not a centred block with two absolute islands: the right
          cluster grew a second button, and at 360 pixels an absolute one sat on
          top of the wordmark. Equal flex basis keeps the name centred while
          there is room and lets it give way before it is overlapped. */}
      <div className="flex w-full items-center gap-1">
        <div className="flex flex-1 basis-0 items-center">
          {backOpensModes ? (
            <a href={`/?${MODES_PARAM}=1`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                aria-label="Zurück zur Modusauswahl"
              >
                <ArrowLeft className="h-6! w-6!" />
              </Button>
            </a>
          ) : (
            backHref && (
              <a href={backHref}>
                <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Zurück">
                  <ArrowLeft className="h-6! w-6!" />
                </Button>
              </a>
            )
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 font-display text-lead font-extrabold tracking-tight sm:text-h3">
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
      <div className="flex flex-1 basis-0 items-center justify-end gap-0.5">
        {onCopyLink && <ShareLinkButton onClick={onCopyLink} />}
        <ModesButton
          onOpen={() => setShowModePicker(true)}
          hintKey="kontexto_modes_button_discovered"
          // Only where a player arrives, never in a room or in a running solo
          // round, where a bubble would talk over the game.
          hintEnabled={pathname === "/" && !pickerFromLink}
        />
        <DropdownMenu onOpenChange={(open) => {
          if (!open && showInfiniteHighlight) dismissInfiniteHighlight();
        }}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10"
              aria-label={
                showInfiniteHighlight ? "Menü, neue Funktion: Unendlich-Modus" : "Menü"
              }
            >
              <EllipsisVertical className="h-6! w-6!" />
              {showInfiniteHighlight && (
                <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5" aria-hidden>
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
            <DropdownMenuItem onClick={() => setShowModePicker(true)}>
              <LayoutGrid className="h-4 w-4" />
              Spielmodi
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
