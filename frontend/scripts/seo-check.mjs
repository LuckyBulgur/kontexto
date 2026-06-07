// Asserts SEO invariants against the static export in ./out. Exit 1 on any failure.
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const OUT = resolve(process.cwd(), "out");
const failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); };

async function read(rel) {
  try { return await readFile(resolve(OUT, rel), "utf8"); }
  catch { failures.push(`missing file: ${rel}`); return ""; }
}
async function exists(rel) {
  try { await access(resolve(OUT, rel)); return true; } catch { return false; }
}

const home = await read("index.html");
ok(home.includes("</html>"), "home: not a full HTML document");
ok(await exists("robots.txt"), "robots.txt missing");
ok(await exists("sitemap.xml"), "sitemap.xml missing");
ok(await exists("404.html"), "404.html missing");

// Extended per-phase (canonical/H1/content/schema) checks are appended below in later tasks.
export const checks = { home }; // exported for reuse

const routes = [
  ["index.html", 'href="https://kontexto.de/"'],
  ["wordle/index.html", 'href="https://kontexto.de/wordle/"'],
  ["duel/index.html", 'href="https://kontexto.de/duel/"'],
  ["wordle/duel/index.html", 'href="https://kontexto.de/wordle/duel/"'],
];
for (const [file, canon] of routes) {
  const html = await read(file);
  ok(html.includes(canon), `${file}: missing self-canonical ${canon}`);
  ok((html.match(/<h1/g) || []).length === 1, `${file}: expected exactly one <h1>`);
}

for (const [file] of routes) {
  const html = (await read(file)).toLowerCase();
  ok(html.includes('hreflang="x-default"'), `${file}: missing x-default hreflang`);
  ok(html.includes('hreflang="de-de"'), `${file}: missing de-DE hreflang`);
}

const robotsTxt = await read("robots.txt");
ok(robotsTxt.includes("Disallow: /admin/"), "robots.txt: /admin/ not disallowed");
const sm = await read("sitemap.xml");
ok(sm.includes("/wordle/"), "sitemap: missing /wordle/");

// --- Content/marketing pages: canonical, single H1, hreflang, depth, schema ---
const visibleWords = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;

const contentPages = [
  { file: "anleitung/index.html", path: "/anleitung/", minWords: 400, schema: '"@type":"HowTo"' },
  { file: "strategie/index.html", path: "/strategie/", minWords: 500 },
  { file: "faq/index.html", path: "/faq/", minWords: 400, schema: '"@type":"FAQPage"' },
  { file: "ueber/index.html", path: "/ueber/", minWords: 400 },
  { file: "vergleich/index.html", path: "/vergleich/", minWords: 450 },
  { file: "glossar/index.html", path: "/glossar/", minWords: 350, schema: '"@type":"DefinedTermSet"' },
  { file: "blog/index.html", path: "/blog/", minWords: 250 },
];
for (const p of contentPages) {
  const html = await read(p.file);
  const low = html.toLowerCase();
  ok(html.includes(`href="https://kontexto.de${p.path}"`), `${p.file}: missing self-canonical`);
  ok((html.match(/<h1/g) || []).length === 1, `${p.file}: expected exactly one <h1>`);
  ok(low.includes('hreflang="x-default"'), `${p.file}: missing x-default hreflang`);
  ok(low.includes('hreflang="de-de"'), `${p.file}: missing de-DE hreflang`);
  const w = visibleWords(html);
  ok(w >= p.minWords, `${p.file}: thin content (${w} < ${p.minWords} words)`);
  if (p.schema) ok(html.includes(p.schema), `${p.file}: missing ${p.schema}`);
  ok(sm.includes(p.path), `sitemap: missing ${p.path}`);
}

// --- Blog posts: self-canonical, BlogPosting schema, single H1 ---
const blogSlugs = [
  ...new Set([...sm.matchAll(/\/blog\/([a-z0-9-]+)\//g)].map((m) => m[1])),
];
ok(blogSlugs.length >= 8, `expected >=8 blog posts in sitemap, found ${blogSlugs.length}`);
for (const slug of blogSlugs) {
  const html = await read(`blog/${slug}/index.html`);
  ok(html.includes(`href="https://kontexto.de/blog/${slug}/"`), `blog/${slug}: missing self-canonical`);
  ok(html.includes('"@type":"BlogPosting"'), `blog/${slug}: missing BlogPosting schema`);
  ok((html.match(/<h1/g) || []).length === 1, `blog/${slug}: expected exactly one <h1>`);
}

if (process.env.KONTEXTO_REQUIRE_IMPRESSUM === "1") {
  const imp = await read("impressum/index.html");
  ok(!imp.includes("werden vor Veröffentlichung ergänzt"), "impressum: legal data not filled in for production");
}

if (failures.length) { console.error("SEO CHECK FAILED:\n" + failures.map(f => " - " + f).join("\n")); process.exit(1); }
console.log("SEO check passed.");
