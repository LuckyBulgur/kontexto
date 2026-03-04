"use client";
import { EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onTip: () => void;
  onSettingsOpen: () => void;
  tipDisabled?: boolean;
}

export default function Header({ onTip, onSettingsOpen, tipDisabled }: HeaderProps) {
  return (
    <header className="relative flex items-center justify-center px-4 py-3 border-b">
      <h1 className="text-xl font-bold tracking-wider">KONTEXTO</h1>
      <div className="absolute right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menü">
              <EllipsisVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onTip} disabled={tipDisabled}>
              Tipp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSettingsOpen}>
              Einstellungen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
