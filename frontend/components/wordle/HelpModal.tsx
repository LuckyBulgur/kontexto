"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Tile from "./Tile";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>So funktioniert W&#246;rdle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p>Errate das W&#246;rdle in 6 Versuchen. Jeder Versuch muss ein g&#252;ltiges deutsches 5-Buchstaben-Wort sein.</p>
          <p>Nach jedem Versuch zeigen die Farben der Kacheln, wie nah dein Versuch war:</p>

          <div>
            <div className="flex gap-1 mb-1">
              <Tile letter="K" color="GREEN" />
              <Tile letter="R" />
              <Tile letter="A" />
              <Tile letter="F" />
              <Tile letter="T" />
            </div>
            <p><strong>K</strong> ist im Wort und an der richtigen Stelle.</p>
          </div>

          <div>
            <div className="flex gap-1 mb-1">
              <Tile letter="S" />
              <Tile letter="T" color="YELLOW" />
              <Tile letter="E" />
              <Tile letter="R" />
              <Tile letter="N" />
            </div>
            <p><strong>T</strong> ist im Wort, aber an der falschen Stelle.</p>
          </div>

          <div>
            <div className="flex gap-1 mb-1">
              <Tile letter="B" />
              <Tile letter="L" />
              <Tile letter="U" />
              <Tile letter="M" />
              <Tile letter="E" color="GRAY" />
            </div>
            <p><strong>E</strong> ist nicht im Wort.</p>
          </div>

          <p className="text-muted-foreground">Jeden Tag gibt es ein neues W&#246;rdle. Viel Spa&#223;!</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
