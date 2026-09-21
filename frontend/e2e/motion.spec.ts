import { expect, test } from "@playwright/test";

/**
 * The staged moment, and its off switch.
 *
 * Every piece of motion added for the redesign is driven from JavaScript, which
 * the global `prefers-reduced-motion` block in `app/globals.css` cannot reach.
 * So each one is asserted twice: that it moves, and that it does not move for a
 * visitor who asked it not to. A claim about reduced motion that is not
 * measured is a claim about intent.
 */

test.describe("Bewegung", () => {
  test("der Balken eines neuen Worts faehrt seine Breite an", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill("garten");
    const fill = page.locator("[data-slot='meter-fill']").first();

    await input.press("Enter");
    await fill.waitFor();
    // One frame of settle: waitFor resolves on attach, and reading computed
    // style in that same tick can still report the pre-style state.
    await page.waitForTimeout(60);
    const running = await fill.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, seconds: Number.parseFloat(cs.animationDuration) };
    });
    expect(running.name).toBe("meter-run");
    expect(running.seconds).toBeGreaterThan(0.2);

    const early = await fill.evaluate((el) => el.getBoundingClientRect().width);
    await page.waitForTimeout(900);
    const settled = await fill.evaluate((el) => el.getBoundingClientRect().width);
    expect(settled).toBeGreaterThan(early);
  });

  test("bei reduzierter Bewegung steht der Balken sofort", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill("garten");
    const fill = page.locator("[data-slot='meter-fill']").first();

    await input.press("Enter");
    await fill.waitFor();
    await page.waitForTimeout(600);

    // Asserted on the animation itself rather than on two width samples: the
    // window in which a flattened animation is mid-flight is microseconds wide,
    // so sampling it would be a coin toss, not a measurement.
    const state = await fill.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        seconds: Number.parseFloat(cs.animationDuration),
        width: el.getBoundingClientRect().width,
        parent: el.parentElement!.getBoundingClientRect().width,
      };
    });

    expect(state.seconds).toBeLessThan(0.05);
    // And it ends where it belongs, rather than at zero.
    expect(state.width).toBeGreaterThan(state.parent * 0.5);
  });

  test("das geloeste Wort steht vollstaendig im Markup, auch waehrend es aufgebaut wird", async ({
    page,
    request,
  }) => {
    const { word } = await (await request.get("/api/reveal")).json();
    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill(word);
    await input.press("Enter");

    // The card arrives after the winning bar has run out.
    const heading = page.getByRole("heading", { name: word, exact: true });
    await expect(heading).toBeVisible({ timeout: 10_000 });
    // The accessible name is the whole word from the very first frame, even
    // though only some letters are painted yet.
    await expect(heading).toHaveText(new RegExp(word, "i"));
  });

  test("bei reduzierter Bewegung erscheint die Ergebniskarte ohne Verzoegerung", async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { word } = await (await request.get("/api/reveal")).json();
    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill(word);
    const started = Date.now();
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible({
      timeout: 10_000,
    });
    // The staged path waits 1100ms before showing the card; this one must not.
    expect(Date.now() - started).toBeLessThan(1100);
  });
});
