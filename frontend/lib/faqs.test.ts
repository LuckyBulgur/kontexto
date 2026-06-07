import { describe, it, expect } from "vitest";
import { faqs } from "./faqs";

describe("faqs", () => {
  it("covers a broad set of long-tail questions", () => {
    expect(faqs.length).toBeGreaterThanOrEqual(12);
  });

  it("every entry is a real question with a substantial answer", () => {
    for (const f of faqs) {
      expect(f.q.trim().endsWith("?")).toBe(true);
      expect(f.a.trim().length).toBeGreaterThan(40);
    }
  });

  it("has no duplicate questions", () => {
    const qs = faqs.map((f) => f.q);
    expect(new Set(qs).size).toBe(qs.length);
  });
});
