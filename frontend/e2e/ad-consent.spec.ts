// verify-language-fixture: the selectors quote the German UI they drive.
import { test, expect, type Page } from "./fixtures";
import { ADCASH_VIDEO_SLIDER_ZONE, ADCASH_ZONES } from "../lib/adcash";

/**
 * The Adcash consent banner against the real static export.
 *
 * Third-party requests are aborted by the fixture, but Playwright still reports
 * them as requests, which is exactly what these specs assert on: whether the
 * browser tried to reach Adcash at all, not whether an ad rendered.
 */
test.use({ adConsent: "unset" });

const ADCASH = /acscdn\.com\/script\/aclib\.js/;

/**
 * The display zones are entered in lib/adcash.ts once the Adcash dashboard
 * offers them. Until then nothing loads even with consent, and the specs that
 * need a loaded script say so instead of passing vacuously.
 */
const HAS_ZONES = Object.values(ADCASH_ZONES).some((zone) => zone !== null);
const NO_ZONES = "no Adcash display zone configured in lib/adcash.ts yet";

/**
 * Stands in for aclib.js. With `fill` it puts an element into each target the
 * way a served ad does; without, it does what Adcash does for a zone with no
 * matching ad (an empty 204): nothing. Every video slider call is recorded in
 * `window.__adcashSliders`, so a spec can count them.
 */
