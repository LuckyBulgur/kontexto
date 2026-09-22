// Asserts SEO invariants against the static export in ./out. Exit 1 on any failure.
import { readFile, access, readdir } from "node:fs/promises";
import { resolve, join, relative } from "node:path";

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

// Die sichtbare Statistik auf der Startseite stammt aus denselben Snapshots wie
// die Daten-Seite. Dieser Check verhindert, dass ein späterer Export die
// redaktionell eingebetteten Zahlen unbemerkt von der Startseite entkoppelt.
const readSourceJson = async (rel) => {
  try {
    return JSON.parse(await readFile(resolve(process.cwd(), rel), "utf8"));
  } catch {
    failures.push(`source data missing or invalid: ${rel}`);
    return null;
  }
};
const publicStatsData = await readSourceJson("content/data/public-stats.json");
const benchmarkData = await readSourceJson("content/data/startword-benchmark.json");
if (publicStatsData && benchmarkData) {
  const snapshotDate = new Date(`${publicStatsData.generated_on}T12:00:00Z`).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  for (const fragment of [
    snapshotDate,
    new Intl.NumberFormat("de-DE").format(publicStatsData.totals.guesses),
    new Intl.NumberFormat("de-DE").format(publicStatsData.totals.solves),
    new Intl.NumberFormat("de-DE").format(benchmarkData.games_evaluated),
  ]) {
    ok(home.includes(fragment), `home: published data fragment missing ${fragment}`);
  }

  const benchmarkRank = [...benchmarkData.results]
    .sort((a, b) => b.share_under_1500 - a.share_under_1500)
    .findIndex((result) => result.word === "wasser") + 1;
  ok(benchmarkRank > 0, "benchmark: wasser is missing from the published results");
  ok(
    home.includes(`Platz ${benchmarkRank} von ${benchmarkData.results.length}`),
    `home: wasser rank is not aligned with the benchmark snapshot (expected ${benchmarkRank})`,
  );

  const totals = publicStatsData.totals;
  ok(publicStatsData.top_words.length === 100, "stats: expected exactly 100 top words");
  ok(
    totals.solves + totals.reveals > 0,
    "stats: solved and revealed totals must contain finished games",
  );
  ok(
    publicStatsData.guesses_per_solve ===
      Number((totals.guesses / totals.solves).toFixed(1)),
    "stats: guesses_per_solve is not aligned with rounded totals",
  );

  const dailySeries = [
    ...publicStatsData.last_30_days.guesses,
    ...publicStatsData.last_30_days.solves,
  ];
  ok(
    dailySeries.length > 0 && dailySeries.every((row) => row.value >= 0 && row.date <= publicStatsData.generated_on),
    "stats: daily values must be non-negative and not future-dated",
  );

  const benchmarkWords = benchmarkData.results.map((result) => result.word);
  ok(
    new Set(benchmarkWords).size === benchmarkWords.length,
    "benchmark: candidate words must be unique",
  );
  ok(
    benchmarkData.results.every(
      (result) =>
        result.games === benchmarkData.games_evaluated &&
        result.share_under_300 >= 0 &&
        result.share_under_300 <= 1 &&
        result.share_under_1500 >= 0 &&
        result.share_under_1500 <= 1,
    ),
    "benchmark: result rows are not aligned with the evaluated game count",
  );
}
ok(!home.includes("Eigenes deutsches Sprachmodell"), "home: external fastText model must not be claimed as own");
ok(home.includes("Meta AI Research"), "home: external fastText model attribution missing");

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

// --- AdSense: der Codeschnipsel muss ohne JavaScript im HTML stehen ---
// Mit next/script strategy="afterInteractive" rendert Next nur ein
// <link rel="preload">, das Script-Tag entsteht erst nach der Hydration. Fuer
// eine Website-Pruefung, die kein JavaScript ausfuehrt, gibt es dann keinen
// Anzeigencode auf der Seite. Beides wird hier festgehalten: der Loader und das
// Verifizierungs-Meta-Tag, auf jeder Seite, die Anzeigen tragen darf.
// Bewusst als Regex und nicht als fester String: React gibt boolesche
// Attribute als async="" aus und die Attributreihenfolge ist nicht zugesichert.
// Gesucht wird ein echtes <script>-Tag mit dieser Quelle, ein
// <link rel="preload"> darf nicht durchgehen.
const ADS_LOADER =
  /<script[^>]+src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-3545758989514084"/;
