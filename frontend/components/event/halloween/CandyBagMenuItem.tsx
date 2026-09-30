"use client";

import { Candy } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SPOOKTOBER_2026 } from "@/lib/event-theme";
import { openCandyBag } from "@/lib/events/hooks";
import { useEventTheme } from "@/lib/use-event-theme";
import { COPY } from "./copy";

/**
 * The menu entry that opens the candy bag. Rendered only while the event is
 * showing; the menu content mounts on open, after hydration, so reading the
 * client state here cannot cause a mismatch.
 */
export default function CandyBagMenuItem() {
  const { event, active } = useEventTheme();
  if (!active || event?.id !== SPOOKTOBER_2026.id) return null;
  return (
    <DropdownMenuItem onClick={openCandyBag}>
      <Candy className="h-4 w-4" />
      {COPY.menuEntry}
    </DropdownMenuItem>
  );
}
