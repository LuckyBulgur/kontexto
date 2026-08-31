import { describe, it, expect } from "vitest";
import { faqs, homeFaqs, faqGroups } from "./faqs";

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

  // Die /faq/-Fassung traegt die Seite allein und muss deshalb ausfuehrlich
  // sein. 60 Woerter je Antwort ist die Untergrenze, unterhalb derer die Seite
  // wieder auf das Niveau der Startseiten-Kurzfassungen zurueckfaellt.
  it("answers on /faq/ are long-form", () => {
    for (const f of faqs) {
      expect(f.a.trim().split(/\s+/).length, `zu kurz: ${f.q}`).toBeGreaterThanOrEqual(60);
    }
  });
});

describe("homeFaqs", () => {
  it("is a short selection of six core questions", () => {
    expect(homeFaqs).toHaveLength(6);
  });

  it("asks questions that the full FAQ also answers", () => {
    const full = new Set(faqs.map((f) => f.q));
    for (const f of homeFaqs) expect(full.has(f.q), `nicht in faqs: ${f.q}`).toBe(true);
  });

  /**
   * Der eigentliche Zweck der zweiten Liste. Vorher rendered die Startseite
   * dieselbe FAQ wie /faq/, wodurch beide indexierten Seiten zu 92 Prozent aus
   * demselben Text bestanden. Waere eine Antwort hier wieder aus `faqs`
   * kopiert, entstuende genau dieses Duplikat neu, und der Duplikatswaechter in
   * scripts/seo-check.mjs schlaegt erst nach einem vollen Build an.
   */
  it("never reuses an answer text from the full FAQ", () => {
    const byQuestion = new Map(faqs.map((f) => [f.q, f.a]));
    for (const f of homeFaqs) {
      expect(f.a, `Antwort kopiert: ${f.q}`).not.toBe(byQuestion.get(f.q));
    }
  });

  it("stays short enough to work as a teaser", () => {
    for (const f of homeFaqs) {
      const words = f.a.trim().split(/\s+/).length;
      expect(words, `zu lang: ${f.q}`).toBeLessThanOrEqual(45);
    }
  });

  it("shares no eight-word sequence with the full FAQ", () => {
    const shingles = (text: string) => {
      const w = text.split(/\s+/).filter(Boolean);
      const out = new Set<string>();
      for (let i = 0; i + 8 <= w.length; i += 1) out.add(w.slice(i, i + 8).join(" "));
      return out;
    };
    const fullText = faqs.map((f) => `${f.q} ${f.a}`).join(" ");
    const full = shingles(fullText);
    for (const f of homeFaqs) {
      for (const sh of shingles(f.a)) {
        expect(full.has(sh), `wortgleiche Passage in "${f.q}": ${sh}`).toBe(false);
      }
    }
  });
});

describe("faqGroups", () => {
  it("uses every question of the full FAQ exactly once", () => {
    const used = faqGroups.flatMap((g) => g.items.map((f) => f.q));
    expect(used).toHaveLength(faqs.length);
    expect(new Set(used).size).toBe(faqs.length);
    for (const f of faqs) expect(used, `nicht gruppiert: ${f.q}`).toContain(f.q);
  });

  it("has unique, anchor-safe group ids", () => {
    const ids = faqGroups.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
});
