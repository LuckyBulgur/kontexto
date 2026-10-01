import { test, expect } from "./fixtures";

// Typing "klopfen" knocks on a door. The real play() is replaced by a recorder,
// so the test hears nothing and still knows what would have sounded, and how
// loud.
test.describe("Klopfen", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const played: { src: string; volume: number }[] = [];
      (window as unknown as { __played: typeof played }).__played = played;
      HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
        played.push({ src: this.src, volume: this.volume });
        return Promise.resolve();
      };
    });
  });

  const played = (page: import("@playwright/test").Page) =>
    page.evaluate(
      () => (window as unknown as { __played: { src: string; volume: number }[] }).__played
    );

  test("klopfen spielt das Klopfen, leise", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();

    await input.fill("Klopfen");
    await input.press("Enter");
    await expect.poll(() => played(page)).toHaveLength(1);
    const [knock] = await played(page);
    expect(knock.src).toMatch(/\/sounds\/klopfen\.mp3$/);
    expect(knock.volume).toBeLessThan(1);

    // The file is served, and it is a small mp3.
    const res = await page.request.get("/sounds/klopfen.mp3");
    expect(res.ok()).toBe(true);
    expect((await res.body()).length).toBeLessThan(100_000);
  });

  test("ein anderes Wort bleibt still", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();
    await input.fill("apfel");
    await input.press("Enter");
    await expect(page.getByText("apfel", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    expect(await played(page)).toHaveLength(0);
  });
});
