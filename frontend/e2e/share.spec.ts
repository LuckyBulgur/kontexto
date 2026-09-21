import { test, expect } from "./fixtures";

// The shared result must carry the link back to the game. Without it a share is
// a dead end, and the arrival counter behind `?s=` has nothing to count.
test.describe("share text", () => {
  test("carries a link with the game marker", async ({ page, context, request }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const reveal = await request.get("/api/reveal");
    const { word } = await reveal.json();
    const game = await request.get("/api/game");
    const { gameNumber } = await game.json();

    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.waitFor();
    await input.fill(word);
    await input.press("Enter");
    await expect(
      page.getByRole("heading", { name: word, exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // The one-time survey modal sits on top of the card; skip it first.
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole("button", { name: "Überspringen" }).click();
    } else {
      await page.waitForTimeout(1200);
      if (await dialog.isVisible().catch(() => false)) {
        await dialog.getByRole("button", { name: "Überspringen" }).click();
      }
    }

    await page.getByRole("button", { name: "Ergebnis teilen" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());

    expect(copied).toContain(`https://kontexto.de/?s=${gameNumber}`);
    expect(copied).toContain(`Kontexto #${gameNumber}`);
  });

  test("a shared link opens the game and drops the marker from the address bar", async ({
    page,
  }) => {
    await page.goto("/?s=412");
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });
});
