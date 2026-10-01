/**
 * Solution categories on the client: the catalogue the server serves, the setup
 * a player picks before a round, and how that setup travels in a request.
 *
 * The catalogue is not compiled in. The backend owns it (backend/categories.py,
 * backend/data/categories.txt) together with the assignment of every solution,
 * and it counts per field what a filter can actually draw, which a static copy
 * here could not know. The picker therefore reads it at runtime, like every
 * other piece of game data on this static export.
 *
 * The daily, the archive and the standard solo modes never use any of this.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/** A field as every response names it: the id for code, the name for people. */
export interface CategoryInfo {
  id: string;
  name: string;
}

/** A field in the picker, with the number of games a filter on it can draw. */
export interface CategoryEntry extends CategoryInfo {
  count: number;
}

/**
 * What every room state says about its fields. Optional, because a page can
 * meet a server from before categories for the length of one deploy.
 */
export interface RoomCategoryFields {
  /** The agreed filter, ids in catalogue order; empty for every field. */
  categories?: string[];
  show_category?: boolean;
  /** The round's field, only when the room shows it. */
  category?: CategoryInfo | null;
}

/** What a player decides before a round. An empty list means every field. */
export interface CategorySetup {
  categories: string[];
  showCategory: boolean;
}

/** Every field, with the round's field on screen: the mode's own promise. */
export const DEFAULT_CATEGORY_SETUP: CategorySetup = { categories: [], showCategory: true };

const SETUP_KEY = "kontexto_category_setup";

/**
 * Whether the round's field ends up on screen. A single chosen field is known
 * anyway, so it is always shown, whatever the switch says; hiding it would hide
 * nothing and only make the board look emptier.
 */
export function showsCategory(setup: CategorySetup): boolean {
  return setup.showCategory || setup.categories.length === 1;
}

/** The `categories=` query value: ids comma joined, empty for every field. */
export function categoryQuery(setup: CategorySetup): string {
  return setup.categories.join(",");
}

/** The body part every room creation takes. */
export function roomCategoryBody(setup: CategorySetup): { categories: string[]; show_category: boolean } {
  return { categories: [...setup.categories], show_category: showsCategory(setup) };
}

/**
 * A setup against the catalogue the server serves right now: ids it no longer
 * offers are dropped (a field can be merged, or hold no game on an older data
 * volume), and the order is the catalogue's, so the same choice reads the same.
 */
export function normalizeSetup(setup: CategorySetup, catalogue: CategoryInfo[]): CategorySetup {
  const chosen = new Set(setup.categories);
  return {
    categories: catalogue.filter((entry) => chosen.has(entry.id)).map((entry) => entry.id),
    showCategory: setup.showCategory,
  };
}

/** One line that names a setup: "Alle Kategorien", "Tiere", "Tiere und Musik". */
export function setupLabel(setup: CategorySetup, catalogue: CategoryInfo[]): string {
  const names = catalogue.filter((entry) => setup.categories.includes(entry.id)).map((entry) => entry.name);
  if (names.length === 0) return "Alle Kategorien";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} oder ${names[1]}`;
  return `${names.length} Kategorien`;
}

/** The setup chosen last time, or null. Storage may be absent or full. */
export function loadCategorySetup(): CategorySetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCategorySetup(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCategorySetup(setup: CategorySetup): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  } catch {
    /* a full or blocked storage costs the remembered choice, nothing more */
  }
}

function isCategorySetup(value: unknown): value is CategorySetup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.categories) &&
    candidate.categories.every((id) => typeof id === "string") &&
    typeof candidate.showCategory === "boolean"
  );
}

/** The fields a player may pick, in picker order. Only fields that hold games. */
export async function fetchCategories(): Promise<CategoryEntry[]> {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const body: { categories: CategoryEntry[] } = await res.json();
  return body.categories;
}