for (const file of ["index.html", "wordle/index.html", "faq/index.html"]) {
  const html = await read(file);
  const m = html.match(ADS_LOADER);
  ok(m !== null, `${file}: AdSense loader not in the static HTML (a preload link is not the snippet)`);
  if (m) {
    ok(
      m.index < html.indexOf("</head>"),
      `${file}: AdSense loader is not inside <head>`,
    );
  }
  ok(
    html.includes('name="google-adsense-account" content="ca-pub-3545758989514084"'),
    `${file}: missing google-adsense-account verification meta tag`,
  );
}
ok(await exists("ads.txt"), "ads.txt missing");
const adsTxt = await read("ads.txt");
ok(adsTxt.includes("pub-3545758989514084"), "ads.txt: publisher id missing");

const robotsTxt = await read("robots.txt");
ok(robotsTxt.includes("Disallow: /admin/"), "robots.txt: /admin/ not disallowed");
const sm = await read("sitemap.xml");
ok(sm.includes("/wordle/"), "sitemap: missing /wordle/");

// The production container is served by the repository's nginx config, not
// by Next.js. Keep the duplicate-file redirect in the same regression gate as
// the exported sitemap, otherwise `/index.html` could silently return as a
// second 200-page after a server-config edit.
const nginxConfig = await readFile(resolve(process.cwd(), "..", "nginx.conf"), "utf8").catch(() => "");
ok(nginxConfig.includes("location = /index.html"), "nginx: root index.html must redirect");
ok(nginxConfig.includes("location ~ ^/(.+)/index\\.html$"), "nginx: nested index.html files must redirect");
ok(nginxConfig.includes("location = /404.html") && nginxConfig.includes("internal;"), "nginx: 404.html must stay internal");
ok(nginxConfig.includes("location ~ ^/(?:_not-found|404)(?:/|$)"), "nginx: internal error-route directories must stay private");

// The export necessarily contains physical index.html files, but production
// nginx must not expose them as separate crawlable 200-URLs. The redirect is
// checked in the E2E proxy; this static check documents the complete set of
// canonical public URLs that the server must preserve.
for (const path of ["/", "/faq/", "/wordle/", "/blog/"]) {
  ok(sm.includes(`<loc>https://kontexto.de${path}</loc>`), `sitemap: canonical route missing ${path}`);
}

