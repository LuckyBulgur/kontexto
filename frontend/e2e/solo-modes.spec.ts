import { test, expect } from "./fixtures";

/**
 * Smoke tests for the four solo routes against the real static export.
 *
 * The rule engines are covered by lib/solo-modes.test.ts; what cannot be tested
 * there is whether a round actually starts. Each mode opens with a different
 * server call (a word at an exact rank, a pair of games, a set of runners-up),
 * and a route that cannot get past that shows a skeleton forever.
 */
test.describe("Solo-Modi", () => {
  test("Leiter startet mit einem vorgegebenen Wort und zählt Leben", async ({ page }) => {
    await page.goto("/solo/leiter/");
    await expect(page.getByText("Leben")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^3 von 3$/)).toBeVisible();

    // The opening word is on the board before the player has done anything, and
    // the input demands something closer than its rank.
    await expect(page.getByPlaceholder(/^Besser als Rang \d+$/)).toBeVisible();
  });

  test("Limitierte Versuche zeigt das Budget", async ({ page }) => {
    await page.goto("/solo/limit/");
    await expect(page.getByText("Versuche übrig")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^20 von 20$/)).toBeVisible();

    const input = page.getByRole("textbox");
    await input.fill("birne");
    await input.press("Enter");
    await expect(page.getByText(/^19 von 20$/)).toBeVisible({ timeout: 20_000 });
  });

  test("Doppelziel zeigt zwei Ränge pro Wort", async ({ page }) => {
    await page.goto("/solo/doppelziel/");
    await expect(page.getByText(/^0 von 2$/)).toBeVisible({ timeout: 20_000 });

    const input = page.getByRole("textbox");
    await input.fill("melone");
    await input.press("Enter");
    await expect(page.getByText("Ziel 1")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Ziel 2")).toBeVisible();
  });

  test("Sudden Death gibt die Nachbarn preis und endet nach einem Versuch", async ({ page }) => {
    await page.goto("/solo/sudden-death/");
    await expect(page.getByRole("heading", { name: "Die nächsten Nachbarn" })).toBeVisible({
      timeout: 20_000,
    });
    // Ranks 2 to 6, and never rank 1. Exact match: the rules card above the
    // board names the same range in prose.
    const board = page.getByRole("list").first();
    await expect(board.getByText("Rang 2", { exact: true })).toBeVisible();
    await expect(board.getByText("Rang 6", { exact: true })).toBeVisible();
    await expect(board.getByText("Rang 1", { exact: true })).toHaveCount(0);

    const input = page.getByRole("textbox");
    await input.fill("birne");
    await input.press("Enter");

    // One attempt, then the round is over either way.
    await expect(page.getByRole("button", { name: "Neue Runde" })).toBeVisible({
      timeout: 20_000,
    });
  });
});
