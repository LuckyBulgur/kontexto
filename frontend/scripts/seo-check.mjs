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

if (failures.length) { console.error("SEO CHECK FAILED:\n" + failures.map(f => " - " + f).join("\n")); process.exit(1); }
console.log("SEO check passed.");
