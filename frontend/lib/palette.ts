/**
 * Farbwelten: the colour dimension of the theme, independent of light and dark.
 *
 * Light/dark answers "how bright is the room". A Farbwelt answers "which accent
 * carries the product". They multiply rather than replace each other, so every
 * palette ships a light and a dark set, and the switch never changes which mode
 * the player is in.
 *
 * A palette changes colour and nothing else. Radius, type scale, spacing and
 * layout stay identical across all of them, which is what keeps this a theme
 * instead of a second frontend. The rank ramp (green/amber/red) is excluded on
 * purpose: the shared result text spells it out in emoji squares, so a player
 * whose palette recoloured it would post results nobody else can read.
 *
 * The values themselves live in `app/globals.css` under
 * `html[data-palette="…"]`, because they must be applied before hydration to
 * avoid a flash, and CSS is the only thing that can do that.
 */

export const PALETTE_KEY = "kontexto_palette";

export type PaletteId = "tinte" | "beere" | "indigo" | "petrol" | "klassisch";

export const DEFAULT_PALETTE: PaletteId = "tinte";

export interface PaletteMeta {
  id: PaletteId;
  name: string;
  /** Two words for the picker: the column is 150px wide. */
  hint: string;
}

export const PALETTES: Record<PaletteId, PaletteMeta> = {
  tinte: {
    id: "tinte",
    name: "Tinte",
    hint: "Tiefes Blau",
  },
  beere: {
    id: "beere",
    name: "Beere",
    hint: "Pink-Violett",
  },
  indigo: {
    id: "indigo",
    name: "Indigo",
    hint: "Blau-Violett",
  },
  petrol: {
    id: "petrol",
    name: "Petrol",
    hint: "Dunkeltürkis",
  },
  klassisch: {
    id: "klassisch",
    name: "Klassisch",
    hint: "Grau wie früher",
  },
};

export const PALETTE_ORDER: PaletteId[] = [
  "tinte",
  "beere",
  "indigo",
  "petrol",
  "klassisch",
];

export function isPaletteId(value: unknown): value is PaletteId {
  // `hasOwn`, not `in`: `"toString" in PALETTES` is true through the prototype
  // chain, and a stored value of "toString" would then be written straight into
  // `data-palette`.
  return typeof value === "string" && Object.hasOwn(PALETTES, value);
}

export function loadPalette(): PaletteId {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  try {
    const saved = localStorage.getItem(PALETTE_KEY);
    return isPaletteId(saved) ? saved : DEFAULT_PALETTE;
  } catch {
    // Private mode, or site data blocked. The default is a valid answer.
    return DEFAULT_PALETTE;
  }
}

export function savePalette(palette: PaletteId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PALETTE_KEY, palette);
  } catch {
    // Nothing to recover: the palette is applied to the DOM either way, it just
    // will not survive a reload.
  }
}

/** Applies the palette to the document. Same call the inline script makes. */
export function applyPalette(palette: PaletteId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.palette = palette;
}

/**
 * Runs in `<head>` before first paint, next to the light/dark script. Inline
 * and duplicated rather than imported, because a module would arrive after the
 * first paint and the palette would visibly swap.
 */
export const PALETTE_SCRIPT = `(function(){try{var p=localStorage.getItem("${PALETTE_KEY}");var ok=${JSON.stringify(
  PALETTE_ORDER,
)};if(ok.indexOf(p)>-1){document.documentElement.setAttribute("data-palette",p)}}catch(e){}})()`;