// Die Sitemap ist eine bewusst gepflegte Liste der indexierbaren öffentlichen
// Seiten. Ein Check, der nur einzelne Beispiele prüft, lässt einen versehentlich
// entfernten Eintrag unbemerkt durch. Diese Liste spiegelt deshalb die
// veröffentlichte Seiten-Inventur wider; funktionale Create-/Room-URLs gehören
// nicht dazu, weil sie noindex sind.
const expectedStaticSitemapPaths = [
  "/", "/wordle/", "/duel/", "/koop/", "/wordle/duel/",
  "/modi/", "/arena/", "/live/",
  "/solo/leiter/", "/solo/limit/", "/solo/doppelziel/", "/solo/sudden-death/",
  "/faq/", "/anleitung/", "/strategie/", "/vergleich/", "/glossar/",
  "/ueber/", "/redaktion/", "/blog/", "/zahlen/", "/changelog/",
  "/kontakt/", "/impressum/", "/nutzungsbedingungen/", "/cookies/",
  "/datenschutz/",
];
for (const path of expectedStaticSitemapPaths) {
  ok(sm.includes(`<loc>https://kontexto.de${path}</loc>`), `sitemap: missing static route ${path}`);
}

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
  // Die Startseite steht hier mit drin, weil sie eine der beiden Seiten ist,
  // die später manuelle Anzeigen tragen dürfen, und deshalb nie versehentlich
  // zu einer reinen Widget-Seite werden darf. Diese Wortzahlen sind interne
  // Regression-Schwellen, keine Google-Mindestanforderungen.
  { file: "index.html", path: "/", minWords: 1000, schema: '"@type":"FAQPage"' },
  { file: "anleitung/index.html", path: "/anleitung/", minWords: 800, schema: '"@type":"HowTo"' },
  { file: "strategie/index.html", path: "/strategie/", minWords: 900 },
  { file: "faq/index.html", path: "/faq/", minWords: 700, schema: '"@type":"FAQPage"' },
  { file: "ueber/index.html", path: "/ueber/", minWords: 700 },
  // Redaktionelle Grundsaetze: Vertrauensseite, gehoert zu About/Kontakt/Terms.
  { file: "redaktion/index.html", path: "/redaktion/", minWords: 700 },
  { file: "vergleich/index.html", path: "/vergleich/", minWords: 800 },
  { file: "glossar/index.html", path: "/glossar/", minWords: 700, schema: '"@type":"DefinedTermSet"' },
  { file: "blog/index.html", path: "/blog/", minWords: 250 },
  { file: "kontakt/index.html", path: "/kontakt/", minWords: 250 },
  // Nutzungsbedingungen gehoeren zu den Vertrauenssignalen, auf die eine
  // AdSense-Pruefung achtet (About, Kontakt, Datenschutz, Terms). Die Seite
  // darf deshalb nicht zur Formsache schrumpfen.
  { file: "nutzungsbedingungen/index.html", path: "/nutzungsbedingungen/", minWords: 500 },
  { file: "cookies/index.html", path: "/cookies/", minWords: 600 },
  { file: "changelog/index.html", path: "/changelog/", minWords: 400 },
  { file: "zahlen/index.html", path: "/zahlen/", minWords: 800 },
  // Spielseiten. /wordle/ traegt Anzeigen und darf deshalb nie wieder duenn werden:
  // Googles Richtlinie verbietet Anzeigen auf Seiten ohne Publisher-Inhalt.
  { file: "wordle/index.html", path: "/wordle/", minWords: 800, schema: '"@type":"FAQPage"' },
  { file: "duel/index.html", path: "/duel/", minWords: 600, schema: '"@type":"FAQPage"' },
  { file: "koop/index.html", path: "/koop/", minWords: 600, schema: '"@type":"FAQPage"' },
  { file: "modi/index.html", path: "/modi/", minWords: 600, schema: '"@type":"FAQPage"' },
  { file: "arena/index.html", path: "/arena/", minWords: 600, schema: '"@type":"FAQPage"' },
  { file: "live/index.html", path: "/live/", minWords: 600, schema: '"@type":"FAQPage"' },
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

// Die Spiel-Landingpages haben bewusst keine vorgeschaltete Bannerkarte mehr.
// Der redaktionelle Kontext bleibt statisch unterhalb des Spiels; so bleibt die
// Seite für Crawler vollständig erklärbar, ohne den Spieleinstieg zu überbauen.
const gameLandingPages = [
  "index.html",
  "wordle/index.html",
  "duel/index.html",
  "koop/index.html",
  "wordle/duel/index.html",
];
for (const file of gameLandingPages) {
  const html = await read(file);
  const mainStart = html.indexOf("<main");
  const gameStart = html.indexOf('id="spielbereich"');
  ok(mainStart >= 0 && gameStart > mainStart, `${file}: game area must be inside main`);
  if (mainStart >= 0 && gameStart > mainStart) {
    const beforeGame = html.slice(mainStart, gameStart);
    ok(!beforeGame.includes("Bedeutung statt Buchstaben"), `${file}: old Kontexto intro banner is still present`);
    ok(!beforeGame.includes("Buchstaben statt Bedeutung"), `${file}: old Wördle intro banner is still present`);
  }
  if (gameStart >= 0) {
    const contentAfterGame = html.slice(gameStart);
    ok(contentAfterGame.includes("<h1"), `${file}: static SEO content after game must contain the page H1`);
  }
}

