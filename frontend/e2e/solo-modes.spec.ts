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

/**
 * The picker is the only way into the new modes from inside a running game, so
 * the path menu -> dialog -> round gets a test of its own. It also pins the two
 * decisions behind the dialog: the first question is "with whom", and every
 * choice after it starts a round rather than opening a page.
 */
test.describe("Modus-Waehler", () => {
  test("fragt zuerst nach dem Mitspieler und startet dann die Runde", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Menü/ }).click();
    await page.getByRole("menuitem", { name: /Weitere Spielmodi/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Wie willst du spielen?" })).toBeVisible();
    // Playing with friends is one of the three first-level choices, not a link
    // hidden beside a mode.
    for (const label of ["Allein", "Mit Freunden", "Gegen Fremde"]) {
      await expect(dialog.getByRole("button", { name: new RegExp(label) })).toBeVisible();
    }

    await dialog.getByRole("button", { name: /Allein/ }).click();
    await expect(dialog.getByRole("heading", { name: "Allein spielen" })).toBeVisible();

    await dialog.getByRole("link", { name: /Sudden Death/ }).click();
    await expect(page).toHaveURL(/\/solo\/sudden-death\/$/);
  });

  test("der Weg mit Freunden fuehrt zum Einladungsformular", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Menü/ }).click();
    await page.getByRole("menuitem", { name: /Weitere Spielmodi/ }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Mit Freunden/ }).click();
    await dialog.getByRole("link", { name: /Battle Royale/ }).click();
    await expect(page).toHaveURL(/\/arena\/create\/\?modus=royale$/);
  });

  test("zurueck fuehrt wieder zur Frage", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Menü/ }).click();
    await page.getByRole("menuitem", { name: /Weitere Spielmodi/ }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Gegen Fremde/ }).click();
    await dialog.getByRole("button", { name: "Zurück zur Auswahl" }).click();
    await expect(dialog.getByRole("heading", { name: "Wie willst du spielen?" })).toBeVisible();
  });
});
