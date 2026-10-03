import { expect, test, type Page } from "./fixtures";

/**
 * The Ko-fi support entry points against the real static export: the floating
 * button on every page (bottom left, right of the menu on a game page from lg), the line on the result card of a solved round, and the footer link. A page
 * view loads nothing from Ko-fi, only a click mounts Ko-fi's tip panel, and each
 * opening is counted with the place it came from. The fixtures abort every
 * third-party request, so the frame never reaches ko-fi.com here.
 */

const KOFI = /^https:\/\/([a-z0-9-]+\.)?ko-fi\.com\//;
const EMBED = "https://ko-fi.com/kontexto/?hidefeed=true&widget=true&embed=true&preview=true";
const TITLE = "Hey, magst du Kontexto einen Kaffee ausgeben?";

function recordKofiRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (KOFI.test(request.url())) seen.push(request.url());
  });
  return seen;
}

/** Resolves with the source of the next support beacon the page sends. */
function nextSupportBeacon(page: Page): Promise<string> {
  return page
    .waitForRequest((r) => r.url().endsWith("/api/collect/support") && r.method() === "POST")
    .then((r) => (JSON.parse(r.postData() ?? "{}") as { source: string }).source);
}

test.describe("Unterstützen", () => {
  for (const path of ["/", "/wordle/", "/ueber/"]) {
    test(`der Knopf steht auf ${path} und lädt vor dem Klick nichts von Ko-fi`, async ({ page }) => {
      const kofi = recordKofiRequests(page);
      await page.goto(path);
      await expect(page.getByTestId("support-fab")).toBeVisible();
      await expect(page.locator('iframe[src*="ko-fi.com"]')).toHaveCount(0);
      expect(kofi).toEqual([]);
    });
  }

  test("öffnet das Ko-fi-Panel erst auf Klick, zählt die Ecke und schließt wieder", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const kofi = recordKofiRequests(page);
    await page.goto("/");
    const beacon = nextSupportBeacon(page);
    await page.getByTestId("support-fab").click();
    expect(await beacon).toBe("corner");

    const dialog = page.getByRole("dialog", { name: TITLE });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("iframe")).toHaveAttribute("src", EMBED);
    await expect(dialog.getByRole("link", { name: "Lieber direkt auf ko-fi.com" })).toHaveAttribute(
      "href",
      "https://ko-fi.com/kontexto",
    );
    await expect.poll(() => kofi.length).toBeGreaterThan(0);

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('iframe[src*="ko-fi.com"]')).toHaveCount(0);
  });

  test("am Desktop steht der Knopf auf einer Spielseite neben dem Menü, auf einer Inhaltsseite unten links", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const pinned = await page.getByTestId("support-fab").boundingBox();
    expect(pinned).not.toBeNull();
    const menu = await page.locator("header").first().getByRole("button", { name: /Menü/ }).boundingBox();
    expect(menu).not.toBeNull();
    // Directly right of the menu button and on its row.
    expect(pinned!.x).toBeGreaterThan(menu!.x + menu!.width);
    expect(pinned!.x - (menu!.x + menu!.width)).toBeLessThan(32);
    expect(Math.abs(pinned!.y + pinned!.height / 2 - (menu!.y + menu!.height / 2))).toBeLessThanOrEqual(2);

    const beacon = nextSupportBeacon(page);
    await page.getByTestId("support-fab").click();
    expect(await beacon).toBe("pinned");
    await page.getByRole("dialog", { name: TITLE }).getByRole("button", { name: "Close" }).click();

    await page.goto("/ueber/");
    const corner = await page.getByTestId("support-fab").boundingBox();
    expect(corner).not.toBeNull();
    expect(corner!.x).toBeLessThan(60);
    expect(corner!.y + corner!.height).toBeGreaterThan(800 - 60);
  });

  test("nach dem Lösen steht eine ruhige Zeile unter dem Ergebnis, die nichts von selbst öffnet", async ({
    page,
    request,
  }) => {
    const { word } = await (await request.get("/api/reveal")).json();
    await page.goto("/");
    await expect(page.getByTestId("support-prompt")).toHaveCount(0);

    const input = page.getByRole("textbox");
    await input.fill(word);
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible({ timeout: 10_000 });

    const prompt = page.getByTestId("support-prompt");
    await expect(prompt).toBeVisible();
    await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);

    const beacon = nextSupportBeacon(page);
    await prompt.getByRole("button", { name: "Kaffee ausgeben" }).click();
    expect(await beacon).toBe("result_kontexto");
    await expect(page.getByRole("dialog", { name: TITLE })).toBeVisible();
  });

  test("die Leisten neben dem Spielfeld zeigen vor dem ersten Unterstützer nur einen ruhigen Satz", async ({
    page,
  }) => {
    await page.route("**/api/supporters", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ names: [] }) }),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const left = page.getByTestId("supporter-rail-left");
    await expect(left).toBeVisible();
    await expect(left).toContainText("Hier stehen bald die Leute, die Kontexto unterstützen.");
    await expect(left.getByRole("button")).toHaveCount(0);
    await expect(page.getByTestId("supporter-rail-right")).toHaveCount(0);
  });

  test("ein bekannter Name steht sofort in der Leiste, ein verdächtiger erst nach Freigabe, ein privater nie", async ({
    page,
    request,
  }) => {
    const stamp = Date.now().toString(36);
    const send = (name: string, isPublic: boolean, id: string) =>
      request.post("/api/kofi/webhook", {
        form: {
          data: JSON.stringify({
            verification_token: "e2e-kofi",
            type: "Donation",
            is_public: isPublic,
            from_name: name,
            amount: "3.00",
            currency: "EUR",
            kofi_transaction_id: `e2e-${id}-${stamp}`,
          }),
        },
      });
    // The suite's database outlives a run, so the names are fixed and the
    // transaction ids unique; the newest payment puts its name first.
    expect((await send("Zocker77", true, "pending")).status()).toBe(200);
    expect((await send("Heimlich", false, "private")).status()).toBe(200);
    expect((await send("Lena", true, "known")).status()).toBe(200);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const left = page.getByTestId("supporter-rail-left");
    await expect(left.getByRole("listitem").first()).toHaveText("Lena");
    await expect(page.getByText("Zocker77")).toHaveCount(0);
    await expect(page.getByText("Heimlich")).toHaveCount(0);

    // Beside the board, never over it, and gone below xl.
    const board = await page.getByRole("textbox").boundingBox();
    const rail = await left.boundingBox();
    expect(rail!.x + rail!.width).toBeLessThan(board!.x);
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(left).toBeHidden();
  });

  for (const path of ["/live/", "/admin/", "/duel/create/", "/suche/"]) {
    test(`steht auch auf ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId("support-fab")).toBeVisible();
    });
  }

  test("der Fußzeilenlink führt zu Ko-fi in einem neuen Tab und wird gezählt", async ({ page, context }) => {
    await page.goto("/ueber/");
    const link = page.getByRole("contentinfo").getByRole("link", { name: "Kontexto unterstützen" });
    await expect(link).toHaveAttribute("href", "https://ko-fi.com/kontexto");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const beacon = nextSupportBeacon(page);
    const popup = context.waitForEvent("page");
    await link.click();
    expect(await beacon).toBe("footer");
    await (await popup).close();
  });
});
