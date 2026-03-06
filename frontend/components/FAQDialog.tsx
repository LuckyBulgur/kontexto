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

import { faqs } from "@/lib/faqs";

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
