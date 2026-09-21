"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SeoFaq from "@/components/seo/SeoFaq";

interface FAQDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The same FAQ the page shows, in the same collapsed form.
 *
 * It used to render all twenty answers expanded, one after another, which made
 * the dialog a scroll of prose in which no question could be found. `SeoFaq` is
 * the list the site already uses, built on native `<details>`, so a question is
 * one tap away and the rest stays out of the way. Reusing it also means the two
 * places cannot drift apart.
 */
export default function FAQDialog({ open, onClose }: FAQDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">Häufige Fragen</DialogTitle>
          <DialogDescription className="sr-only">Häufig gestellte Fragen zu Kontexto</DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin -mx-1 max-h-[70vh] overflow-y-auto px-1 pt-1">
          <SeoFaq />
        </div>
      </DialogContent>
    </Dialog>
  );
}
