"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CategoryEntry, CategorySetup } from "@/lib/categories";

/** The chip that stands for "no filter". Never a real id: ids are a-z only. */
const ALL = "-all";

interface CategoryPickerProps {
  value: CategorySetup;
  onChange: (next: CategorySetup) => void;
  catalogue: CategoryEntry[] | null;
  failed: boolean;
  onRetry: () => void;
  /** Keeps label ids unique when two forms sit on one page. */
  idPrefix: string;
}

/**
 * The one way a player picks fields: the solo setup, the room form and the
 * live form all render this, so a field reads the same wherever it is chosen.
 *
 * Chips rather than a dropdown, because the choice is "which of these", often
 * more than one, and a closed list hides what there is to choose from. "Alle"
 * is a chip of its own and the default: no filter is a choice, not an absence.
 */
export default function CategoryPicker({
  value,
  onChange,
  catalogue,
  failed,
  onRetry,
  idPrefix,
}: CategoryPickerProps) {
  const groupLabel = `${idPrefix}-categories-label`;
  const switchId = `${idPrefix}-show-category`;
  const pressed = value.categories.length > 0 ? value.categories : [ALL];
  const single = value.categories.length === 1;

  const handleChange = (next: string[]) => {
    // Picking "Alle" clears the filter; picking a field while "Alle" is on
    // replaces it. Unpressing the last field falls back to "Alle".
    const tookAll = next.includes(ALL) && !pressed.includes(ALL);
    const categories = tookAll ? [] : next.filter((id) => id !== ALL);
    onChange({ ...value, categories });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p id={groupLabel} className="text-micro font-semibold text-muted-foreground">
          {"Kategorien"}
        </p>
        {catalogue ? (
          <ToggleGroup
            type="multiple"
            value={pressed}
            onValueChange={handleChange}
            aria-labelledby={groupLabel}
            spacing={2}
            className="w-full flex-wrap justify-start"
          >
            <ToggleGroupItem value={ALL} variant="outline" className={CHIP}>
              {"Alle"}
            </ToggleGroupItem>
            {catalogue.map((entry) => (
              <ToggleGroupItem key={entry.id} value={entry.id} variant="outline" className={CHIP}>
                {entry.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : failed ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-small text-destructive">{"Die Kategorien konnten nicht geladen werden."}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {"Erneut versuchen"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" aria-busy="true" aria-label="Kategorien werden geladen">
            {SKELETON_WIDTHS.map((width, i) => (
              <Skeleton key={i} className="h-9 rounded-md" style={{ width }} />
            ))}
          </div>
        )}
      </div>

      {!single && (
        <div className="flex items-start justify-between gap-4">
          <Label htmlFor={switchId} className="flex flex-col items-start gap-0.5 font-normal">
            <span className="font-medium">{"Kategorie anzeigen"}</span>
            <span className="text-small text-muted-foreground">
              {"Die Kategorie der Runde steht über dem Spielfeld."}
            </span>
          </Label>
          <Switch
            id={switchId}
            checked={value.showCategory}
            onCheckedChange={(showCategory) => onChange({ ...value, showCategory })}
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}

/** Fill plus hairline, never a shadow (no-slop M8); the chosen chip takes the
 *  accent hairline, the same signal the mode cards of the room form use. */
const CHIP =
  "shadow-none data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground";

const SKELETON_WIDTHS = ["3.5rem", "5rem", "9rem", "8rem", "10rem", "7rem", "9rem", "6rem"];
