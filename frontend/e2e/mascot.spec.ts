import { expect, test, type Page } from "./fixtures";

/**
 * The peanut mascot against the real static export: the word for peanut sends
 * it across the screen once, in the solo game and from a stream chat, and not
 * at all under reduced motion. The cooldown is pinned in lib/mascot.test.ts.
 */

const WORD = "erdnuss";

async function guess(page: Page, word: string): Promise<void> {
  const input = page.getByRole("textbox");
  await input.fill(word);
  await input.press("Enter");
}

test.describe("Maskottchen", () => {
  test("die Erdnuss fliegt einmal durch und geht wieder", async ({ page }) => {
    await page.goto("/");
    await guess(page, WORD);

    const flight = page.locator("img.mascot-flight");
    await expect(flight).toBeAttached();
    const motion = await flight.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, count: cs.animationIterationCount, events: cs.pointerEvents };
    });
    expect(motion.name).toMatch(/^mascot-fly(-reverse)?$/);
    expect(motion.count).toBe("1");
    expect(await page.locator(".mascot-layer").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
      "none",
    );
    await expect(page.locator(".mascot-layer")).toHaveCount(0, { timeout: 6_000 });
  });

  test("ein anderes Wort lässt sie in Ruhe", async ({ page }) => {
    await page.goto("/");
    await guess(page, "birne");
    await expect(page.getByText("birne").first()).toBeVisible();
    await expect(page.locator(".mascot-layer")).toHaveCount(0);
  });

  test("bei reduzierter Bewegung fliegt nichts", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await guess(page, WORD);
    await expect(page.getByText(WORD).first()).toBeVisible();
    await expect(page.locator(".mascot-layer")).toHaveCount(0);
  });

  test("ein Chat-Wort im Live-Raum schickt sie auch los", async ({ page }) => {
    const channel = `kanal${Date.now().toString().slice(-8)}`;
    await page.goto("/live/");
    await page.getByLabel("Dein Twitch-Kanal").fill(channel);
    await page.getByRole("button", { name: "Heutiges Spiel" }).click();
    await page.getByRole("button", { name: "Runde starten" }).click();
    await page.waitForURL(/\/live\/[^/]+\/$/, { timeout: 20_000 });
    const roomId = new URL(page.url()).pathname.split("/").filter(Boolean)[1];
    await expect(page.getByText(channel, { exact: true }).filter({ visible: true })).toBeVisible({
      timeout: 20_000,
    });

    const res = await page.request.post(`/api/live/${roomId}/debug-message`, {
      data: { external_id: "nussfan", display_name: "nussfan", text: `ist es ${WORD}?` },
    });
    expect(res.ok()).toBe(true);
    await expect(page.locator("img.mascot-flight")).toBeAttached({ timeout: 20_000 });
  });
});
