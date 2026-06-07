import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { posts, postsByCategory } from "./blog";

const root = resolve(import.meta.dirname, "..");

describe("blog registry", () => {
  it("slugs are unique and kebab-case", () => {
    const slugs = posts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("every post has a matching MDX file on disk", () => {
    for (const p of posts) {
      const file = resolve(root, "content/blog", `${p.slug}.mdx`);
      expect(existsSync(file), `missing ${p.slug}.mdx`).toBe(true);
    }
  });

  it("every post is wired into the [slug] loader map", () => {
    const src = readFileSync(resolve(root, "app/blog/[slug]/page.tsx"), "utf8");
    for (const p of posts) {
      expect(src.includes(`"${p.slug}"`), `loader map missing ${p.slug}`).toBe(true);
    }
  });

  it("dates are ISO and updated is not before published", () => {
    for (const p of posts) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (p.updated) expect(p.updated >= p.date).toBe(true);
    }
  });

  it("groups posts by category without dropping any", () => {
    const groups = postsByCategory();
    const total = Object.values(groups).reduce((n, g) => n + g.length, 0);
    expect(total).toBe(posts.length);
  });
});
