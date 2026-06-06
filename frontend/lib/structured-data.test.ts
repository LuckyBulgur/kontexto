import { describe, it, expect } from "vitest";
import { gameSchema, organizationSchema, websiteSchema, breadcrumb, faqSchema } from "./structured-data";

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
});
