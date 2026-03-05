"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FAQDialogProps {
  open: boolean;
  onClose: () => void;
}

const faqs = [
  {
    q: "Was ist Kontexto?",
    a: "Kontexto ist ein Wortratespiel, bei dem du das geheime Wort anhand von Bedeutungsähnlichkeit erraten musst. Die Ähnlichkeit wird durch KI-basierte Worteinbettungen berechnet.",
  },
  {
    q: "Wie wird die Ähnlichkeit berechnet?",
    a: "Wir verwenden fastText-Worteinbettungen, die auf großen deutschen Textkorpora trainiert wurden. Die Ähnlichkeit basiert auf dem Kontext, in dem Wörter typischerweise verwendet werden — nicht auf Buchstabenähnlichkeit.",
  },
  {
    q: "Wann gibt es ein neues Wort?",
    a: "Jeden Tag um Mitternacht wird ein neues geheimes Wort freigeschaltet. Alle Spieler weltweit raten am gleichen Tag das gleiche Wort.",
  },
  {
    q: "Was bedeuten die Farben?",
    a: "Grün (Rang 1–300): sehr nah am Zielwort. Gelb (Rang 301–1500): auf dem richtigen Weg. Rot (Rang 1501+): noch weit entfernt.",
  },
  {
    q: "Kann ich auf mehreren Geräten spielen?",
    a: "Der Spielstand wird lokal im Browser gespeichert. Er wird nicht zwischen Geräten synchronisiert.",
  },
];

export default function FAQDialog({ open, onClose }: FAQDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Häufige Fragen</DialogTitle>
          <DialogDescription className="sr-only">Häufig gestellte Fragen zu Kontexto</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {faqs.map((faq, i) => (
            <div key={i} className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">{faq.q}</h3>
              <p className="text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
