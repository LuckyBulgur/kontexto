"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useQuips } from "@/lib/use-quips";

const LABEL = "Freche Sprüche";
const HINT = "Das Spiel zieht dich beim Raten und am Ende ein bisschen auf. Aus heißt: sachliche Texte.";

/** The switch row for the quip layer, shared by the Kontexto and the Wordle settings. */
export default function QuipsSetting({ className }: { className?: string }) {
  const { enabled, setEnabled } = useQuips();
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="pr-4">
        <Label htmlFor="quips-switch" className="text-small font-medium">{LABEL}</Label>
        <p className="text-micro text-muted-foreground">{HINT}</p>
      </div>
      <Switch id="quips-switch" checked={enabled} onCheckedChange={setEnabled} aria-label={LABEL} />
    </div>
  );
}
