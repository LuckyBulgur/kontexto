"use client";

import { useEffect, useState } from "react";
import CategoryPicker from "@/components/categories/CategoryPicker";
import { Panel } from "@/components/design";
import { Button } from "@/components/ui/button";
import {
  CategorySetup,
  DEFAULT_CATEGORY_SETUP,
  loadCategorySetup,
  normalizeSetup,
} from "@/lib/categories";
import { SoloModeMeta } from "@/lib/solo-modes";
import { useCategoryCatalogue } from "@/lib/use-category-catalogue";

interface CategorySetupPanelProps {
  mode: SoloModeMeta;
  /** The setup the last round ran with, when the player comes back to change it. */
  initial?: CategorySetup;
  onStart: (setup: CategorySetup) => void;
  starting: boolean;
  error: string | null;
}

/**
 * What the Kategorien mode asks before its first round: which fields, and
 * whether the round's field goes on screen. The last choice is preselected,
 * because a player who comes back usually wants the same thing again.
 */
export default function CategorySetupPanel({
  mode,
  initial,
  onStart,
  starting,
  error,
}: CategorySetupPanelProps) {
  const { catalogue, failed, retry } = useCategoryCatalogue();
  const [setup, setSetup] = useState<CategorySetup>(initial ?? DEFAULT_CATEGORY_SETUP);

  // The remembered choice lives in storage, which the static render cannot
  // read, so it is applied after mount. A choice handed in by the caller wins.
  useEffect(() => {
    if (initial) return;
    const stored = loadCategorySetup();
    if (stored) setSetup(stored);
  }, [initial]);

  // Ids the server no longer offers are dropped once the catalogue is known.
  useEffect(() => {
    if (catalogue) setSetup((current) => normalizeSetup(current, catalogue));
  }, [catalogue]);

  return (
    <Panel className="gap-5">
      <div className="space-y-1.5">
        <h2 className="text-h3">{"Kategorien wählen"}</h2>
        <p className="text-small text-muted-foreground">{mode.tagline}</p>
      </div>

      <CategoryPicker
        idPrefix="solo"
        value={setup}
        onChange={setSetup}
        catalogue={catalogue}
        failed={failed}
        onRetry={retry}
      />

      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}

      <Button
        className="w-full"
        disabled={!catalogue || starting}
        onClick={() => catalogue && onStart(normalizeSetup(setup, catalogue))}
      >
        {starting ? "Lädt..." : "Runde starten"}
      </Button>
    </Panel>
  );
}
