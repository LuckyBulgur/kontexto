"use client";

import { Check } from "lucide-react";

import { PALETTES, PALETTE_ORDER, type PaletteId } from "@/lib/palette";
import { usePalette } from "@/lib/use-palette";
import { cn } from "@/lib/utils";

/**
 * The Farbwelt picker.
 *
 * Swatches and not a dropdown: the thing being chosen is a colour, and a list
 * of names makes the player guess what each one looks like. Each swatch shows
 * the palette's own paper, card and accent, so the row is a small preview of
 * the page rather than a label.
 *
 * The name stays next to it, because colour alone is not an accessible label
 * and because "Klassisch" is the one option a player is specifically looking
 * for by name.
 */
export default function PalettePicker() {
  const { palette, setPalette } = usePalette();
  return (
    <div role="radiogroup" aria-label="Farbwelt" className="grid grid-cols-2 gap-2">
      {PALETTE_ORDER.map((id) => {
        const meta = PALETTES[id];
        const active = id === palette;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPalette(id)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
              active
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-accent",
            )}
          >
            <Swatch id={id} active={active} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-small font-semibold">{meta.name}</span>
              <span className="truncate text-micro text-muted-foreground">{meta.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A miniature of the page: paper, a card on it, the accent on the card. The
 * colours come from the palette's own custom properties via `data-palette`, so
 * the swatch cannot drift away from the theme it advertises. Light mode is
 * shown even in dark mode: the swatch answers "which colour", the light/dark
 * switch above answers "how bright", and mixing the two questions into one
 * control is what makes theme pickers confusing.
 */
function Swatch({ id, active }: { id: PaletteId; active: boolean }) {
  return (
    <span
      data-palette={id}
      aria-hidden="true"
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border",
        "bg-background",
      )}
      // The nested data-palette re-resolves the tokens inside this element only,
      // so every swatch paints in its own world while the page keeps its own.
      style={{ colorScheme: "light" }}
    >
      <span className="absolute inset-1 rounded-sm border border-border bg-card" />
      <span className="relative h-3.5 w-3.5 rounded-full bg-primary" />
      {active && (
        <Check
          className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-primary p-0.5 text-primary-foreground"
          strokeWidth={3}
        />
      )}
    </span>
  );
}
