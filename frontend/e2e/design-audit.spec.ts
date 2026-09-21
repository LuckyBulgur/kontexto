import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Two checks that no other script can make, both against the real static export
 * behind the same proxy the smoke suite uses.
 *
 * 1. Contrast. The design tokens promise that body ink, muted ink and the guess
 *    bar's own label clear WCAG AA (4.5:1) in both themes. A token file cannot
 *    prove that, and the guess-bar label is the hard case: it sits half over the
 *    coloured fill and half over the track, so it has to clear on both.
 * 2. Screenshots, written to .checks/ for the pass on screen. Nothing is
 *    asserted about them; a picture is evidence for a human, not a test.
 *
 * Kept out of the smoke run (`pnpm test:e2e`, testMatch **\/*.spec.ts) would
 * pick it up, so it is guarded by KONTEXTO_DESIGN_AUDIT and skipped otherwise.
 */

const AUDIT = !!process.env.KONTEXTO_DESIGN_AUDIT;
const SHOTS = resolve(process.cwd(), ".checks");

test.describe("design audit", () => {
  test.skip(!AUDIT, "Set KONTEXTO_DESIGN_AUDIT=1 to run the design audit.");

  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  // Every Farbwelt, both modes. A palette is a colour change and therefore the
  // one kind of change that can silently break contrast, so none of them ships
  // on a look.
  const PALETTES = ["tinte", "beere", "indigo", "petrol", "klassisch"] as const;

  for (const palette of PALETTES)
  for (const theme of ["light", "dark"] as const) {
    test(`contrast, ${palette}, ${theme}`, async ({ page }) => {
      await setTheme(page, theme);
      await page.addInitScript((p) => {
        try {
          localStorage.setItem("kontexto_palette", p);
        } catch {
          /* private mode */
        }
      }, palette);
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-palette", palette);
      await page.getByPlaceholder(/Wort/i).fill("Haus");
      await page.getByPlaceholder(/Wort/i).press("Enter");
      await expect(page.locator("[data-slot='card'], .animate-slideIn").first()).toBeVisible();

      const rows = await page.evaluate(() => {
        // The tokens are oklch, and neither getComputedStyle nor canvas
        // fillStyle hands back plain rgb() for those. Painting one pixel and
        // reading it back is the only conversion that cannot be misparsed: the
        // browser does the colour maths and the result is literally what the
        // screen shows. Parsing the string instead produced NaN, which then
        // passed every threshold silently.
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const toRgb = (css: string): [number, number, number] => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return [r, g, b];
        };
        const srgb = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        const lum = (css: string) => {
          const [r, g, b] = toRgb(css);
          return 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
        };
        const ratio = (a: string, b: string) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };
        const v = (name: string) =>
          getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const bg = v("--background");
        const card = v("--card");
        const out: { pair: string; ratio: number }[] = [
          { pair: "foreground on background", ratio: ratio(v("--foreground"), bg) },
          { pair: "foreground on card", ratio: ratio(v("--foreground"), card) },
          { pair: "muted-foreground on background", ratio: ratio(v("--muted-foreground"), bg) },
          { pair: "muted-foreground on card", ratio: ratio(v("--muted-foreground"), card) },
          { pair: "primary-foreground on primary", ratio: ratio(v("--primary-foreground"), v("--primary")) },
        ];
        for (const tone of ["near", "mid", "far"]) {
          out.push({
            pair: `rank label on ${tone} fill`,
            ratio: ratio(v("--rank-foreground"), v(`--rank-${tone}`)),
          });
        }
        out.push({
          pair: "rank label on track",
          // The track sits on the card, so an alpha token has to be flattened
          // against it before the ratio means anything.
          ratio: ratio(v("--rank-foreground"), `color-mix(in srgb, ${v("--rank-track")}, ${card})`),
        });
        for (const tone of ["near", "mid", "far"]) {
          out.push({ pair: `rank-${tone}-ink on card`, ratio: ratio(v(`--rank-${tone}-ink`), card) });
        }
        for (const tone of ["success", "warning", "info"]) {
          out.push({ pair: `${tone}-ink on card`, ratio: ratio(v(`--${tone}-ink`), card) });
        }
        out.push({ pair: "destructive on card", ratio: ratio(v("--destructive"), card) });
        for (const tone of ["correct", "present", "absent"]) {
          out.push({
            pair: `tile-foreground on tile-${tone}`,
            ratio: ratio(v("--tile-foreground"), v(`--tile-${tone}`)),
          });
        }
        return out;
      });

      // Not `< 4.5`: a NaN would slip through that, and a probe that cannot
      // measure must fail loudly rather than report everything as fine.
      const failures = rows.filter((r) => !(r.ratio >= 4.5));
      // eslint-disable-next-line no-console
      console.log(
        `\n  contrast, ${theme}\n` +
          rows
            .map((r) => `    ${r.ratio < 4.5 ? "FAIL" : "ok  "}  ${r.ratio.toFixed(2)}:1  ${r.pair}`)
            .join("\n"),
      );
      expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    });
  }

  /**
   * Affordance: a control that carries text must look like a control when
   * nobody is pointing at it.
   *
   * `variant="ghost"` renders as bare text and only grows a surface on hover,
   * and on a touch screen there is no hover at all, so it never grows one. An
   * icon is exempt: a glyph carries its own shape, which is why the back arrow
   * and the kebab stay ghosts. Text without an icon is not exempt, and that is
   * the whole rule.
   */
  const AFFORDANCE_PAGES = [
    "/",
    "/modi/",
    "/suche/",
    "/wordle/",
    "/zahlen/",
    "/anleitung/",
    "/solo/leiter/",
    "/duel/create/",
    "/koop/create/",
    "/arena/create/",
    "/blog/",
    "/faq/",
  ];

  for (const path of AFFORDANCE_PAGES) {
    test(`Knopf-Affordanz ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(250);

      const bare = await page.evaluate(() => {
        const flat = (c: string) => c === "transparent" || c === "rgba(0, 0, 0, 0)";
        return [...document.querySelectorAll("[data-slot='button']")]
          .filter((el) => {
            const box = el.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) return false;
            // A glyph is its own affordance.
            if (el.querySelector("svg")) return false;
            if (!el.textContent?.trim()) return false;
            const cs = getComputedStyle(el);
            const hasFill = !flat(cs.backgroundColor);
            const hasEdge =
              Number.parseFloat(cs.borderTopWidth) > 0 && !flat(cs.borderTopColor);
            const hasUnderline = cs.textDecorationLine.includes("underline");
            return !hasFill && !hasEdge && !hasUnderline;
          })
          .map((el) => el.textContent!.trim().slice(0, 40));
      });

      expect(bare, `Knoepfe ohne Flaeche, Kante oder Unterstrich auf ${path}`).toEqual([]);
    });
  }

  const PAGES: { path: string; name: string; prepare?: (page: Page) => Promise<void> }[] = [
    { path: "/", name: "home-empty" },
    {
      path: "/",
      name: "home-played",
      prepare: async (page) => {
        for (const word of ["Haus", "Garten", "Strand"]) {
          await page.getByPlaceholder(/Wort/i).fill(word);
          await page.getByPlaceholder(/Wort/i).press("Enter");
          await page.waitForTimeout(250);
        }
      },
    },
    { path: "/modi/", name: "modi" },
    { path: "/suche/", name: "suche" },
    { path: "/wordle/", name: "wordle" },
    { path: "/zahlen/", name: "zahlen" },
    { path: "/anleitung/", name: "anleitung" },
    { path: "/solo/leiter/", name: "solo-leiter" },
  ];

  for (const theme of ["light", "dark"] as const) {
    for (const width of [375, 1280]) {
      for (const entry of PAGES) {
        test(`shot ${entry.name} ${theme} ${width}`, async ({ page }) => {
          await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
          await setTheme(page, theme);
          await page.goto(entry.path);
          await entry.prepare?.(page);
          await page.waitForTimeout(400);
          await page.screenshot({
            path: `${SHOTS}/${entry.name}-${theme}-${width}.png`,
            fullPage: width === 1280,
          });
        });
      }
    }
  }
});

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("kontexto_theme", t);
    } catch {
      /* private mode */
    }
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
}
