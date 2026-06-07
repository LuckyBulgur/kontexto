import { describe, it, expect } from "vitest";
import { glossary } from "./glossary";

describe("glossary", () => {
  it("has a meaningful set of terms", () => {
    expect(glossary.length).toBeGreaterThanOrEqual(10);
  });

  it("slugs are unique, ASCII and kebab-case", () => {
    const slugs = glossary.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("every term has a non-trivial definition", () => {
    for (const t of glossary) {
      expect(t.term.trim().length).toBeGreaterThan(0);
      expect(t.definition.trim().length).toBeGreaterThan(40);
    }
  });

  it("is sorted alphabetically by term (locale-aware)", () => {
    const sorted = [...glossary].sort((a, b) => a.term.localeCompare(b.term, "de"));
    expect(glossary.map((t) => t.term)).toEqual(sorted.map((t) => t.term));
  });
});
