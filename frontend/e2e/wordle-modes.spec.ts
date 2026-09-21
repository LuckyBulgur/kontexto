// verify-language-fixture: the selectors quote the German UI they drive.
import { test, expect } from "./fixtures";

/**
 * Wordle owns its modes now. The duel used to hang in the Kontexto picker,
 * which offered a round of the other game from a Kontexto board, and the random
 * round sat as a separate menu entry. Both are behind one door here.
 */
test.describe("Wördle-Modi", () => {
  test("das Menü führt über einen Eintrag zu allen Wördle-Modi", async ({ page }) => {
    await page.goto("/wordle/");
    await page.getByRole("button", { name: /^Menü/ }).click();
    await page.getByRole("menuitem", { name: /Spielmodi/ }).click();

    const dialog = page.getByRole("dialog");
    for (const group of ["Allein", "Mit Freunden", "Gegen Fremde"]) {
      await expect(dialog.getByText(group, { exact: true })).toBeVisible();
    }
    await expect(dialog.getByRole("link", { name: /Tägliches Wördle/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Zufallsspiel/ })).toBeVisible();
  });

  test("der Weg gegen Fremde führt zur eigenen Wördle-Suche", async ({ page }) => {
    await page.goto("/wordle/");
    await page.getByRole("button", { name: /^Menü/ }).click();
    await page.getByRole("menuitem", { name: /Spielmodi/ }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("link", { name: /Wördle-Duell/ }).last().click();
    await expect(page).toHaveURL(/\/wordle\/suche\/$/);
    // One mode means no list to choose from, so the search starts right away.
    await expect(page.getByRole("button", { name: "Mitspieler suchen" })).toBeEnabled({
      timeout: 20_000,
    });
  });
});
