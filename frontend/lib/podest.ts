/**
 * How long a refusal holds the slot above a shared guess list.
 *
 * The slot shows the newest word, or the reason the player's own word was
 * refused. In a shared room other people keep guessing, and a refusal that
 * never gives way hides every word that arrives after it: on a stream board
 * the host types one unknown word and the chat's words stop appearing on top.
 * A refusal that gave way at once would be gone before it was read in a busy
 * chat, so it holds for a short, fixed time and then yields to the next word.
 */
export const PODEST_ERROR_MIN_MS = 2500;

/** Milliseconds the refusal shown since `shownAt` must still stay, between zero and the full hold. */
export function podestErrorRemaining(shownAt: number, now: number): number {
  return Math.min(PODEST_ERROR_MIN_MS, Math.max(0, PODEST_ERROR_MIN_MS - (now - shownAt)));
}
