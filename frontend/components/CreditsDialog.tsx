"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreditsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CreditsDialog({ open, onClose }: CreditsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Credits</DialogTitle>
          <DialogDescription className="sr-only">Informationen über Kontexto</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Kontexto</strong> ist ein deutschsprachiges Wortratespiel, inspiriert von{" "}
            <a href="https://contexto.me" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Contexto
            </a>.
          </p>

          <div className="space-y-1">
            <h3 className="font-medium text-foreground">Technologie</h3>
            <p>
              Die Wortähnlichkeiten werden mit{" "}
              <a href="https://fasttext.cc" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                fastText
              </a>
              -Worteinbettungen berechnet, die auf deutschen Texten trainiert wurden.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-medium text-foreground">Entwicklung</h3>
            <p>Entwickelt mit Next.js, FastAPI und viel Liebe zur deutschen Sprache.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
