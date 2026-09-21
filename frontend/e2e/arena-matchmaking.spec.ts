import { test, expect, blockThirdParty } from "./fixtures";

/**
 * The whole new multiplayer path in one run: two strangers enter the queue, the
 * WS worker pairs them, both land in the same arena, the round starts and the
 * countdown runs.
 *
 * This is the part the unit tests cannot reach. matchmaking.py is tested against
 * a stand-in room factory, arena.py against explicit timestamps; neither of them
 * knows whether the pairing loop actually runs in the served process, whether
 * the room the queue built is the room the client opens, or whether the
 * /arena/<id>/ fallback resolves at all.
 */
test.describe("Arena über die Mitspielersuche", () => {
  test("zwei Fremde werden gepaart und starten eine Blitz-Runde", async ({ browser }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    for (const context of contexts) await blockThirdParty(context);
    const [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));

    // Both enter the queue for the same mode. Blitz pairs at two players with no
    // grace period, so the wait is one pass of the matchmaking loop.
    for (const [page, name] of [
      [alice, "Alice"],
      [bob, "Bob"],
    ] as const) {
      await page.goto("/suche/?modus=blitz");
      await page.getByLabel("Dein Name (optional)").fill(name);
      await page.getByRole("button", { name: "Mitspieler suchen" }).click();
    }

    // The queue screen redirects to the room once the pairing loop has run.
    await expect(alice).toHaveURL(/\/arena\/[^/]+\/$/, { timeout: 20_000 });
    await expect(bob).toHaveURL(/\/arena\/[^/]+\/$/, { timeout: 20_000 });
    expect(new URL(alice.url()).pathname).toBe(new URL(bob.url()).pathname);

    // Both sit in the same lobby and see each other.
    await expect(alice.getByText(/2 von \d+ im Raum/)).toBeVisible({ timeout: 20_000 });
    await expect(alice.getByText("Bob").first()).toBeAttached();

    // Any player may start; the first deadline is written by the server.
    await alice.getByRole("button", { name: "Runde starten" }).click();

    // A running countdown is the proof that the deadline arrived and is being
    // rendered against the server clock. mm:ss while above a minute.
    await expect(alice.getByText(/^\d:\d\d$/)).toBeVisible({ timeout: 20_000 });
    await expect(bob.getByText(/^\d:\d\d$/)).toBeVisible({ timeout: 20_000 });

    // A guess reaches the other player's board through the arena WebSocket.
    const input = alice.getByRole("textbox");
    await input.fill("apfel");
    await input.press("Enter");
    await expect(bob.getByText("Alice").first()).toBeAttached({ timeout: 20_000 });
    await expect(bob.getByText("1 Versuche").first()).toBeAttached({ timeout: 20_000 });

    for (const context of contexts) await context.close();
  });
});

test.describe("Auslastung vor dem Einreihen", () => {
  // Any sentence loadSentence() can produce. The exact wording is covered by
  // lib/matchmaking-rules.test.ts; what only a real run can show is that the
  // line reaches the page at all, with a figure the server actually sent.
  const LOAD_LINE = /Gerade niemand da|\d+ (wartet|warten|spielt|spielen)/;

  test("jeder Modus nennt, wie viel gerade los ist", async ({ page }) => {
    await page.goto("/suche/");

    for (const mode of ["duel", "koop", "wordle_duel", "royale", "blitz", "timerush"]) {
      const row = page.locator(`label[for="modus-${mode}"]`);
      await expect(row.getByText(LOAD_LINE)).toBeVisible({ timeout: 20_000 });
    }
  });

  /**
   * How many the royale row currently claims are waiting. "Gerade niemand da"
   * is zero; anything else carries the figure.
   */
  async function waitingOnRoyale(page: import("@playwright/test").Page): Promise<number> {
    const row = page.locator('label[for="modus-royale"]');
    const text = await row.innerText();
    const hit = text.match(/(\d+)\s+(?:wartet|warten)/);
    return hit ? Number(hit[1]) : 0;
  }

  test("ein wartender Spieler taucht in der Liste auf", async ({ browser }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    for (const context of contexts) await blockThirdParty(context);
    const [waiter, watcher] = await Promise.all(contexts.map((c) => c.newPage()));

    // Asserted as a delta, not as an absolute count. A ticket lives
    // TICKET_TTL_SECONDS (300s, matchmaking.py) and the suite shares one SQLite
    // file, so leftovers from an earlier test or an earlier run are still in the
    // queue and "1 wartet" is only true on a cold one. Measured: the same line
    // read "1 wartet gerade" and then "2 warten gerade" seconds later, with
    // nobody new joining.
    await watcher.goto("/suche/");
    await expect(watcher.locator('label[for="modus-royale"]').getByText(LOAD_LINE)).toBeVisible({
      timeout: 20_000,
    });
    const before = await waitingOnRoyale(watcher);

    // Royale needs three players, so a single ticket stays in the queue long
    // enough for a second tab to read it.
    await waiter.goto("/suche/?modus=royale");
    await waiter.getByRole("button", { name: "Mitspieler suchen" }).click();
    await expect(waiter.getByText("Suche Mitspieler")).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(() => waitingOnRoyale(watcher), { timeout: 20_000, intervals: [500] })
      .toBeGreaterThan(before);

    for (const context of contexts) await context.close();
  });
});

/**
 * The other two room shapes the queue can build. `_matchmaking_room` in main.py
 * has one branch per family (duel, koop, wordle-duel, arena) and the Blitz test
 * above only covers the arena one. A broken branch would not fail a unit test:
 * matchmaking.py is tested against a stand-in factory precisely so it knows
 * nothing about rooms.
 */
const PAIRED_MODES = [
  { mode: "koop", label: "Koop", path: /\/koop\/[^/]+\/$/ },
  { mode: "wordle_duel", label: "Wördle-Duell", path: /\/wordle\/duel\/[^/]+\/$/ },
] as const;

for (const entry of PAIRED_MODES) {
  test(`die Suche baut auch einen ${entry.label}-Raum`, async ({ browser }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    for (const context of contexts) await blockThirdParty(context);
    const pages = await Promise.all(contexts.map((c) => c.newPage()));

    for (const [index, page] of pages.entries()) {
      await page.goto(`/suche/?modus=${entry.mode}`);
      await page.getByLabel("Dein Name (optional)").fill(`Spieler${index + 1}`);
      await page.getByRole("button", { name: "Mitspieler suchen" }).click();
    }

    // Koop waits out a grace period before starting small, so allow for it.
    for (const page of pages) {
      await expect(page).toHaveURL(entry.path, { timeout: 40_000 });
    }
    expect(new URL(pages[0].url()).pathname).toBe(new URL(pages[1].url()).pathname);

    for (const context of contexts) await context.close();
  });
}
