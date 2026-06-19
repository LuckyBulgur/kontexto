import { test, expect } from "@playwright/test";

// Kontexto-Kernschleife: Wort eingeben -> Rang -> Treffer -> Ergebniskarte.
test.describe("Kontexto Einzelspieler", () => {
  test("rät bis zum Sieg und zeigt die Glückwunsch-Karte", async ({ page, request }) => {
    // Lösung des Tagesspiels über die echte API ermitteln (wird auf das Backend
    // geproxyt). So bleibt der Test unabhängig vom konkreten Zielwort der Daten.
    const reveal = await request.get("/api/reveal");
    expect(reveal.ok()).toBeTruthy();
    const { word } = await reveal.json();
    expect(word, "reveal liefert ein Lösungswort").toBeTruthy();

    await page.goto("/");
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();

    // Ein nicht-treffendes Wort wird abgeschickt: die Eingabe wird geleert
    // (Beweis, dass der Guess die Pipeline durchlaufen hat).
    await input.fill("fahrrad");
    await input.press("Enter");
    await expect(input).toHaveValue("");

    // Der Treffer (Rang 1) löst das Spiel und blendet die Ergebniskarte ein.
    await input.fill(word);
    await input.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Herzlichen Glückwunsch!" }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
