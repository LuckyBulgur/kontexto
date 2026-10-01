"use client";

import { useCallback, useEffect, useState } from "react";
import { CategoryEntry, fetchCategories } from "./categories";

export interface CategoryCatalogue {
  /** The fields in picker order, or null while loading or after a failure. */
  catalogue: CategoryEntry[] | null;
  failed: boolean;
  retry: () => void;
}

/**
 * Load the field catalogue once per mount. `enabled` defers the request until a
 * form actually offers categories, so the room form does not ask for a list the
 * player may never open.
 */
export function useCategoryCatalogue(enabled = true): CategoryCatalogue {
  const [catalogue, setCatalogue] = useState<CategoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || catalogue) return;
    let cancelled = false;
    setFailed(false);
    fetchCategories()
      .then((entries) => {
        if (!cancelled) setCatalogue(entries);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, catalogue, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { catalogue, failed, retry };
}
