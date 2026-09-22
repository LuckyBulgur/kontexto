"use client";

import { useEffect, useState } from "react";

/**
 * Which mode leads each tab of the picker, measured rather than asserted.
 *
 * The server counts a pick where a player commits to a mode: the first guess of
 * a solo round, a created room, a queue ticket. It answers with a name per tab
 * and never with a figure, so the badge can say "Beliebt" without publishing
 * how much traffic the site has. A tab whose lead is unclear, too few picks or
 * a tie, comes back null and simply carries no badge.
 *
 * The answer is cached in localStorage for one reason: **the list must not
 * move while it is open.** A row that jumps to the top a moment after the
 * dialog appears moves the row under the finger that is already reaching for
 * it. So the order of one opening is decided when it opens, out of what is
 * known then, and a freshly fetched answer applies to the next opening.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

const STORAGE_KEY = "kontexto_popular_modes";

/** The three tabs of the picker, as the server groups them. */
export type PickerGroup = "solo" | "friends" | "strangers";

export interface PopularModes {
  solo: string | null;
  friends: string | null;
  strangers: string | null;
}

const EMPTY: PopularModes = { solo: null, friends: null, strangers: null };

/** Narrow the server's answer without trusting it: an unknown mode id would
 *  otherwise badge nothing and silently reorder nothing, which is harder to
 *  spot than a value that never arrives. */
function parse(value: unknown): PopularModes {
  if (typeof value !== "object" || value === null) return EMPTY;
  const raw = value as Record<string, unknown>;
  const one = (key: PickerGroup): string | null =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : null;
  return { solo: one("solo"), friends: one("friends"), strangers: one("strangers") };
}

/** What the last visit learned, or nothing on the first one. Storage can be
 *  unavailable (private window, blocked site data), and a badge is not worth an
 *  exception on a page that works without it. */
export function readCachedPopular(): PopularModes {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parse(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeCachedPopular(modes: PopularModes): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(modes));
  } catch {
    /* a badge is not worth breaking on a browser that stores nothing */
  }
}

export async function fetchPopularModes(): Promise<PopularModes> {
  const res = await fetch(`${API_BASE}/modes/popular`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return parse(await res.json());
}

/**
 * The leaders to badge in this opening of the dialog.
 *
 * Returns the cached answer, frozen for as long as `open` stays true, and
 * refreshes the cache in the background for the next time. `open` going false
 * and true again is a new opening and picks up whatever arrived meanwhile.
 */
export function usePopularModes(open: boolean): PopularModes {
  const [frozen, setFrozen] = useState<PopularModes>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setFrozen(readCachedPopular());

    let cancelled = false;
    fetchPopularModes()
      .then((next) => {
        if (cancelled) return;
        writeCachedPopular(next);
      })
      .catch(() => {
        /* an unreachable badge stays absent, the picker keeps working */
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return frozen;
}

/**
 * The leader first, everything else in catalogue order.
 *
 * Pure, so the rule is testable without a dialog: an unknown or absent leader
 * changes nothing, and the rest of the list keeps the order somebody chose.
 */
export function withPopularFirst<T extends { id: string }>(
  entries: T[],
  leader: string | null
): T[] {
  if (!leader) return entries;
  const index = entries.findIndex((entry) => entry.id === leader);
  if (index <= 0) return entries;
  return [entries[index], ...entries.slice(0, index), ...entries.slice(index + 1)];
}
