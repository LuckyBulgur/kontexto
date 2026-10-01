import { test, expect, QUIPS_KEY } from "./fixtures";
import { QUIPS } from "../lib/quips";

/**
 * The quip layer against the real export: on, a refusal and the result card
 * speak from the catalogue; switched off in the settings, the plain copy is
 * back at once, without a reload.
 *
 * The fixture switches quips off for every other spec. Any value but "off"
 * means on, so this spec writes "on" after the fixture's own init script.
 */

const anyOf = (lines: readonly string[]) =>
  new RegExp(lines.map((line) => line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));

test.beforeEach(async ({ context }) => {
  await context.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, "on");
    } catch {
      // Storage blocked: the default is on anyway.
    }
  }, QUIPS_KEY);
});

test.describe("Freche Sprüche", () => {
  test("Abweisung und Ergebniskarte sprechen aus dem Katalog", async ({ page, request }) => {
    const { word } = await (await request.get("/api/reveal")).json();
    expect(word, "reveal liefert ein Lösungswort").toBeTruthy();

    await page.goto("/");
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();

    await input.fill("fahrrad");
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await input.fill("fahrrad");
    await input.press("Enter");
    await expect(page.getByText(anyOf(QUIPS.refusalDuplicate))).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Wort bereits geraten")).toHaveCount(0);

    await input.fill(word);
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible({ timeout: 10_000 });
    const wins = [
      ...QUIPS.kontextoWinFirst,
      ...QUIPS.kontextoWinFast,
      ...QUIPS.kontextoWinSolid,
    ];
    await expect(page.getByText(anyOf(wins))).toBeVisible({ timeout: 10_000 });
  });

  test("ausgeschaltet kommt die sachliche Meldung zurück", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();

    await page.getByRole("button", { name: /Menü|Menu/ }).first().click();
    await page.getByRole("menuitem", { name: /Einstellungen/ }).click();
    const quipSwitch = page.getByRole("switch", { name: "Freche Sprüche" });
    await expect(quipSwitch).toBeChecked();
    await quipSwitch.click();
    await expect(quipSwitch).not.toBeChecked();
    await page.keyboard.press("Escape");

    await input.fill("fahrrad");
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await input.fill("fahrrad");
    await input.press("Enter");
    await expect(page.getByText("Wort bereits geraten")).toBeVisible({ timeout: 10_000 });
  });

  test("Wördle feiert mit einem Spruch statt mit „Genial!“", async ({ page }) => {
    const gameLoaded = page.waitForResponse((r) => r.url().includes("/api/wordle/game") && r.ok());
    await page.goto("/wordle/");
    await gameLoaded;
    await expect(page.getByRole("button", { name: "Enter", exact: true })).toBeVisible();

    // The test dataset has exactly one solution, so the first row solves.
    await page.keyboard.type("feuer", { delay: 60 });
    await page.getByRole("button", { name: "Enter", exact: true }).click();
    await expect(page.getByText(anyOf(QUIPS.wordleWin1))).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Genial!")).toHaveCount(0);
  });
});
