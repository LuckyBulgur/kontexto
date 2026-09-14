import { test, expect } from "./fixtures";

const DARK = /(^|\s)dark(\s|$)/;

// Verifiziert genau die statisch-export-spezifischen Risiken: das Theme-Skript
// im <head> (kein Flash) und die Hydration der exportierten Seite.
test.describe("Theme & Hydration (Static Export)", () => {
  test("dark aus localStorage wird vor der Hydration angewandt", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("kontexto_theme", "dark"));
    await page.goto("/");
    // Das synchrone Inline-Skript im <head> setzt die Klasse vor dem ersten Paint.
    await expect(page.locator("html")).toHaveClass(DARK);
  });

  test("ohne Dark-Präferenz bleibt das Theme hell", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("kontexto_theme", "light"));
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(DARK);
  });

  test("die exportierte Seite hydriert und wird interaktiv", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    // GuessInput fokussiert sich beim Mount selbst -> Beleg, dass React im
    // statischen Export tatsächlich hydriert (nicht nur HTML ausliefert).
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    // The focus must not undo the content-first viewport on mobile-sized pages.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("physische index.html-Dateien werden auf die Canonical-URL umgeleitet", async ({ request }) => {
    for (const [source, target] of [
      ["/index.html", "/"],
      ["/faq/index.html", "/faq/"],
      ["/wordle/index.html", "/wordle/"],
    ] as const) {
      const response = await request.get(source, { maxRedirects: 0 });
      expect(response.status(), source).toBe(301);
      expect(response.headers().location, source).toBe(target);
    }

    const notFound = await request.get("/404.html", { maxRedirects: 0 });
    expect(notFound.status()).toBe(404);

    for (const path of ["/404/", "/404/index.html", "/_not-found/", "/_not-found/index.html"]) {
      const artifact = await request.get(path, { maxRedirects: 0 });
      expect(artifact.status(), path).toBe(404);
    }
  });

  test("ephemere Room-URLs werden auch ohne Slash als noindex markiert", async ({ request }) => {
    for (const path of [
      "/duel/does-not-exist",
      "/duel/does-not-exist/",
      "/koop/does-not-exist",
      "/wordle/duel/does-not-exist/",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    }
  });
});
