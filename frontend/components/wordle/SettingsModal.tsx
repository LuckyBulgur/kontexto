"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
  hardMode: boolean;
  onHardModeChange: (enabled: boolean) => void;
  canToggleHardMode: boolean;
}

export default function SettingsModal({ open, onOpenChange, theme, onThemeChange, hardMode, onHardModeChange, canToggleHardMode }: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Einstellungen</DialogTitle>
          <DialogDescription className="sr-only">Design und Hard Mode anpassen</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
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

        <div className="flex items-center justify-between py-3 border-t border-border">
          <div>
            <Label>Hard Mode</Label>
            <p className="text-xs text-muted-foreground">
              Enthüllte Hinweise müssen in folgenden Versuchen verwendet werden.
            </p>
          </div>
          <Switch
            checked={hardMode}
            onCheckedChange={onHardModeChange}
            disabled={!canToggleHardMode}
          />
        </div>
        {!canToggleHardMode && (
          <p className="text-xs text-muted-foreground">
            Hard Mode kann nur vor dem ersten Versuch aktiviert werden.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
