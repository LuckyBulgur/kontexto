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

/**
 * How long a note stays on screen, whatever its length. Fixed on purpose: the
 * operator asked for five seconds, and a note that leaves on a predictable beat
 * is one the streamer learns to glance at. It used to scale with the length and
 * pause while hovered, and since a pointer coming down from the tab strip lands
 * exactly where the note drops in, it often never left without a click.
 */
export const HOST_MESSAGE_DURATION_MS = 5000;

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
