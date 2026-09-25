import type { LiveHostMessage } from "./live-types";

/**
 * The rules behind the operator's notes on the host page, kept apart from the
 * component so they can be tested without a DOM.
 *
 * A note is shown once, one at a time, and leaves by itself. The server keeps
 * handing it out until the host page confirms it, so the page must be the one
 * that remembers what it already showed: a poll that lands between showing a
 * note and the confirmation reaching the server returns the same note again.
 */

/** Shortest and longest time a note stays on screen. */
export const HOST_MESSAGE_MIN_MS = 6000;
export const HOST_MESSAGE_MAX_MS = 15000;

/** Extra reading time per character, on top of the minimum. */
const MS_PER_CHAR = 60;

/**
 * How long a note stays. Long enough to read it between two glances at the
 * chat, capped so a long note does not sit over the board for half a minute.
 */
export function hostMessageDurationMs(text: string): number {
  const length = [...text].length;
  return Math.min(HOST_MESSAGE_MAX_MS, HOST_MESSAGE_MIN_MS + length * MS_PER_CHAR);
}

/**
 * The notes from a poll that have not been queued yet, oldest first.
 * `known` is every id this page already queued or showed.
 */
export function freshHostMessages(
  incoming: readonly LiveHostMessage[],
  known: ReadonlySet<number>
): LiveHostMessage[] {
  return incoming
    .filter((message) => !known.has(message.id))
    .sort((a, b) => a.id - b.id);
}

/**
 * Whether a poll still carries notes this page already showed, which means the
 * confirmation did not arrive and has to be sent again.
 */
export function needsAckRetry(
  incoming: readonly LiveHostMessage[],
  shownUpTo: number
): boolean {
  return shownUpTo > 0 && incoming.some((message) => message.id <= shownUpTo);
}
