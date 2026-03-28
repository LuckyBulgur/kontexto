"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hardMode: boolean;
  onHardModeChange: (enabled: boolean) => void;
  canToggleHardMode: boolean;
}

export default function SettingsModal({ open, onOpenChange, hardMode, onHardModeChange, canToggleHardMode }: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Einstellungen</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between py-3">
          <div>
            <Label>Hard Mode</Label>
            <p className="text-xs text-zinc-500">
              Enth&#252;llte Hinweise m&#252;ssen in folgenden Versuchen verwendet werden.
            </p>
          </div>
          <Switch
            checked={hardMode}
            onCheckedChange={onHardModeChange}
            disabled={!canToggleHardMode}
          />
        </div>
        {!canToggleHardMode && (
          <p className="text-xs text-zinc-400">
            Hard Mode kann nur vor dem ersten Versuch aktiviert werden.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
