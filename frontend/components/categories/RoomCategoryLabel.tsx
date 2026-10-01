"use client";

import { RoomCategoryFields, setupLabel } from "@/lib/categories";
import { useCategoryCatalogue } from "@/lib/use-category-catalogue";

/**
 * The room's field rule, as one item of a status line.
 *
 * A room that shows its field names the round's field. A room with a filter
 * but no shown field names the filter instead, which every player agreed to by
 * joining, so it is no hint beyond what the room already says. A room without
 * either renders nothing, which is every room created before categories.
 */
export default function RoomCategoryLabel({ room }: { room: RoomCategoryFields | null | undefined }) {
  const filter = room?.categories ?? [];
  const shown = room?.category ?? null;
  const { catalogue } = useCategoryCatalogue(!shown && filter.length > 0);

  if (shown) {
    return (
      <span>
        {"Kategorie: "}
        <span className="text-lead font-bold text-foreground">{shown.name}</span>
      </span>
    );
  }
  if (filter.length === 0 || !catalogue) return null;
  return (
    <span>
      {filter.length === 1 ? "Kategorie: " : "Kategorien: "}
      <span className="font-semibold text-foreground">
        {setupLabel({ categories: filter, showCategory: false }, catalogue)}
      </span>
    </span>
  );
}

/** Whether a room has a field rule worth a line of its own. */
export function hasCategoryRule(room: RoomCategoryFields | null | undefined): boolean {
  return Boolean(room?.category) || (room?.categories?.length ?? 0) > 0;
}
