import { test, expect } from "@playwright/test";

// Wördle-Kernschleife über die physische Tastatur (WordleGame lauscht auf
// document-keydown). Der Test-Datensatz hat genau eine Lösung ("feuer"), die
// Tageslösung ist damit deterministisch.
test.describe("Wördle Einzelspieler", () => {
  test("löst das Tagesrätsel mit der bekannten Lösung", async ({ page }) => {
    await page.goto("/wordle/");
    // Warten, bis das Spiel geladen ist (Skeleton -> Board).
    await page.waitForResponse((r) => r.url().includes("/api/wordle/game") && r.ok());

    // Mit Delay tippen, damit React jeden Buchstaben committet. Anschließend NICHT
    // sofort die physische Enter-Taste drücken (Race: submitGuess würde über ein
    // noch nicht aktualisiertes currentGuess schließen), sondern den On-Screen-
    // Enter-Button klicken, eine eigene, actionability-geprüfte Aktion, die erst
    // nach dem letzten Render feuert.
    await page.keyboard.type("feuer", { delay: 60 });
    await page.getByRole("button", { name: "Enter", exact: true }).click();

    // Gewinn-Toast: WIN_MESSAGES[0] beim Treffer im ersten Versuch.
    await expect(page.getByText("Genial!")).toBeVisible({ timeout: 10_000 });
  });
});
