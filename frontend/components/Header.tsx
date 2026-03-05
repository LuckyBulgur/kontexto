"use client";
import {
  EllipsisVertical,
  Lightbulb,
  Flag,
  BookOpen,
  CircleHelp,
  Settings,
  Info,
} from "lucide-react";
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
  tipDisabled?: boolean;
  giveUpDisabled?: boolean;
}

export default function Header({
  onTip,
  onGiveUp,
  onHowToPlayOpen,
  onFAQOpen,
  onSettingsOpen,
  onCreditsOpen,
  tipDisabled,
  giveUpDisabled,
}: HeaderProps) {
  return (
    <header className="relative flex items-center justify-center px-4 pt-5 pb-1">
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSettingsOpen}>
              <Settings className="h-4 w-4" />
              Einstellungen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreditsOpen}>
              <Info className="h-4 w-4" />
              Credits
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
