import { describe, it, expect } from "vitest";
import {
  gameSchema,
  breadcrumb,
  blogPostingSchema,
  definedTermSetSchema,
  howToSchema,
} from "./structured-data";

describe("structured-data", () => {
  it("game is co-typed WebApplication + VideoGame", () => {
    expect(gameSchema()["@type"]).toEqual(["WebApplication", "VideoGame"]);
  });
  it("breadcrumb numbers positions from 1", () => {
    const b = breadcrumb([{ name: "Start", path: "/" }, { name: "FAQ", path: "/faq/" }]);
    expect(b.itemListElement[1].position).toBe(2);
  });
  it("omits AggregateRating when count is 0", () => {
    expect(gameSchema({ ratingValue: 0, ratingCount: 0 }).aggregateRating).toBeUndefined();
  });

  it("blogPosting defaults dateModified to datePublished", () => {
    const s = blogPostingSchema({ title: "T", description: "D", slug: "x", date: "2026-06-06" });
    expect(s.dateModified).toBe("2026-06-06");
    expect(s.url).toBe("https://kontexto.de/blog/x/");
    expect(s.image).toContain("https://kontexto.de");
  });
  it("blogPosting uses explicit updated date when given", () => {
    const s = blogPostingSchema({ title: "T", description: "D", slug: "x", date: "2026-06-06", updated: "2026-06-07" });
    expect(s.dateModified).toBe("2026-06-07");
  });

  it("definedTermSet links each term to its anchor", () => {
    const s = definedTermSetSchema("Glossar", "/glossar/", [
      { term: "Rang", slug: "rang", definition: "…" },
    ]);
    expect(s["@type"]).toBe("DefinedTermSet");
    expect(s.hasDefinedTerm[0].url).toBe("https://kontexto.de/glossar/#rang");
  });

  it("howTo numbers steps from 1", () => {
    const s = howToSchema({
      name: "Spielen",
      description: "…",
      path: "/anleitung/",
      steps: [{ name: "A", text: "a" }, { name: "B", text: "b" }],
    });
    expect(s.step.map((x) => x.position)).toEqual([1, 2]);
  });
});
