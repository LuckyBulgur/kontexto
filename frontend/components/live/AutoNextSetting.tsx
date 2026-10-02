"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AUTO_NEXT_DELAY_MS, useAutoNextSetting } from "@/lib/live-auto-next";

const SECONDS = AUTO_NEXT_DELAY_MS / 1000;

/**
 * The streamer's switch for starting the next round by itself.
 *
 * Stands in the create form and in the sidebar of a running round, both bound
 * to the same stored value (`lib/live-auto-next.ts`). The sidebar is rendered
 * once per breakpoint, so the id comes from useId.
 */
export default function AutoNextSetting({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const { enabled, setEnabled } = useAutoNextSetting();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className={compact ? "text-small" : undefined}>
          {"Nächste Runde automatisch starten"}
        </Label>
        <p id={`${id}-hint`} className="mt-1 text-micro text-muted-foreground/80">
          {`${SECONDS} Sekunden, nachdem das Wort gefunden oder aufgelöst wurde. Auf der Ergebniskarte kannst du eine Runde anhalten.`}
        </p>
      </div>
      <Switch
        id={id}
        checked={enabled}
        onCheckedChange={setEnabled}
        aria-describedby={`${id}-hint`}
      />
    </div>
  );
}
