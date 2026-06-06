import { describe, it, expect } from "vitest";
import { buildMetadata, SITE_URL } from "./seo";

describe("buildMetadata", () => {
  it("self-referencing canonical", () => {
    expect(buildMetadata({ path: "/wordle/", title: "W", description: "d" }).alternates?.canonical).toBe("/wordle/");
  });
  it("sets og url to absolute path", () => {
    const og = buildMetadata({ path: "/faq/", title: "F", description: "d" }).openGraph;
    expect(og?.url).toBe(`${SITE_URL}/faq/`);
  });
  it("home uses '/' canonical", () => {
    expect(buildMetadata({ path: "/", title: "H", description: "d" }).alternates?.canonical).toBe("/");
  });
  it("emits self-referencing de-DE and x-default hreflang", () => {
    const langs = buildMetadata({ path: "/faq/", title: "F", description: "d" }).alternates?.languages;
    expect(langs?.["de-DE"]).toBe("/faq/");
    expect(langs?.["x-default"]).toBe("/faq/");
  });
});