async function stubAdcash(page: Page, { fill = true }: { fill?: boolean } = {}): Promise<void> {
  await page.route(ADCASH, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.aclib = { runBanner: function (o) {
        if (!${fill}) return;
        var el = document.querySelector(o.renderIn);
        if (!el) return;
        var ad = document.createElement("div");
        ad.setAttribute("data-rendered", o.zoneId);
        ad.style.cssText = "width:100%;height:100%;background:#ccc";
        el.appendChild(ad);
      }, runVideoSlider: function (o) {
        (window.__adcashSliders = window.__adcashSliders || []).push(o.zoneId);
      } };`,
    }),
  );
}

function adcashRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (ADCASH.test(request.url())) seen.push(request.url());
  });
  return seen;
}

const sliderCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __adcashSliders?: string[] }).__adcashSliders ?? []);

const banner = (page: Page) => page.getByTestId("ad-consent");
const storedChoice = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem("kontexto_ad_consent");
    return raw === null ? null : (JSON.parse(raw) as { choice: string }).choice;
  });

test.describe("Werbe-Einwilligung", () => {
  test("fragt beim ersten Besuch, laedt vorher nichts und blockiert das Spiel nicht", async ({ page }) => {
    const requests = adcashRequests(page);
    await page.goto("/");
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toContainText("Adcash");

    const input = page.getByRole("textbox");
    await input.fill("fahrrad");
    await expect(input).toHaveValue("fahrrad");

    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
  });

  test("das Banner meldet Anzeige, Antwort und Widerruf an den eigenen Server", async ({ page }) => {
    // Headless Chromium is filtered as a bot, so the server answers ok=false
    // here and counts nothing. What is counted is held by the backend tests
    // (TestAdConsent); this spec holds which beacons the banner sends, and that
    // the endpoint takes them.
    const events: string[] = [];
    const statuses: number[] = [];
    page.on("response", (response) => {
      if (!response.url().endsWith("/api/collect/consent")) return;
      events.push((response.request().postDataJSON() as { kind: string }).kind);
      statuses.push(response.status());
    });
    await page.goto("/faq/");
    await expect.poll(() => events).toEqual(["shown"]);
    await banner(page).getByRole("button", { name: "Ablehnen" }).click();
    await expect.poll(() => events).toEqual(["shown", "denied"]);

    await page.getByRole("button", { name: /Cookie-Einstellungen/ }).first().click();
    await banner(page).getByRole("button", { name: "Ablehnen" }).click();
    await page.waitForTimeout(300);
    expect(events).toEqual(["shown", "denied"]);

    await page.getByRole("button", { name: /Cookie-Einstellungen/ }).first().click();
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    await expect.poll(() => events).toEqual(["shown", "denied", "regranted"]);
    expect(statuses).toEqual([200, 200, 200]);
  });

  test("beim ersten Besuch blockiert das Banner nicht, beim Wiederkommen verlangt es eine Wahl", async ({ page }) => {
    await page.goto("/");
    await expect(banner(page)).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    // A round on an earlier day, the way the Kontexto streak records it.
    await page.evaluate(() => {
      localStorage.setItem("kontexto_streak", JSON.stringify({
        datesPlayed: ["2026-01-01"], currentStreak: 0, longestStreak: 1,
      }));
    });
    await page.reload();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Datenschutz" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Impressum" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Ablehnen" }).click();
    await expect(dialog).toBeHidden();
    expect(await storedChoice(page)).toBe("denied");
    await expect(page.getByRole("textbox")).toBeVisible();
  });

  test("Impressum und Datenschutz blockiert das Banner nie", async ({ page }) => {
    await page.goto("/impressum/");
    await page.evaluate(() => {
      localStorage.setItem("kontexto_stats", JSON.stringify({ played: 10 }));
    });
    for (const path of ["/impressum/", "/datenschutz/", "/live/"]) {
      await page.goto(path);
      await expect(banner(page), path).toBeVisible();
      await expect(page.getByRole("alertdialog"), path).toHaveCount(0);
    }
  });

  test("der Pruefcode fuer Adcash steht im HTML, ist aber deaktiviert", async ({ page, request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toContain('<script id="aclib" type="text/plain" src="//acscdn.com/script/aclib.js"></script>');
    expect(html).toContain(`<script type="text/plain">aclib.runAutoTag({ zoneId: 'l8rhgb60kc' });</script>`);
    expect(html).not.toMatch(/<script(?![^>]*text\/plain)[^>]*acscdn/);

    const requests = adcashRequests(page);
    await page.goto("/");
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
  });

  test("Ablehnen und Akzeptieren stehen gleichwertig auf der ersten Ebene", async ({ page }) => {
    await page.goto("/");
    const reject = banner(page).getByRole("button", { name: "Ablehnen" });
    const accept = banner(page).getByRole("button", { name: "Akzeptieren" });
    await expect(reject).toBeVisible();
    await expect(accept).toBeVisible();
    const [r, a] = await Promise.all([reject.boundingBox(), accept.boundingBox()]);
    expect(r?.height).toBe(a?.height);
    expect(Math.abs((r?.y ?? 0) - (a?.y ?? 0))).toBeLessThanOrEqual(1);
    const style = (el: Element) => {
      const s = getComputedStyle(el);
      return { fontSize: s.fontSize, fontWeight: s.fontWeight, border: s.borderTopWidth };
    };
    const [rs, as] = await Promise.all([reject.evaluate(style), accept.evaluate(style)]);
    expect(rs.fontSize).toBe(as.fontSize);
    expect(rs.fontWeight).toBe(as.fontWeight);
    expect(rs.border).not.toBe("0px");
    await expect(banner(page).getByRole("button", { name: /schließen/ })).toHaveCount(0);
  });

  test("nach Ablehnen bleibt Adcash aus, auch nach dem Neuladen", async ({ page }) => {
    const requests = adcashRequests(page);
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Ablehnen" }).click();
    await expect(banner(page)).toBeHidden();
    expect(await storedChoice(page)).toBe("denied");

    await page.reload();
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect(banner(page)).toBeHidden();
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
  });

  test("nach Erlauben fuellt Adcash die Flaechen der Startseite, mit einem einzigen Skript", async ({ page }) => {
    test.skip(!HAS_ZONES, NO_ZONES);
    await stubAdcash(page);
    const requests = adcashRequests(page);
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    await expect(banner(page)).toBeHidden();
    expect(await storedChoice(page)).toBe("granted");
    await expect.poll(() => requests.length).toBe(1);
    expect(await page.locator("script#aclib").getAttribute("src")).toBe(
      "https://acscdn.com/script/aclib.js",
    );
    await expect(page.locator("script[type='text/plain']#aclib")).toHaveCount(0);
    const slots = page.locator("[data-adcash-slot]");
    await expect(slots.first()).toBeVisible();
    for (const slot of await slots.all()) {
      await expect(slot).toContainText("Anzeige");
      await expect(slot.locator("[data-rendered]")).toHaveCount(1);
    }
  });

  test("die Erlaubnis gilt in jedem Modus, Solo wie Mehrspieler", async ({ page }) => {
    test.skip(!HAS_ZONES, NO_ZONES);
    await stubAdcash(page);
    await page.goto("/solo/leiter/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    for (const path of ["/solo/leiter/", "/wordle/", "/duel/", "/koop/", "/arena/", "/wordle/duel/", "/suche/"]) {
      await page.goto(path);
      const slots = page.locator("[data-adcash-slot]");
      await expect(slots.first(), path).toBeVisible();
      for (const slot of await slots.all()) {
        await expect(slot.locator("[data-rendered]"), path).toHaveCount(1);
      }
    }
    await expect(page.locator("script#aclib:not([type='text/plain'])")).toHaveCount(1);
  });

  test("Randbanner ab 1280 Pixeln, 728er-Leiste ab 768, darunter die schmale Leiste", async ({ page }) => {
    test.skip(!HAS_ZONES, NO_ZONES);
    await stubAdcash(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    if (ADCASH_ZONES.railLeft) await expect(page.locator("[data-adcash-slot='railLeft']")).toBeVisible();
    if (ADCASH_ZONES.railRight) await expect(page.locator("[data-adcash-slot='railRight']")).toBeVisible();
    await expect(page.locator("[data-adcash-slot='bottomBar']")).toHaveCount(0);
    await expect(page.locator("[data-adcash-slot='leaderboard']")).toHaveCount(0);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator("[data-adcash-slot^='rail']")).toHaveCount(0);
    await expect(page.locator("[data-adcash-slot='bottomBar']")).toHaveCount(0);
    if (ADCASH_ZONES.leaderboard) {
      const leaderboard = page.locator("[data-adcash-slot='leaderboard']");
      await expect(leaderboard).toBeVisible();
      const box = await leaderboard.boundingBox();
      expect(box?.width ?? 0).toBeLessThanOrEqual(1024);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-adcash-slot^='rail']")).toHaveCount(0);
    await expect(page.locator("[data-adcash-slot='leaderboard']")).toHaveCount(0);
    if (ADCASH_ZONES.bottomBar) {
      await expect(page.locator("[data-adcash-slot='bottomBar']")).toBeVisible();
      const padding = await page.evaluate(() => getComputedStyle(document.body).paddingBottom);
      expect(parseFloat(padding)).toBeGreaterThanOrEqual(50);
    }
  });

  test("der Video-Slider startet einmal pro Seite, auf jeder Breite und ueber Seitenwechsel hinweg", async ({ page }) => {
    test.skip(!ADCASH_VIDEO_SLIDER_ZONE, "no video slider zone configured in lib/adcash.ts");
    await stubAdcash(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    await expect.poll(() => sliderCalls(page)).toEqual([ADCASH_VIDEO_SLIDER_ZONE]);

    // Crossing both breakpoints remounts the layout, which must not stack a second player.
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("link", { name: /Wördle/ }).first().click();
    await expect(page).toHaveURL(/\/wordle\/$/);
    await page.waitForTimeout(300);
    expect(await sliderCalls(page)).toEqual([ADCASH_VIDEO_SLIDER_ZONE]);
  });

  test("ohne Erlauben startet kein Video-Slider", async ({ page }) => {
    await stubAdcash(page);
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Ablehnen" }).click();
    await page.waitForTimeout(500);
    expect(await sliderCalls(page)).toEqual([]);
  });

  test("unter dem Ergebnis einer Runde steht ein Rechteck, waehrend der Runde nicht", async ({ page }) => {
    test.skip(!ADCASH_ZONES.result, "no result zone configured in lib/adcash.ts");
    await stubAdcash(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    const input = page.getByRole("textbox");
    await input.fill("fahrrad");
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await expect(page.locator("[data-adcash-slot='result']")).toHaveCount(0);

    await page.getByRole("button", { name: /^Men/ }).click();
    await page.getByRole("menuitem", { name: "Aufgeben" }).click();
    const confirm = page.getByRole("button", { name: /^Aufgeben$/ });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();

    const result = page.locator("[data-adcash-slot='result']");
    await expect(result).toBeVisible({ timeout: 10_000 });
    await expect(result).toContainText("Anzeige");
    await expect(result.locator("[data-rendered]")).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("ohne ausgelieferte Anzeige bleibt keine leere Flaeche stehen", async ({ page }) => {
    test.skip(!HAS_ZONES, NO_ZONES);
    await stubAdcash(page, { fill: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    await expect(page.locator("[data-adcash-slot='bottomBar']")).toHaveAttribute("data-filled", "false");
    await expect(page.locator("[data-adcash-slot]")).toBeHidden();
    const padding = await page.evaluate(() => getComputedStyle(document.body).paddingBottom);
    expect(padding).toBe("0px");
  });

  test("ohne eingetragene Zone laedt Adcash auch nach Erlauben nicht", async ({ page }) => {
    test.skip(HAS_ZONES, "zones are configured, the loading specs cover this");
    const requests = adcashRequests(page);
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
    await expect(page.locator("[data-adcash-slot]")).toHaveCount(0);
  });

  test("auf Inhalts-, Rechts- und Stream-Seiten laedt Adcash trotz Erlaubnis nicht", async ({ page }) => {
    const requests = adcashRequests(page);
    await page.goto("/faq/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    for (const path of ["/faq/", "/datenschutz/", "/modi/", "/live/"]) {
      await page.goto(path);
      await expect(page.locator("footer")).toBeVisible();
    }
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
    await expect(page.locator("script#aclib:not([type='text/plain'])")).toHaveCount(0);
    await expect(page.locator("[data-adcash-slot]")).toHaveCount(0);
  });

  test("wer die Startseite mit geladenem Adcash verlaesst, bekommt die naechste Seite ohne Adcash", async ({ page }) => {
    test.skip(!HAS_ZONES, NO_ZONES);
    await stubAdcash(page);
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    await expect(page.locator("script#aclib:not([type='text/plain'])")).toHaveCount(1);

    await page.evaluate(() => {
      (window as unknown as { __sameDocument?: boolean }).__sameDocument = true;
    });
    await page.locator("footer").getByRole("link", { name: "Datenschutz" }).first().click();
    await expect(page).toHaveURL(/\/datenschutz\/$/);
    // The URL changes on the client first and the full reload follows. A read
    // that lands inside the reload finds the old context destroyed; that is the
    // reload still under way, so it counts as "same document" and is polled again.
    await expect
      .poll(() =>
        page
          .evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument ?? false)
          .catch(() => true)
      )
      .toBe(false);
    await expect(page.locator("script#aclib:not([type='text/plain'])")).toHaveCount(0);
  });

  test("der Widerruf ueber die Fusszeile entfernt die Adcash-Eintraege und schaltet Adcash ab", async ({ page }) => {
    await stubAdcash(page);
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Akzeptieren" }).click();
    if (HAS_ZONES) await expect(page.locator("script#aclib:not([type='text/plain'])")).toHaveCount(1);
    await page.evaluate(() => {
      localStorage.setItem("vast-client-total-calls", "1");
      localStorage.setItem("adcsh_dbg", "0");
      sessionStorage.setItem("template", "x");
    });

    await page.locator("footer").getByRole("button", { name: "Cookie-Einstellungen" }).click();
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toBeFocused();
    await expect(banner(page)).toContainText("Aktuell akzeptiert.");

    await banner(page).getByRole("button", { name: "Ablehnen" }).click();
    await expect(page.locator("script#aclib:not([type='text/plain'])")).toHaveCount(0);
    await expect(page.locator("[data-adcash-slot]")).toHaveCount(0);
    await expect(page.getByRole("textbox")).toBeVisible();
    expect(await storedChoice(page)).toBe("denied");
    const left = await page.evaluate(() => ({
      local: Object.keys(localStorage).filter((k) => !k.startsWith("kontexto_") && !k.startsWith("wordle_")),
      session: sessionStorage.getItem("template"),
    }));
    expect(left).toEqual({ local: [], session: null });
  });

  test("das geoeffnete Banner laesst sich ohne Aenderung schliessen", async ({ page }) => {
    await page.goto("/faq/");
    await banner(page).getByRole("button", { name: "Ablehnen" }).click();
    await page.locator("footer").getByRole("button", { name: "Cookie-Einstellungen" }).click();
    await expect(banner(page)).toContainText("Aktuell abgelehnt.");
    await banner(page).getByRole("button", { name: /schließen/ }).click();
    await expect(banner(page)).toBeHidden();
    expect(await storedChoice(page)).toBe("denied");
  });
});
