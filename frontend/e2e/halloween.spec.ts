import { EVENT_FORCE_KEY, expect, test, type Page } from "./fixtures";

/**
 * Spooktober 2026 against the real static export.
 *
 * The default fixture switches every seasonal skin off (see fixtures.ts), so
 * each test here opts in: most through the QA override, the calendar test by
 * removing the override and freezing the page clock instead.
 */

const EVENT_ID = "spooktober-2026";
const EVENT_CLASS = "event-halloween";
const PROGRESS_KEY = "kontexto_spooktober_2026";

async function forceEvent(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, id]) => {
      try {
        localStorage.setItem(key, id);
      } catch {
        /* private mode */
      }
    },
    [EVENT_FORCE_KEY, EVENT_ID] as const,
  );
}

async function foundSecrets(page: Page): Promise<string[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { secrets?: string[] };
    return parsed.secrets ?? [];
  }, PROGRESS_KEY);
}

test.describe("Spooktober", () => {
  test("steht vor der Hydration: Klasse, Kürbis im Namen und Friedhof ohne JavaScript", async ({ page }) => {
    await forceEvent(page);
    // Every script file is refused. The inline head script is part of the
    // document and still runs; the skin must not need anything else. A content
    // page, because the game page serves its loading skeleton as static HTML.
    await page.route(/\.js(\?|$)/, (route) => route.abort());
    await page.goto("/anleitung/");
    await expect(page.locator("html")).toHaveClass(new RegExp(EVENT_CLASS));
    await expect(page.locator('a[href="/"] svg[viewBox="0 0 64 64"]').first()).toBeVisible();
    await expect(page.getByTestId("spook-tombstone")).toBeVisible();
    const ringsShown = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href="/"] .rounded-full.border-primary')).filter(
        (el) => getComputedStyle(el).display !== "none",
      ).length,
    );
    expect(ringsShown).toBe(0);
  });

  test("folgt dem Kalender: an im Oktober, aus ab dem 1. November", async ({ page }) => {
    // A value the override does not recognise hands the decision back to the
    // calendar, and a present key keeps the fixture from writing "off", in
    // whichever order the two init scripts run.
    await page.addInitScript((key) => localStorage.setItem(key, "calendar"), EVENT_FORCE_KEY);

    await page.clock.setFixedTime(new Date("2026-10-15T12:00:00+02:00"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(new RegExp(EVENT_CLASS));

    await page.clock.setFixedTime(new Date("2026-11-01T00:00:00+01:00"));
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(new RegExp(EVENT_CLASS));
    await expect(page.getByTestId("spook-pumpkin").first()).toBeHidden();
  });

  test("Kürbis: Anklopfen gibt Süßes und das erste Geheimnis", async ({ page }) => {
    await forceEvent(page);
    await page.goto("/");
    const pumpkin = page.getByTestId("spook-pumpkin").first();
    await expect(pumpkin).toBeVisible();

    await pumpkin.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Geheimnis entdeckt: Kürbisklopfer")).toBeVisible();
    await expect.poll(() => foundSecrets(page)).toContain("pumpkin");
  });

  test("Gruselwort: die Spinne seilt sich ab, der Beutel zeigt den Fund", async ({ page }) => {
    await forceEvent(page);
    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill("spinne");
    await input.press("Enter");

    const spider = page.locator(".spook-spider");
    await expect(spider).toBeAttached();
    // One pass of its own keyframe, not an endless loop (M13).
    const motion = await spider.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, count: cs.animationIterationCount };
    });
    expect(motion).toEqual({ name: "spook-spider", count: "1" });
    await expect(page.getByText("Geheimnis entdeckt: Abgeseilt")).toBeVisible();

    await page.getByRole("button", { name: /Men/ }).click();
    await page.getByRole("menuitem", { name: "Süßigkeiten-Beutel" }).click();
    const bag = page.getByRole("dialog");
    await expect(bag.getByRole("heading", { name: "Dein Süßigkeiten-Beutel" })).toBeVisible();
    await expect(bag.locator('[data-secret="spider"][data-found="true"]')).toBeVisible();
    await expect(bag.locator('[data-secret="ghost"][data-found="false"]')).toBeVisible();
  });

  test("bei reduzierter Bewegung kein Geist, aber der Fund zählt", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await forceEvent(page);
    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill("geist");
    await input.press("Enter");

    await expect(page.getByText("Geheimnis entdeckt: Geisterruf")).toBeVisible();
    await expect.poll(() => foundSecrets(page)).toContain("ghost");
    await expect(page.locator(".spook-ghost")).toHaveCount(0);
    await expect(page.locator("canvas.-z-10")).toHaveCount(0);
  });

  test("der Schalter in den Einstellungen nimmt das Design sofort weg", async ({ page }) => {
    await forceEvent(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(new RegExp(EVENT_CLASS));

    await page.getByRole("button", { name: /Men/ }).click();
    await page.getByRole("menuitem", { name: "Einstellungen" }).click();
    const toggle = page.getByRole("switch", { name: "Halloween-Design" });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(page.locator("html")).not.toHaveClass(new RegExp(EVENT_CLASS));
  });

  for (const path of ["/admin/"]) {
    test(`${path} trägt nie ein Design`, async ({ page }) => {
      await forceEvent(page);
      await page.goto(path);
      await expect(page.locator("html")).not.toHaveClass(new RegExp(EVENT_CLASS));
    });
  }

  test("der geteilte Text trägt einen Kürbis, die Kästchen bleiben", async ({ page, context, request }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await forceEvent(page);
    const { word } = await (await request.get("/api/reveal")).json();
    const { gameNumber } = await (await request.get("/api/game")).json();

    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill(word);
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible({ timeout: 10_000 });

    const dialog = page.getByRole("dialog");
    await page.waitForTimeout(1200);
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole("button", { name: "Überspringen" }).click();
    }

    await page.getByRole("button", { name: "Ergebnis teilen" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(`Kontexto #${gameNumber} \u{1f1e9}\u{1f1ea}\u{1f383}`);
    expect(copied).toContain("\u{1f7e9}");
  });
});
