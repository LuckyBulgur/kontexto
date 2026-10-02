"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareLinkButtonProps {
  onClick: () => void;
  className?: string;
  /** The visible word next to the icon. The live host page names the guest
   *  link here; the link itself is never shown on any button. */
  label?: string;
  /** What a screen reader says; defaults to the visible label. */
  ariaLabel?: string;
}

/**
 * Dauerhaft sichtbarer „Link kopieren"-Button für die Header-Aktionsleiste der
 * Teilen-Modi (Duell/Koop/Wördle-Duell). Auf Mobile faktisch Icon-only (Text
 * via `hidden sm:inline` ausgeblendet, `aria-label` für Screenreader), auf
 * größeren Screens Icon + Beschriftung. Wird in `Header` und `WordleHeader`
 * identisch verwendet.
 */
export default function ShareLinkButton({
  onClick,
  className,
  label = "Link kopieren",
  ariaLabel,
}: ShareLinkButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={cn("h-10 gap-1.5 px-2 sm:px-3", className)}
    >
      <Copy className="h-5! w-5! sm:h-4! sm:w-4!" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
