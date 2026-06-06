import { describe, it, expect } from "vitest";
import { buildMetadata } from "./seo";

describe("buildMetadata", () => {
  it("sets a self-referencing canonical", () => {
    const m = buildMetadata({ path: "/wordle/", title: "Wördle", description: "x" });
    expect(m.alternates?.canonical).toBe("/wordle/");
  });
});