// --- Duplikatswaechter: keine zwei indexierten Seiten mit demselben Text ---
// Anlass: /faq/ teilte 92 Prozent seiner Acht-Wort-Folgen mit der Startseite,
// beide indexiert, beide mit identischem FAQPage-Markup. Google waehlt in so
// einem Fall selbst eine kanonische Seite und wertet die andere als redundant;
// im AdSense-Review faellt das unter "minderwertige Inhalte". Gemessen wird am
// kleineren der beiden Mengen, damit eine kurze Seite, die vollstaendig in
// einer langen aufgeht, nicht durchrutscht.
const SHINGLE_N = 8;
const MAX_OVERLAP = 0.25;
const shingles = (html) => {
  const w = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const out = new Set();
  for (let i = 0; i + SHINGLE_N <= w.length; i += 1) out.add(w.slice(i, i + SHINGLE_N).join(" "));
  return out;
};
const dupeCandidates = [];
for (const p of contentPages) {
  const html = await read(p.file);
  if (html) dupeCandidates.push({ path: p.path, set: shingles(html) });
}
for (let i = 0; i < dupeCandidates.length; i += 1) {
  for (let j = i + 1; j < dupeCandidates.length; j += 1) {
    const a = dupeCandidates[i];
    const b = dupeCandidates[j];
    if (a.set.size < 40 || b.set.size < 40) continue;
    let shared = 0;
    for (const sh of a.set) if (b.set.has(sh)) shared += 1;
    const ratio = shared / Math.min(a.set.size, b.set.size);
    ok(
      ratio <= MAX_OVERLAP,
      `duplicate content: ${a.path} and ${b.path} share ${(ratio * 100).toFixed(1)}% of their text (max ${MAX_OVERLAP * 100}%)`,
    );
  }
}

