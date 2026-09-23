import { expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { test, blockThirdParty, presetAdConsent } from "./fixtures";

/**
 * The screenshots the README shows, taken from the running application rather
 * than cropped by hand, so they can be re-taken after a redesign.
 *
 * Two things make this spec different from the smoke suite:
 *
 * 1. **It needs a real dataset.** The mock in `data-e2e` holds 144 words and
 *    assigns ranks by index distance, so a picture of it shows nonsense pairs
 *    ("und" on rank 7) and every bar lands in the near band. A screenshot has
 *    to be truthful about what the game feels like, so the dataset is built
 *    from real fastText vectors; `docs/screenshots.md` has the two commands.
 *    The backend is pointed at it with KONTEXTO_E2E_DATA_DIR.
 * 2. **Nothing is asserted about the images.** A picture is evidence for a
 *    human. The assertions here only make sure the page reached the state that
 *    is worth photographing before the shutter opens.
 *
 * Kept out of `pnpm test:e2e` (testMatch is **\/*.spec.ts, which would pick it
 * up) by the same env guard `design-audit.spec.ts` uses.
 */

const SHOOT = !!process.env.KONTEXTO_README_SHOTS;
const SHOTS = resolve(process.cwd(), "..", "docs", "assets", "screenshots");

/**
 * Deliberately not the near band only: the three colours of the rank ramp are
 * the product's signature, so the board in the picture has to show all three.
 * Against the screenshot dataset these land on roughly 15000, 5400, 1400, 500,
 * 150 and 25, which is a game that is going well without being over.
 */
const GUESSES = ["arbeit", "musik", "haus", "durst", "regen", "fluss"];

/** Two rows that colour well against the screenshot dataset's daily answer. */
const WORDLE_GUESSES = ["regen", "tafel"];

test.describe("README screenshots", () => {
  test.skip(!SHOOT, "Set KONTEXTO_README_SHOTS=1 to take the README screenshots.");

  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  for (const theme of ["light", "dark"] as const) {
    test(`Kontexto board, ${theme}`, async ({ page }) => {
      await setTheme(page, theme);
      await page.setViewportSize({ width: 1280, height: 640 });
      await page.goto("/");
      await playGuesses(page, GUESSES);
      await settle(page);
      await page.screenshot({ path: `${SHOTS}/kontexto-${theme}.png` });
    });
  }

  test("Woerdle board", async ({ page }) => {
    await setTheme(page, "light");
    await page.setViewportSize({ width: 1280, height: 860 });
    const loaded = page.waitForResponse((r) => r.url().includes("/api/wordle/game") && r.ok());
    await page.goto("/wordle/");
    await loaded;
    const enter = page.getByRole("button", { name: "Enter", exact: true });
    await expect(enter).toBeVisible();
    for (const word of WORDLE_GUESSES) {
      // Typed with a delay and submitted through the on-screen button, for the
      // reason spelled out in wordle.spec.ts: the physical Enter races the
      // state commit of the last letter.
      await page.keyboard.type(word, { delay: 60 });
      await enter.click();
      await page.waitForTimeout(1200);
    }
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/wordle.png` });
  });

  test("Duel room with two players", async ({ browser, request }) => {
    const created = await request.post("/api/duel", {
      // "today", not a random game: the guesses below are chosen for the
      // screenshot dataset's current daily answer, so the bars in the picture
      // span all three bands instead of landing wherever a random game puts them.
      data: { game_source: "today", nickname: "Mara", tips_allowed: true },
    });
    expect(created.ok()).toBeTruthy();
    const { duel_id, player_token } = await created.json();

    const guestCtx = await browser.newContext();
    await blockThirdParty(guestCtx);
    await presetAdConsent(guestCtx);
    const guest = await guestCtx.newPage();
    await guest.goto(`/duel/${duel_id}/`);
    await guest.getByPlaceholder("Dein Nickname...").fill("Jonas");
    await guest.getByRole("button", { name: "Beitreten" }).click();
    await playGuesses(guest, ["haus", "regen"]);

    const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 470 } });
    await blockThirdParty(hostCtx);
    await presetAdConsent(hostCtx);
    const host = await hostCtx.newPage();
    await setTheme(host, "dark");
    await host.addInitScript(
      ([id, token]) => localStorage.setItem(`kontexto_duel_${id}`, token),
      [duel_id, player_token] as const,
    );
    await host.goto(`/duel/${duel_id}/`);
    // The opponent arrives over the WebSocket, one second-poll behind.
    await expect(host.getByText("Jonas").first()).toBeAttached({ timeout: 15_000 });
    await playGuesses(host, ["arbeit", "durst", "fluss"]);
    await settle(host);
    await host.screenshot({ path: `${SHOTS}/duell.png` });

    await guestCtx.close();
    await hostCtx.close();
  });

  test("Mode catalogue", async ({ page }) => {
    await setTheme(page, "light");
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto("/modi/");
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/modi.png`, fullPage: true });
  });

  test("Kontexto board on a phone", async ({ page }) => {
    await setTheme(page, "light");
    await page.setViewportSize({ width: 390, height: 640 });
    await page.goto("/");
    await playGuesses(page, GUESSES);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/mobil.png` });
  });
});

async function playGuesses(page: Page, words: string[]): Promise<void> {
  const input = page.getByRole("textbox");
  await expect(input).toBeVisible();
  for (const word of words) {
    await input.fill(word);
    await input.press("Enter");
    await expect(input).toHaveValue("");
    // The Meter runs its width animation on every new guess; letting it finish
    // keeps the bars in the picture at their true length.
    await page.waitForTimeout(500);
  }
}

/** Let the last animation land, then take the shutter out of its way. */
async function settle(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(700);
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("kontexto_theme", t);
    } catch {
      /* private mode */
    }
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
}
