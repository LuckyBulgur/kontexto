// verify-language-fixture: the selectors quote the German UI they drive.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * The stream-chat mode end to end: open a room from the form, let a viewer
 * "type" a word, and see it on the host's board and on the OBS overlay.
 *
 * The chat is faked through the dev-only /api/live/<id>/debug-message endpoint,
 * which hands the message to the same ingest a real Twitch or TikTok line would
 * reach. Nothing here opens a socket to either; the backend runs with
 * KONTEXTO_LIVE_OFFLINE (see playwright.config.ts), so no reader is started.
 */

/** A channel name nobody else in this run is using. */
function freshChannel(): string {
  return `kanal${Date.now().toString().slice(-8)}`;
}

async function sendChatMessage(
  page: Page,
  roomId: string,
  viewer: string,
  text: string
): Promise<void> {
  const res = await page.request.post(`/api/live/${roomId}/debug-message`, {
    data: { external_id: viewer, display_name: viewer, text },
  });
  expect(res.ok()).toBe(true);
}

async function openRoom(page: Page, channel: string): Promise<string> {
  await page.goto("/live/");
  await page.getByLabel("Dein Twitch-Kanal").fill(channel);
  await page.getByRole("button", { name: "Runde starten" }).click();
  await page.waitForURL(/\/live\/[^/]+\/$/, { timeout: 20_000 });
  const id = new URL(page.url()).pathname.split("/").filter(Boolean)[1];
  expect(id).toBeTruthy();
  return id;
}

test.describe("Stream-Chat-Modus", () => {
  test("der Chat rät mit, und die Einblendung zeigt es", async ({ page }) => {
    const channel = freshChannel();
    const roomId = await openRoom(page, channel);

    // The host sees which channel is being read.
    // The sidebar is in the markup twice, once per breakpoint, and exactly one
    // of the two is visible at any width. Filtering on that is what makes this
    // assertion mean "the host can see it" rather than "it exists somewhere".
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });

    await sendChatMessage(page, roomId, "42", "apfel");

    // The guess lands on the shared board under the viewer's chat name.
    await expect(page.getByText("apfel", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });

    const overlayToken = await page.evaluate(
      (id) => localStorage.getItem(`kontexto_live_${id}`),
      roomId
    );
    expect(overlayToken).toBeTruthy();

    await page.goto(`/live/overlay/?token=${encodeURIComponent(overlayToken!)}`);
    await expect(page.getByText("apfel", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("ein TikTok-Chat rät genauso mit", async ({ page }) => {
    // The e2e backend carries a dummy Euler key, so TikTok is on offer; with
    // KONTEXTO_LIVE_OFFLINE the key is never sent anywhere.
    const handle = `tt.${Date.now().toString().slice(-8)}`;
    await page.goto("/live/");
    const tiktok = page.getByRole("button", { name: "TikTok" });
    await expect(tiktok).toBeEnabled({ timeout: 20_000 });
    await tiktok.click();
    await expect(tiktok).toHaveAttribute("aria-pressed", "true");

    await page.getByLabel("Dein TikTok-Name").fill(`https://www.tiktok.com/@${handle}/live`);
    await expect(page.getByText(`Gelesen wird tiktok.com/@${handle}`)).toBeVisible();
    await page.getByRole("button", { name: "Runde starten" }).click();
    await page.waitForURL(/\/live\/[^/]+\/$/, { timeout: 20_000 });
    const roomId = new URL(page.url()).pathname.split("/").filter(Boolean)[1];

    await expect(
      page.getByText(`@${handle}`, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });

    await sendChatMessage(page, roomId, "tt:7485681802586752017", "apfel");
    await expect(page.getByText("apfel", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("ein unmöglicher TikTok-Name wird sofort beanstandet", async ({ page }) => {
    await page.goto("/live/");
    const tiktok = page.getByRole("button", { name: "TikTok" });
    await expect(tiktok).toBeEnabled({ timeout: 20_000 });
    await tiktok.click();
    await page.getByLabel("Dein TikTok-Name").fill("endet.");
    await expect(page.getByText(/kein TikTok-Name/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Runde starten" })).toBeDisabled();
  });

  test("ein Satz im Chat ist kein Versuch", async ({ page }) => {
    const channel = freshChannel();
    const roomId = await openRoom(page, channel);

    await sendChatMessage(page, roomId, "7", "das ist bestimmt schwer");
    await sendChatMessage(page, roomId, "7", "apfel");

    await expect(page.getByText("apfel", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("das ist bestimmt schwer")).toHaveCount(0);
  });

  test("ein Kanal, eine Runde", async ({ page }) => {
    const channel = freshChannel();
    await openRoom(page, channel);

    await page.goto("/live/");
    await page.getByLabel("Dein Twitch-Kanal").fill(channel);
    await page.getByRole("button", { name: "Runde starten" }).click();
    await expect(page.getByText(/läuft schon eine Runde/)).toBeVisible({ timeout: 20_000 });
  });

  test("ein unmöglicher Kanalname wird sofort beanstandet", async ({ page }) => {
    await page.goto("/live/");
    await page.getByLabel("Dein Twitch-Kanal").fill("hat leerzeichen");
    await expect(page.getByText(/kein Twitch-Kanal/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Runde starten" })).toBeDisabled();
  });

  test("wer nicht der Streamer ist, sieht das Brett nicht", async ({ page }) => {
    const channel = freshChannel();
    const roomId = await openRoom(page, channel);

    // A viewer reads the room URL off the stream and opens it. There is nothing
    // for them to do there: they play in the chat.
    await page.evaluate((id) => localStorage.removeItem(`kontexto_koop_${id}`), roomId);
    await page.goto(`/live/${roomId}/`);

    await expect(page.getByText(/gehört zu einem Stream/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder("Wort eingeben...")).toHaveCount(0);
  });

  test("eine Nachricht vom Betreiber erscheint nur beim Streamer", async ({ page }) => {
    const channel = freshChannel();
    const roomId = await openRoom(page, channel);
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });

    // The dev seam runs the same normalisation and insert as the admin route,
    // which needs a passkey session the suite cannot create.
    const text = "Danke für den Stream!";
    const res = await page.request.post(`/api/live/${roomId}/debug-host-message`, {
      data: { text },
    });
    expect(res.ok()).toBe(true);

    const banner = page.getByTestId("host-message");
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await expect(banner).toContainText(text);

    // It leaves by itself, without a click.
    await expect(banner).toHaveCount(0, { timeout: 20_000 });

    // Shown once: the confirmation took it off the server's list.
    const token = await page.evaluate(
      (id) => localStorage.getItem(`kontexto_koop_${id}`),
      roomId
    );
    const state = await page.request.get(
      `/api/live/${roomId}?token=${encodeURIComponent(token!)}`
    );
    expect((await state.json()).messages).toEqual([]);

    // The audience's view never carries it.
    const overlayToken = await page.evaluate(
      (id) => localStorage.getItem(`kontexto_live_${id}`),
      roomId
    );
    await page.goto(`/live/overlay/?token=${encodeURIComponent(overlayToken!)}`);
    await expect(page.getByText(/keiner laufenden Runde|Runde \d+/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(text)).toHaveCount(0);
  });

  test("die Einblendung ohne Token zeigt kein Brett", async ({ page }) => {
    await page.goto("/live/overlay/");
    await expect(page.getByText(/keiner laufenden Runde/)).toBeVisible({ timeout: 20_000 });
  });
});
