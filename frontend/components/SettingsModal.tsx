"use client";
import { Difficulty } from "@/lib/types";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
}

export default function SettingsModal({
  open,
  onClose,
  theme,
  onThemeToggle,
  difficulty,
  onDifficultyChange,
}: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Einstellungen</DialogTitle>
          <DialogDescription className="sr-only">Design und Schwierigkeitsgrad anpassen</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode">Dunkles Design</Label>
            <Switch
              id="dark-mode"
              checked={theme === "dark"}
              onCheckedChange={onThemeToggle}
            />
          </div>

          <div className="space-y-2">
            <Label>Schwierigkeitsgrad (Tipps)</Label>
            <Select value={difficulty} onValueChange={(v) => onDifficultyChange(v as Difficulty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Einfach</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="hard">Schwer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