// --- Blog posts: self-canonical, BlogPosting schema, single H1 ---
const blogSlugs = [
  ...new Set([...sm.matchAll(/\/blog\/([a-z0-9-]+)\//g)].map((m) => m[1])),
];
const blogSourceEntries = await readdir(resolve(process.cwd(), "content/blog"), { withFileTypes: true });
const expectedBlogSlugs = blogSourceEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
  .map((entry) => entry.name.slice(0, -4))
  .sort();
const sortedSitemapBlogSlugs = [...blogSlugs].sort();
ok(
  sortedSitemapBlogSlugs.length === expectedBlogSlugs.length,
  `sitemap: expected ${expectedBlogSlugs.length} blog posts, found ${sortedSitemapBlogSlugs.length}`,
);
for (const slug of expectedBlogSlugs) {
  ok(blogSlugs.includes(slug), `sitemap: missing blog post /blog/${slug}/`);
}
for (const slug of blogSlugs) {
  ok(expectedBlogSlugs.includes(slug), `sitemap: blog URL has no source file /blog/${slug}/`);
}

// Die Sitemap ist nicht nur auf fehlende Einträge, sondern auch auf unerwartete
// URLs geprüft. Damit kann ein später hinzugefügter funktionaler Pfad nicht
// stillschweigend als indexierbarer Inhalt veröffentlicht werden.
const sitemapLocs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const expectedSitemapLocs = new Set([
  ...expectedStaticSitemapPaths.map((path) => `https://kontexto.de${path}`),
  ...expectedBlogSlugs.map((slug) => `https://kontexto.de/blog/${slug}/`),
]);
ok(
  sitemapLocs.length === expectedSitemapLocs.size,
  `sitemap: expected exactly ${expectedSitemapLocs.size} URLs, found ${sitemapLocs.length}`,
);
for (const loc of sitemapLocs) {
  ok(expectedSitemapLocs.has(loc), `sitemap: unexpected URL ${loc}`);
}

// Funktionale Lobby-Formulare bleiben explizit außerhalb der Sitemap und
// noindex. Das wird getrennt geprüft, weil sie beim Build trotzdem als
// statische HTML-Seiten entstehen.
const functionalPages = [
  ["duel/create/index.html", "/duel/create/"],
  ["koop/create/index.html", "/koop/create/"],
  ["wordle/duel/create/index.html", "/wordle/duel/create/"],
  // Die OBS-Einblendung ist keine Seite zum Lesen: sie traegt ein Raum-Token in
  // der Query und zeigt genau ein Brett.
  ["live/overlay/index.html", "/live/overlay/"],
];
for (const [file, path] of functionalPages) {
  const html = await read(file);
  ok(html.toLowerCase().includes("noindex"), `${file}: functional page must be noindex`);
  ok(!sm.includes(path), `sitemap: functional URL must stay omitted ${path}`);
  ok(!html.includes('class="adsbygoogle"'), `${file}: functional page must not contain an ad slot`);
}

// Google veröffentlicht keine belastbare Mindestwortzahl. Diese Schwelle ist
// deshalb nur ein interner Schutz gegen versehentlich stark gekürzte Artikel;
// sie ersetzt keine redaktionelle Prüfung auf Eigenständigkeit und Nutzen.
const MIN_BLOG_WORDS = 1200;
const MIN_BLOG_POSTS = 18;
ok(
  blogSlugs.length >= MIN_BLOG_POSTS,
  `expected >=${MIN_BLOG_POSTS} blog posts in sitemap, found ${blogSlugs.length}`,
);
for (const slug of blogSlugs) {
  const html = await read(`blog/${slug}/index.html`);
  ok(html.includes(`href="https://kontexto.de/blog/${slug}/"`), `blog/${slug}: missing self-canonical`);
  ok(html.includes('"@type":"BlogPosting"'), `blog/${slug}: missing BlogPosting schema`);
  ok((html.match(/<h1/g) || []).length === 1, `blog/${slug}: expected exactly one <h1>`);
  const w = visibleWords(html);
  ok(w >= MIN_BLOG_WORDS, `blog/${slug}: thin content (${w} < ${MIN_BLOG_WORDS} words)`);
}

// --- Typografie über den gesamten Auslieferungsstand ---
// Geviertstrich und Horizontal Bar sind projektweit verboten; im Deutschen ist der
// Gedankenstrich falsch und er ist ein sofort sichtbarer Marker für maschinell
// erzeugten Text. Gerade Anführungszeichen im Fließtext sind ebenfalls ein Fehler:
// deutsche Paare sind „…“.
async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

// Eine URL in der Sitemap sollte nicht nur formal existieren, sondern auch
// über mindestens einen dauerhaften internen Link erreichbar sein. Das ist ein
// lokaler Orphan-Schutz; die Search Console kann damit nicht ersetzt werden,
// weil Google seine eigene Crawl- und Sitemap-Zuordnung führt.
const normalizeRoute = (value) => {
  if (value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
};
const sitemapIncoming = new Map(
  sitemapLocs.map((loc) => [new URL(loc).pathname, 0]),
);
for (const file of await htmlFiles(OUT)) {
  const rel = relative(OUT, file).replace(/\\/g, "/");
  const source = rel === "index.html"
    ? "/"
    : normalizeRoute(rel.replace(/\/index\.html$/, ""));
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/href="(\/[^"]*)"/g)) {
    const target = normalizeRoute(match[1].split(/[?#]/, 1)[0]);
    if (target !== source && sitemapIncoming.has(target)) {
      sitemapIncoming.set(target, sitemapIncoming.get(target) + 1);
    }
  }
}
for (const [route, incoming] of sitemapIncoming) {
  ok(route === "/" || incoming > 0, `sitemap: ${route} has no incoming internal link`);
}

const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");

// Aus dem Codepoint gebaut, damit diese Datei nicht selbst gegen die Regel
// verstoesst, die sie durchsetzt.
const EM_DASH = new RegExp(`[${String.fromCharCode(0x2014, 0x2015)}]`);

for (const file of await htmlFiles(OUT)) {
  const rel = relative(OUT, file).replace(/\\/g, "/");
  const html = await readFile(file, "utf8");
  ok(!EM_DASH.test(html), `${rel}: contains an em dash (U+2014/U+2015)`);

  const text = visibleText(html);
  const open = (text.match(/„/g) || []).length;
  const close = (text.match(/“/g) || []).length;
  ok(open === close, `${rel}: unbalanced German quotes (${open}x „ vs ${close}x “)`);
  ok(!text.includes('"'), `${rel}: straight double quote in visible text (use „…“)`);
}

// Im Prüfmodus bleibt das AdSense-Verifizierungs-Script erhalten, aber es darf
// keine manuelle Anzeigenfläche im statischen Export auftauchen. Der Modus wird
// erst durch den expliziten Build-Wert `false` verlassen.
if (process.env.NEXT_PUBLIC_ADSENSE_REVIEW_MODE !== "false") {
  for (const file of await htmlFiles(OUT)) {
    const rel = relative(OUT, file).replace(/\\/g, "/");
    const html = await readFile(file, "utf8");
    ok(!html.includes('class="adsbygoogle"'), `${rel}: review mode must not render manual ad slots`);
  }
}

if (process.env.KONTEXTO_REQUIRE_IMPRESSUM === "1") {
  const imp = await read("impressum/index.html");
  ok(!imp.includes("werden vor Veröffentlichung ergänzt"), "impressum: legal data not filled in for production");
}

if (failures.length) { console.error("SEO CHECK FAILED:\n" + failures.map(f => " - " + f).join("\n")); process.exit(1); }
console.log("SEO check passed.");
