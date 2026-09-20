/**
 * The 404 a guess endpoint answers with, in a form the UI can act on.
 *
 * A mistyped guess the server could not correct on its own comes back with the
 * words it might have meant. They are ordered by how close they are to what was
 * typed and how common they are in German, never by their rank in the running
 * game, so picking one up is not a hint.
 *
 * The thrown message stays `"unknown_word"`, which is the code the game clients
 * already branch on.
 */
export class UnknownWordError extends Error {
  readonly suggestions: string[];

  constructor(suggestions: string[]) {
    super("unknown_word");
    this.name = "UnknownWordError";
    this.suggestions = suggestions;
  }
}

/**
 * Turn a 404 from a guess endpoint into the right error.
 *
 * In a room (duel, koop, arena) a 404 can also mean the room or the player is
 * gone, so the body decides instead of the status code alone.
 */
export async function throwGuessNotFound(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  const code = typeof body?.error === "string" ? body.error : "unknown_word";
  if (code !== "unknown_word") throw new Error(code);
  const suggestions = Array.isArray(body?.suggestions)
    ? body.suggestions.filter((word: unknown): word is string => typeof word === "string")
    : [];
  throw new UnknownWordError(suggestions);
}
