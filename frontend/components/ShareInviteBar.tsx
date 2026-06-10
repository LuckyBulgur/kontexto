"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareInviteBarProps {
  /** Kopiert den Einladungs-Link (gemeinsamer Handler des jeweiligen Modus). */
  onCopy: () => void;
  /** Haupttext, z. B. „Warte auf deinen Gegner …". */
  title: string;
  /** Ergänzende Zeile, z. B. ein Hinweis zum Teilen des Links. */
  description?: string;
}

/**
 * Auffällige Einlade-Leiste oberhalb der Spielfläche. Wird angezeigt, solange
 * noch nicht alle Mitspieler beigetreten sind, und macht das Teilen des Links
 * im entscheidenden Moment offensichtlich.
 */
export default function ShareInviteBar({ onCopy, title, description }: ShareInviteBarProps) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Button onClick={onCopy} size="sm" className="shrink-0 self-start sm:self-auto">
        <Copy className="h-4 w-4" />
        Link kopieren
      </Button>
    </div>
  );
}
