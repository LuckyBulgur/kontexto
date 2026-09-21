import { expect, test } from "@playwright/test";

import { PALETTE_ORDER, PALETTES } from "../lib/palette";

/**
 * The Farbwelt switch, end to end against the static export.
 *
 * The interesting part is not that a class toggles, it is that the choice
 * survives a reload without a flash: the palette is applied by an inline script
 * in `<head>`, so the attribute has to be on `<html>` before anything paints.
 */
function readAccent(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
  );
}

test.describe("Farbwelt", () => {
  test("wird gewechselt, gespeichert und vor dem ersten Rendern gesetzt", async ({ page }) => {
    await page.goto("/");

    // Default: Tinte, and that is the shipped look, so nothing is written yet.
    await expect(page.locator("html")).not.toHaveAttribute("data-palette", "beere");
    const accentBefore = await readAccent(page);

    await page.getByRole("button", { name: /Men/ }).click();
    await page.getByRole("menuitem", { name: "Einstellungen" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("radiogroup", { name: "Farbwelt" })).toBeVisible();

    const beere = dialog.getByRole("radio", { name: /Beere/ });
    await beere.click();
    await expect(beere).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveAttribute("data-palette", "beere");

    // The accent really changed, not just the attribute. Compared against the
    // previous value rather than a literal: the browser hands the token back in
    // whatever colour space it feels like (lab(), oklch(), rgb()), and pinning
    // the notation would make this test about Chromium, not about the palette.
    expect(await readAccent(page)).not.toBe(accentBefore);

    // Survives a reload, and the attribute is already there in the served HTML
    // path: no flash of the default palette.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-palette", "beere");
  });

  test("bietet jede Farbwelt aus dem Katalog an, auch Klassisch", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Men/ }).click();
    await page.getByRole("menuitem", { name: "Einstellungen" }).click();
    const group = page.getByRole("dialog").getByRole("radiogroup", { name: "Farbwelt" });
    for (const id of PALETTE_ORDER) {
      await expect(group.getByRole("radio", { name: new RegExp(PALETTES[id].name) })).toBeVisible();
    }
  });

  test("laesst die Rangfarben unangetastet, sonst bricht der geteilte Text", async ({ page }) => {
    const read = () =>
      page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return ["near", "mid", "far"].map((t) => cs.getPropertyValue(`--rank-${t}`).trim());
      });

    await page.goto("/");
    const before = await read();

    await page.evaluate(() => localStorage.setItem("kontexto_palette", "beere"));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-palette", "beere");
    expect(await read()).toEqual(before);
  });
});
