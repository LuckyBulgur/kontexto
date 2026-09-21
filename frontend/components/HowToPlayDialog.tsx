"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HowToPlayBody } from "@/components/HowToPlay";

interface HowToPlayDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The same explanation the empty board shows, in the same shape.
 *
 * It used to be four paragraphs of prose with a bullet list for the colours,
 * while the board showed three numbered steps and a legend panel. Same content,
 * two shapes, two things to keep true. `HowToPlay` is now the single source.
 */
export default function HowToPlayDialog({ open, onClose }: HowToPlayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">Spielanleitung</DialogTitle>
          <DialogDescription>
            {"Errate das geheime Wort über seine Bedeutung, nicht über die Buchstaben."}
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin max-h-[70vh] overflow-y-auto pt-1">
          <HowToPlayBody />
        </div>
      </DialogContent>
    </Dialog>
  );
}
