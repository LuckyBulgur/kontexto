"use client";
import { Difficulty, SortMode } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  sortMode: SortMode;
  onSortModeChange: (s: SortMode) => void;
}

export default function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
  difficulty,
  onDifficultyChange,
  sortMode,
  onSortModeChange,
}: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Einstellungen</DialogTitle>
          <DialogDescription className="sr-only">Design und Schwierigkeitsgrad anpassen</DialogDescription>
        </DialogHeader>

        <div className="space-y-8 pt-4">
          {/* Darstellung */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Darstellung</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Design</Label>
              <p className="text-xs text-muted-foreground">Wechsle zwischen hellem und dunklem Design</p>
              <Select value={theme} onValueChange={(v) => onThemeChange(v as "light" | "dark")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Hell</SelectItem>
                  <SelectItem value="dark">Dunkel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Spieloptionen */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Spieloptionen</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Sortierung</Label>
              <p className="text-xs text-muted-foreground">Reihenfolge der geratenen W&ouml;rter in der Liste</p>
              <Select value={sortMode} onValueChange={(v) => onSortModeChange(v as SortMode)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rank">&Auml;hnlichkeit</SelectItem>
                  <SelectItem value="chronological">Reihenfolge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Schwierigkeitsgrad</Label>
              <p className="text-xs text-muted-foreground">Bestimmt wie nah die Tipps am Zielwort sind</p>
              <Select value={difficulty} onValueChange={(v) => onDifficultyChange(v as Difficulty)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Einfach</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="hard">Schwer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
