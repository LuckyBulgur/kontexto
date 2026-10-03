import { test, expect } from "./fixtures";

// Wördle-Kernschleife über die physische Tastatur (WordleGame lauscht auf
// document-keydown). Der Test-Datensatz hat genau eine Lösung ("feuer"), die
// Tageslösung ist damit deterministisch.
test.describe("Wördle Einzelspieler", () => {
  test("löst das Tagesrätsel mit der bekannten Lösung", async ({ page }) => {
    // Arm the wait before navigating: page.goto returns on the load event, and
    // the game request can finish before that. A waitForResponse registered
    // afterwards would wait for an event in the past and time out.
    const gameLoaded = page.waitForResponse(
      (r) => r.url().includes("/api/wordle/game") && r.ok(),
    );
    await page.goto("/wordle/");
    await gameLoaded;
    // Skeleton -> Board: die Bildschirmtastatur steht erst nach dem Rendern.
    await expect(page.getByRole("button", { name: "Enter", exact: true })).toBeVisible();

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
