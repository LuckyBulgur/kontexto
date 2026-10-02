// verify-language-fixture: the selectors quote the German UI they drive.
import { test, expect } from "./fixtures";

/**
 * The invite form used to be three forms, one per mode, and each one showed
 * only its own. A player who came from the menu therefore never learned that
 * the other four modes exist. This pins the two things that fixes: every mode
 * is on the screen, and the one the route asked for is the one selected.
 */
test.describe("Raum erstellen", () => {
  const MODES = ["Duell", "Koop", "Battle Royale", "Blitz-Duell", "Zeitbonus-Jagd"];

  test("zeigt alle Modi und wählt den der Route vor", async ({ page }) => {
    await page.goto("/duel/create/");

    const list = page.getByRole("radiogroup");
    for (const name of MODES) {
      await expect(list.getByText(name, { exact: true })).toBeVisible({ timeout: 20_000 });
    }
    await expect(page.getByRole("radio", { name: /Duell/ }).first()).toBeChecked();
    await expect(page.getByRole("heading", { name: "Duell erstellen" })).toBeVisible();
  });

  test("die Arena-Route wählt ihren eigenen Modus vor", async ({ page }) => {
    await page.goto("/arena/create/?modus=blitz");
    await expect(page.getByRole("heading", { name: "Blitz-Duell erstellen" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("ein Arena-Modus blendet Spielwahl und Tipps aus", async ({ page }) => {
    await page.goto("/koop/create/");
    await expect(page.getByRole("button", { name: "Heutiges Spiel" })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator('label[for="modus-royale"]').click();
    // An arena always draws a random game, so neither control applies there.
    await expect(page.getByRole("button", { name: "Heutiges Spiel" })).toHaveCount(0);
    await expect(page.getByLabel("Tipps erlauben")).toHaveCount(0);
  });

  test("erstellt den Raum des gewählten Modus", async ({ page }) => {
    await page.goto("/duel/create/");
    await page.locator('label[for="modus-royale"]').click();
    await page.getByLabel("Dein Nickname").fill("Alice");
    await page.getByRole("button", { name: "Battle Royale erstellen" }).click();

    await expect(page).toHaveURL(/\/arena\/[^/]+\/$/, { timeout: 30_000 });
  });

  test("ein Raum, den es nicht gibt, sagt es sofort und wartet nicht auf den Server", async ({ page }) => {
    // The retry for a restarting backend (lib/room-load.ts) must not hold up
    // a real 404: that answer is final and comes within the first attempt.
    await page.goto("/koop/gibtesnicht123/");
    await expect(page.getByText("Koop nicht gefunden")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: "Neu laden" })).toHaveCount(0);
  });
});
