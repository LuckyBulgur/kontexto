import { describe, expect, it } from "vitest";
import { withPopularFirst } from "./popular-modes";

const LIST = [{ id: "leiter" }, { id: "limit" }, { id: "doppel" }, { id: "suddendeath" }];

describe("withPopularFirst", () => {
  it("moves the leader to the top and keeps the rest in catalogue order", () => {
    expect(withPopularFirst(LIST, "doppel").map((m) => m.id)).toEqual([
      "doppel",
      "leiter",
      "limit",
      "suddendeath",
    ]);
  });

  it("changes nothing when no leader is named", () => {
    expect(withPopularFirst(LIST, null)).toBe(LIST);
  });

  it("changes nothing when the leader already leads", () => {
    expect(withPopularFirst(LIST, "leiter")).toBe(LIST);
  });

  it("changes nothing for a mode this tab does not offer", () => {
    // The server names a mode per tab; a client that shows a subset must not
    // reorder itself around a name it cannot find.
    expect(withPopularFirst(LIST, "royale")).toBe(LIST);
  });

  it("does not mutate the list it was given", () => {
    const original = [...LIST];
    withPopularFirst(LIST, "suddendeath");
    expect(LIST).toEqual(original);
  });
});
