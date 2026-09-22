"use client";

import { useEffect, useState } from "react";

/** The `md` breakpoint of the Tailwind scale, as a media query. */
export const MEDIA_DESKTOP = "(min-width: 48rem)";

/**
 * Whether a media query matches right now.
 *
 * For the cases where CSS alone cannot decide, because the two layouts are
 * different components rather than the same markup styled differently. The
 * mode picker is one: a centred dialog on a desktop, a sheet that comes up
 * from the bottom on a phone. Rendering both and hiding one with `hidden`
 * would mount two overlays, run two focus traps and read out twice.
 *
 * Starts at `false` and corrects in an effect, the same way
 * `useReducedMotion` does and for the same reason: the static export has no
 * `window`, and a value read during render would make server and client markup
 * disagree. So the first paint is the phone layout, which is the safe way
 * round: it fits on a desktop, where the other way round does not fit a phone.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
