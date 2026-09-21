"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HowToPlayBody } from "@/components/HowToPlay";
import SeoFaq from "@/components/seo/SeoFaq";

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
 *
 * The questions sit in the second tab rather than in a menu entry of their own.
 * Both answer "how does this work", one in three steps and one in twenty
 * questions, and a player looking for either opens the same door.
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

        <Tabs defaultValue="spielen">
          <TabsList className="w-full">
            <TabsTrigger value="spielen">So wird gespielt</TabsTrigger>
            <TabsTrigger value="fragen">Häufige Fragen</TabsTrigger>
          </TabsList>

          <TabsContent value="spielen">
            <div className="scrollbar-thin max-h-[65vh] overflow-y-auto pt-1">
              <HowToPlayBody />
            </div>
          </TabsContent>

          <TabsContent value="fragen">
            <div className="scrollbar-thin -mx-1 max-h-[65vh] overflow-y-auto px-1 pt-1">
              <SeoFaq />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
