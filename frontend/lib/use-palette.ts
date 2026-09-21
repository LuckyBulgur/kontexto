"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_PALETTE,
  applyPalette,
  loadPalette,
  savePalette,
  type PaletteId,
} from "./palette";

/**
 * Reads and writes the Farbwelt.
 *
 * Self-contained on purpose: nothing but the settings dialog cares which
 * palette is active, because the palette lives entirely in CSS custom
 * properties on `<html>`. Threading it through every page client the way
 * light/dark is threaded would add a prop to a dozen components for no reader.
 *
 * The first render returns the default rather than the stored value, and the
 * effect corrects it. That is deliberate: `localStorage` does not exist during
 * the static export, and reading it during render would make server and client
 * markup disagree. The visible colours are already right before this runs, set
 * by PALETTE_SCRIPT in `<head>`; this hook only keeps the picker in sync.
 */
export function usePalette(): {
  palette: PaletteId;
  setPalette: (next: PaletteId) => void;
} {
  const [palette, setState] = useState<PaletteId>(DEFAULT_PALETTE);

  useEffect(() => {
    setState(loadPalette());
  }, []);

  const setPalette = useCallback((next: PaletteId) => {
    setState(next);
    applyPalette(next);
    savePalette(next);
  }, []);

  return { palette, setPalette };
}
