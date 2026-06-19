import { test, expect } from "@playwright/test";

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
    await page.goto("/");
    // GuessInput fokussiert sich beim Mount selbst -> Beleg, dass React im
    // statischen Export tatsächlich hydriert (nicht nur HTML ausliefert).
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });
});
