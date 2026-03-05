"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GiveUpDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function GiveUpDialog({ open, onClose, onConfirm }: GiveUpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">Aufgeben</DialogTitle>
          <DialogDescription>
            Bist du sicher? Das Lösungswort wird angezeigt und du kannst heute nicht mehr weiterspielen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Aufgeben
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
