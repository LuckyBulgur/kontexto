// verify-language-fixture: the selectors quote the German UI they drive.
import { test, expect } from "./fixtures";

/**
 * Categories against the real static export and a real backend.
 *
 * The mock dataset (scripts/create-test-data.py) draws its solutions from real
 * pool words, so the shipped assignment files them: melone, birne, himbeere and
 * zitrone are "Essen und Trinken". Picking that one field must therefore end on
 * one of those four words, whichever of them the server draws.
 */
const FOOD = ["melone", "birne", "himbeere", "zitrone"];

/** A channel nobody else in this run uses: a bound channel stays bound across
 *  runs on the shared e2e database, and a second bind of it is a 409. */
function freshChannel(prefix: string): string {
  return `${prefix}${Date.now().toString().slice(-8)}`;
}

test.describe("Kategorien", () => {
  test("der Solo-Modus fragt zuerst und zieht nur aus der Auswahl", async ({ page }) => {
    await page.goto("/solo/kategorien/");
    await expect(page.getByRole("heading", { name: "Kategorien wählen" })).toBeVisible({
      timeout: 20_000,
    });
    const field = page.getByRole("button", { name: "Essen und Trinken" });
    await expect(field).toBeVisible({ timeout: 20_000 });
    await field.click();
    await expect(field).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Alle" })).toHaveAttribute("aria-pressed", "false");

    await page.getByRole("button", { name: "Runde starten" }).click();
    // A single field is always shown: it is known anyway.
    await expect(page.getByText("Kategorie:")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Essen und Trinken", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /^Menü/ }).click();
    await page.getByRole("menuitem", { name: "Aufgeben" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Aufgeben" }).click();

    const eyebrow = page.getByText(/^Essen und Trinken, das Wort war$/);
    await expect(eyebrow).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Nächste Runde" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kategorien ändern" })).toBeVisible();

    const revealed = await page.evaluate(() => {
      const raw = localStorage.getItem("kontexto_categories");
      return raw ? (JSON.parse(raw) as { revealed: string | null }).revealed : null;
    });
    expect(FOOD).toContain(revealed);
  });

  test("ein Duell aus Kategorien zeigt beiden die Kategorie", async ({ page }) => {
    await page.goto("/duel/create/");
    await page.getByLabel("Dein Nickname").fill("Alice");
    await page.getByRole("button", { name: "Aus Kategorien" }).click();
    await page.getByRole("button", { name: "Essen und Trinken" }).click({ timeout: 20_000 });
    await page.getByRole("button", { name: "Duell erstellen" }).click();

    // Not /duel/create/ itself, which the plain pattern would also match.
    await expect(page).toHaveURL(/\/duel\/(?!create\/)[^/]+\/?$/, { timeout: 30_000 });
    await expect(page.getByText("Kategorie:")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Essen und Trinken", { exact: true })).toBeVisible();

    // The second player reads the same room state; it names the field and
    // never the game number.
    const duelId = new URL(page.url()).pathname.split("/").filter(Boolean)[1];
    const state = await (await page.request.get(`/api/duel/${duelId}`)).json();
    expect(state.category).toEqual({ id: "food", name: "Essen und Trinken" });
    expect(state).not.toHaveProperty("game_number");
  });

  test("eine Live-Runde zeigt die Kategorie nur auf Wunsch", async ({ page }) => {
    /** Open a live room as its host, the way the create form does. */
    const openAsHost = async (body: Record<string, unknown>) => {
      const res = await page.request.post("/api/live", { data: body });
      expect(res.status()).toBe(200);
      const room = await res.json();
      await page.goto("/");
      await page.evaluate(
        ([id, token]) => localStorage.setItem(`kontexto_koop_${id}`, token),
        [room.koop_id, room.player_token]
      );
      await page.goto(`/live/${room.koop_id}/`);
      await expect(page.getByText(/Versuche:/).filter({ visible: true })).toBeVisible({
        timeout: 20_000,
      });
    };

    await openAsHost({
      platform: "twitch",
      channel: freshChannel("katshown"),
      categories: ["food"],
      show_category: true,
    });
    await expect(page.getByText("Essen und Trinken", { exact: true }).first()).toBeVisible();

    await openAsHost({
      platform: "twitch",
      channel: freshChannel("kathidden"),
      categories: ["food", "home"],
    });
    // The filter is named, the round's own field is not.
    await expect(page.getByText("Kategorie:")).toHaveCount(0);
  });
});
