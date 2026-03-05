"use client";
import { EllipsisVertical } from "lucide-react";
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
              Tipp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onGiveUp} disabled={giveUpDisabled} className="text-destructive focus:text-destructive">
              Aufgeben
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onHowToPlayOpen}>
              Spielanleitung
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onFAQOpen}>
              FAQ
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSettingsOpen}>
              Einstellungen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreditsOpen}>
              Credits
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
