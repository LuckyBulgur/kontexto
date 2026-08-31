// Barrierefreiheits-Audit gegen den gebauten Export (pnpm a11y).
//
// Voraussetzung: der Export liegt in out/ und wird von e2e/serve.mjs auf Port
// 4173 ausgeliefert. Andere Adresse ueber A11Y_BASE.
//
// Warum ein eigenes Skript und keine Testsuite: axe braucht einen echten
// Browser und eine gerenderte Seite, das gehoert nicht in vitest. Und warum
// ueberhaupt: "nutzerfreundlich und navigierbar" ist ein ausdrueckliches
// Kriterium der AdSense-Pruefung, und Landmarken, Kontraste und
// Tastaturbedienbarkeit sind der messbare Teil davon.
//
// Stand 2026-08-31: 0 Verstoesse auf 21 Seiten. Vorher waren es 8 Regeltypen,
// darunter fehlende main-Landmarken auf 17 Seiten, nicht erreichbare
// Scrollbereiche und durchgehend zu schwache Farben (green-600, yellow-600,
// amber-600 reissen auf hellem Grund alle die 4,5:1).
// axe-core wird aus dem CDN in die Seite injiziert, damit dafuer keine
// Abhaengigkeit ins Projekt wandert. Nicht Teil der Testsuite, nur ein Werkzeug.
import { chromium } from "@playwright/test";

const BASE = process.env.A11Y_BASE || "http://127.0.0.1:4173";
const AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";

const PAGES = [
  "/", "/wordle/", "/duel/", "/koop/", "/faq/", "/anleitung/", "/strategie/",
  "/vergleich/", "/glossar/", "/blog/", "/blog/startwort-benchmark/", "/zahlen/",
  "/changelog/", "/ueber/", "/kontakt/", "/impressum/", "/nutzungsbedingungen/",
  "/datenschutz/", "/redaktion/", "/duel/create/", "/koop/create/",
];

const browser = await chromium.launch();
const all = new Map();

for (const path of PAGES) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200); // Hydration abwarten
    await page.addScriptTag({ url: AXE });
    const res = await page.evaluate(async () => {
      // @ts-expect-error axe kommt zur Laufzeit aus dem CDN
      return await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
      });
    });
    for (const v of res.violations) {
      const key = v.id;
      if (!all.has(key)) all.set(key, { impact: v.impact, help: v.help, pages: new Set(), sample: [] });
      const e = all.get(key);
      e.pages.add(path);
      if (e.sample.length < 2) e.sample.push(v.nodes[0]?.html?.slice(0, 160) ?? "");
    }
    console.log(`${path}: ${res.violations.length} Regelverstoesse`);
  } catch (err) {
    console.log(`${path}: FEHLER ${String(err).slice(0, 120)}`);
  }
  await page.close();
}

const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
console.log("\n===== Zusammenfassung =====");
for (const [id, e] of [...all.entries()].sort((a, b) => (order[a[1].impact] ?? 9) - (order[b[1].impact] ?? 9))) {
  console.log(`\n[${e.impact}] ${id}: ${e.help}`);
  console.log(`  Seiten (${e.pages.size}): ${[...e.pages].slice(0, 8).join(", ")}`);
  for (const s of e.sample) console.log(`  z.B. ${s}`);
}
if (all.size === 0) console.log("keine Verstoesse");
await browser.close();
