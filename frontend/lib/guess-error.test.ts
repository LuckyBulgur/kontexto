import { describe, it, expect } from "vitest";
import { UnknownWordError, throwGuessNotFound } from "./guess-error";

function response(body: unknown): Response {
  return { json: async () => body } as Response;
}

describe("throwGuessNotFound", () => {
  it("carries the suggestions of an unknown word", async () => {
    await expect(
      throwGuessNotFound(response({ error: "unknown_word", suggestions: ["haus", "maus"] }))
    ).rejects.toMatchObject({ message: "unknown_word", suggestions: ["haus", "maus"] });
  });

  it("works without suggestions", async () => {
    await expect(
      throwGuessNotFound(response({ error: "unknown_word" }))
    ).rejects.toMatchObject({ message: "unknown_word", suggestions: [] });
  });

  it("keeps a room error a room error", async () => {
    // A 404 from a duel guess can also mean the room is gone. Reporting that as
    // an unknown word would blame the player for the server's answer.
    await expect(
      throwGuessNotFound(response({ error: "duel_not_found" }))
    ).rejects.toThrow("duel_not_found");
  });

  it("drops non-string suggestions", async () => {
    try {
      await throwGuessNotFound(response({ error: "unknown_word", suggestions: ["haus", 7, null] }));
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownWordError);
      expect((e as UnknownWordError).suggestions).toEqual(["haus"]);
    }
  });

  it("falls back to unknown_word when the body is not JSON", async () => {
    const broken = { json: async () => { throw new Error("not json"); } } as unknown as Response;
    await expect(throwGuessNotFound(broken)).rejects.toThrow("unknown_word");
  });
});
