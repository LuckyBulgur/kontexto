/**
 * Loading a room page without mistaking a restarting server for a closed room.
 *
 * After a deploy the update notice reloads every open room page
 * (`lib/update-check.ts`). nginx answers again before the API workers have
 * loaded their data, so for a few seconds every `/api` request comes back as a
 * 502 or not at all. The room clients used to read any failure of their first
 * load as "this room does not exist", and a failed `player-info` as "this token
 * is dead", which deleted the token from storage: a streamer whose page reloaded
 * mid-round was told the round was gone and lost the host seat for good, while
 * the round itself was running on.
 *
 * So a load is retried for as long as a container replacement takes, and only
 * an answer that says so decides that a room or a player is gone. Pure apart
 * from the timer, so the classification is testable.
 */

/** Shown when the server stayed away for the whole retry window. The room may well still run. */
export const ROOM_UNREACHABLE_MESSAGE = "Der Server antwortet gerade nicht. Lade die Seite gleich noch einmal, die Runde läuft weiter.";

/** Waits between attempts: quick at first, then every five seconds, about two minutes in all. */
export const ROOM_LOAD_RETRY_DELAYS_MS: readonly number[] = [
  1_000, 2_000, 3_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000,
  5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000,
  5_000, 5_000, 5_000, 5_000, 5_000, 5_000,
];

/** Client errors that a later attempt can still turn into an answer. */
const RETRYABLE_STATUS = new Set([408, 425, 429]);

/**
 * True when the server has answered and the answer is final: the room or the
 * player does not exist (`*_not_found`, a 404) or the request is refused for
 * good (any other 4xx). Everything else, a network failure, a 5xx from the
 * proxy, a timeout, is the server being away and worth another attempt.
 */
export function isFinalLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (/_not_found$/.test(error.message)) return true;
  const status = /^API error: (\d{3})$/.exec(error.message);
  if (!status) return false;
  const code = Number(status[1]);
  return code >= 400 && code < 500 && !RETRYABLE_STATUS.has(code);
}

/** True when the final answer says the thing asked for does not exist. */
export function isNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /_not_found$/.test(error.message) || error.message === "API error: 404";
}

export class LoadAbortedError extends Error {
  constructor() {
    super("load_aborted");
    this.name = "LoadAbortedError";
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new LoadAbortedError());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new LoadAbortedError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Runs `load` until it succeeds, fails with a final error, or the retries run
 * out; then it rethrows the last error. An aborted signal stops it with a
 * `LoadAbortedError`, also when an answer arrives after the abort, and the
 * caller ignores that error because the page moved on.
 */
export async function loadWithRetry<T>(
  load: () => Promise<T>,
  signal: AbortSignal,
  delays: readonly number[] = ROOM_LOAD_RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) throw new LoadAbortedError();
    let result: T;
    try {
      result = await load();
    } catch (error) {
      if (signal.aborted) throw new LoadAbortedError();
      if (isFinalLoadError(error) || attempt >= delays.length) throw error;
      await wait(delays[attempt], signal);
      continue;
    }
    // An answer that lands after the page moved on must not reach its state.
    if (signal.aborted) throw new LoadAbortedError();
    return result;
  }
}
