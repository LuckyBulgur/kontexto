import { EGGS_FORCE_KEY, expect, test, type Page } from "./fixtures";

/**
 * The easter eggs against the real static export: a scene word sends its
 * picture across the screen once, words typed one after the other each play
 * (the cooldown is per word only), a word the game refuses still fires, Wordle
 * rows fire, a word without a scene plays nothing, and nothing moves under
 * reduced motion. The scenes themselves are pinned in
 * lib/easter-eggs/scenes.test.ts.
 */

test.beforeEach(async ({ context }) => {
  // The fixture switches the eggs off for every other spec; this one wants them.
  await context.addInitScript((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage blocked: the eggs play anyway, which is what this spec needs.
    }
  }, EGGS_FORCE_KEY);
});

async function guess(page: Page, word: string): Promise<void> {
  const input = page.getByRole("textbox");
  await input.fill(word);
  await input.press("Enter");
}

test.describe("Easter Eggs", () => {
  test("ein Wort schickt sein Bild einmal über den Schirm", async ({ page }) => {
    await page.goto("/");
    await guess(page, "sonne");

    const layer = page.locator('.egg-layer[data-egg="sonne"]');
    await expect(layer).toBeAttached();
    const sprite = layer.locator("img.egg-sprite");
    await expect(sprite.first()).toHaveAttribute("src", "/eggs/svg/sun.svg");
    const motion = await sprite.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, count: cs.animationIterationCount };
    });
    expect(motion.name).toBe("egg-spin");
    expect(motion.count).toBe("1");
    expect(await layer.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    expect(await layer.getAttribute("aria-hidden")).toBe("true");
    await expect(layer).toHaveCount(0, { timeout: 8_000 });
  });

  test("neue Wörter hintereinander spielen alle", async ({ page }) => {
    await page.goto("/");
    await guess(page, "sonne");
    await expect(page.getByText("sonne").first()).toBeVisible();
    await guess(page, "regen");
    await expect(page.locator('.egg-layer[data-egg="sonne"]')).toBeAttached();
    await expect(page.locator('.egg-layer[data-egg="regen"]')).toBeAttached();
  });

  test("ein Wort ohne Szene spielt nichts", async ({ page }) => {
    await page.goto("/");
    await guess(page, "hund");
    await expect(page.getByText("hund").first()).toBeVisible();
    await guess(page, "sonne");
    await expect(page.locator('.egg-layer[data-egg="sonne"]')).toBeAttached();
    await expect(page.locator('.egg-layer[data-egg="hund"]')).toHaveCount(0);
  });

  test("ein Wort, das das Spiel nicht kennt, spielt trotzdem: MLG", async ({ page }) => {
    await page.goto("/");
    await guess(page, "mlg");
    const layer = page.locator('.egg-layer[data-egg="mlg"]');
    await expect(layer).toBeAttached();
    await expect(layer.locator(".egg-text").first()).toHaveText("MLG");
    await expect(layer.locator(".egg-hitmarker").first()).toBeAttached({ timeout: 3_000 });
    // The refusal still comes as usual.
    await expect(page.getByText("Dieses Wort kenne ich leider nicht")).toBeVisible();
  });

  test("eine Wordle-Zeile spielt ihr Wort", async ({ page }) => {
    const gameLoaded = page.waitForResponse((r) => r.url().includes("/api/wordle/game") && r.ok());
    await page.goto("/wordle/");
    await gameLoaded;
    await expect(page.getByRole("button", { name: "Enter", exact: true })).toBeVisible();
    await page.keyboard.type("regen", { delay: 60 });
    await page.getByRole("button", { name: "Enter", exact: true }).click();
    await expect(page.locator('.egg-layer[data-egg="regen"]')).toBeAttached();
  });

  test("bei reduzierter Bewegung bewegt sich nichts", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await guess(page, "sonne");
    await expect(page.getByText("sonne").first()).toBeVisible();
    await expect(page.locator(".egg-layer")).toHaveCount(0);
  });
});
