import { test, expect } from "./fixtures";

/**
 * Post-round word rating, driven through the real export against a real backend.
 *
 * Two things can only be seen here. The question has to appear after a give-up
 * as well as after a solve, because leaving the lost rounds out would bias the
 * data towards the words that already work, which is the one thing the data is
 * for. And the reason step may only follow the "too hard" answer; the unit test
 * holds that for the state machine, this holds it for what is actually drawn.
 */

const QUESTION = "War das Wort fair?";
const REASON_QUESTION = "Woran lag es?";

test.describe("Wortbewertung", () => {
  test("erscheint nach dem Lösen und fragt bei „zu schwer“ nach dem Grund", async ({
    page,
    request,
  }) => {
    const { word } = await (await request.get("/api/reveal")).json();
    expect(word, "reveal liefert ein Lösungswort").toBeTruthy();

    await page.goto("/");
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();

    await input.fill(word);
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText(QUESTION)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Zu schwer", exact: true }).click();

    await expect(page.getByText(REASON_QUESTION)).toBeVisible({ timeout: 10_000 });
    // The reason goes out in a second request after the vote. The server used
    // to refuse it as a duplicate vote and answer ok=false, which the page never
    // shows, so the answer itself is what has to be checked.
    const reasonResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/rating")
        && response.request().method() === "POST"
        && response.request().postData()?.includes("unknown_word") === true,
    );
    await page.getByRole("button", { name: "Wort nicht gekannt", exact: true }).click();
    expect(await (await reasonResponse).json()).toEqual({ ok: true });

    // The third step thanks and offers the optional field; the tally itself
    // stays silent until enough people have voted, which a fresh fixture never
    // has, so the thank-you is what must be there.
    await expect(page.getByText("Danke.")).toBeVisible({ timeout: 10_000 });
  });

  test("die beiden anderen Antworten fragen nicht weiter", async ({ page, request }) => {
    const { word } = await (await request.get("/api/reveal")).json();

    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill(word);
    await input.press("Enter");
    await expect(page.getByText(QUESTION)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Genau richtig", exact: true }).click();
    await expect(page.getByText("Danke.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(REASON_QUESTION)).toHaveCount(0);
  });

  test("erscheint auch, wenn aufgegeben wurde", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();

    // A round has to have been played before it can be given up.
    await input.fill("fahrrad");
    await input.press("Enter");
    await expect(input).toHaveValue("");

    // Giving up lives in the kebab menu, so the menu has to be opened first.
    await page.getByRole("button", { name: /^Men/ }).click();
    await page.getByRole("menuitem", { name: "Aufgeben" }).click();
    const confirm = page.getByRole("button", { name: /^Aufgeben$/ });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }

    await expect(page.getByText(QUESTION)).toBeVisible({ timeout: 10_000 });
  });

  test("fragt nicht nach einem Spiel aus dem alten Pool", async ({ page, request }) => {
    // The fixture has no legacy games, so the floor is moved above today's
    // game in the one response that carries it. Everything else stays real.
    await page.route("**/api/game", async (route) => {
      const response = await route.fetch();
      const info = await response.json();
      await route.fulfill({
        response,
        json: { ...info, firstCuratedGame: info.gameNumber + 1 },
      });
    });
    const { word } = await (await request.get("/api/reveal")).json();

    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill(word);
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText(QUESTION)).toHaveCount(0);
  });
});
