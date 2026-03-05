"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HowToPlayDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function HowToPlayDialog({ open, onClose }: HowToPlayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Spielanleitung</DialogTitle>
          <DialogDescription className="sr-only">Wie man Kontexto spielt</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm text-muted-foreground">
          <p>
            Finde das <strong className="text-foreground">geheime Wort</strong>! Gib ein beliebiges deutsches Wort ein und erfahre, wie nah es am Zielwort ist.
          </p>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Rang-System</h3>
            <p>
              Jedes Wort bekommt einen <strong className="text-foreground">Rang</strong> basierend auf seiner Bedeutungsähnlichkeit zum geheimen Wort. Je niedriger der Rang, desto näher bist du dran.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Farben</h3>
            <ul className="space-y-1 list-none">
              <li><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2 align-middle" />Grün - sehr nah (Rang 1-300)</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2 align-middle" />Gelb - auf dem richtigen Weg (Rang 301-1500)</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2 align-middle" />Rot - noch weit entfernt (Rang 1501+)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Tipps</h3>
            <p>
              Nutze das Menü, um dir einen Tipp geben zu lassen. Der Schwierigkeitsgrad kann in den Einstellungen angepasst werden.
            </p>
          </div>

          <p>
            Jeden Tag gibt es ein neues Wort. Viel Spaß beim Raten!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
