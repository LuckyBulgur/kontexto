import { test, expect } from "./fixtures";

// Wördle-Kernschleife über die physische Tastatur (WordleGame lauscht auf
// document-keydown). Der Test-Datensatz hat genau eine Lösung ("feuer"), die
// Tageslösung ist damit deterministisch.
test.describe("Wördle Einzelspieler", () => {
  test("löst das Tagesrätsel mit der bekannten Lösung", async ({ page }) => {
    // Die Antwort wird VOR der Navigation scharfgestellt. page.goto wartet auf
    // das load-Ereignis, und dazu zaehlt der AdSense-Loader: Er steht seit
    // August 2026 als echtes <script async> im <head>, weil Googles Anleitung
    // den Anzeigencode dort verlangt und er vorher (next/script mit
    // afterInteractive) ueberhaupt nicht im ausgelieferten HTML stand. Sein
    // externer Abruf verzoegert load so weit, dass die Spielabfrage laengst
    // durch ist, bevor goto zurueckkehrt. Ein waitForResponse danach wartet auf
    // ein Ereignis der Vergangenheit und laeuft in den Timeout.
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
