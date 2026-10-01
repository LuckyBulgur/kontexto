// verify-language-fixture: the selectors quote the German UI they drive.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * The stream-chat mode end to end: open a room from the form, let a viewer
 * "type" a word, and see it on the host's board with the viewer's platform and
 * badges; let a viewer pay, and see it celebrated.
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
  text: string,
  platform?: "twitch" | "tiktok",
  login?: string,
  badges?: string
): Promise<void> {
  const res = await page.request.post(`/api/live/${roomId}/debug-message`, {
    data: {
      external_id: viewer,
      display_name: viewer,
      text,
      ...(platform ? { platform } : {}),
      ...(login ? { login } : {}),
      ...(badges ? { badges } : {}),
    },
  });
  expect(res.ok()).toBe(true);
}

/** Paid support through the dev-only seam, the path a reader's event takes. */
async function sendPaidEvent(
  page: Page,
  roomId: string,
  event: Record<string, string | number>
): Promise<void> {
  const res = await page.request.post(`/api/live/${roomId}/debug-event`, { data: event });
  expect(res.ok()).toBe(true);
  expect((await res.json()).stored).toBe(true);
}

async function openRoom(page: Page, channel: string, today = false): Promise<string> {
  await page.goto("/live/");
  await page.getByLabel("Dein Twitch-Kanal").fill(channel);
  // The daily game, when a test must know the answer and so steer clear of it.
  if (today) await page.getByRole("button", { name: "Heutiges Spiel" }).click();
  await page.getByRole("button", { name: "Runde starten" }).click();
  await page.waitForURL(/\/live\/[^/]+\/$/, { timeout: 20_000 });
  const id = new URL(page.url()).pathname.split("/").filter(Boolean)[1];
  expect(id).toBeTruthy();
  return id;
}

test.describe("Stream-Chat-Modus", () => {
  test("nach einem abgelehnten Wort des Hosts kommen die Chat-Wörter wieder nach oben", async ({
    page,
    request,
  }) => {
    const channel = freshChannel();
    const roomId = await openRoom(page, channel, true);
    // A word that is not the answer: the answer would end the round and stand
    // a third time on the page, as the solved word.
    const { word: answer } = await (await request.get("/api/reveal")).json();
    const chatWord = ["birne", "kirsche"].find((w) => w !== answer)!;
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });

    const input = page.getByPlaceholder("Wort eingeben...").first();
    await input.fill("qxzvbnmw");
    await input.press("Enter");
    const refusal = page.getByText("Dieses Wort kenne ich leider nicht");
    await expect(refusal).toBeVisible({ timeout: 20_000 });

    await sendChatMessage(page, roomId, "51", chatWord);
    // The refusal holds for a moment so it can be read, then the chat's word
    // takes the slot above the list: once there, once in the list.
    await expect(refusal).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText(chatWord, { exact: true })).toHaveCount(2);
  });

  test("der Streamer beendet mit stop im eigenen Chat die Runde", async ({ page }) => {
    const channel = freshChannel();
    const roomId = await openRoom(page, channel);
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });

    // Locked out: the same link without the host token says how to get free.
    await page.evaluate((id) => localStorage.removeItem(`kontexto_koop_${id}`), roomId);
    await page.reload();
    await expect(page.getByText(/Ist das deine Runde/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/„stop“ in deinen eigenen Chat/)).toBeVisible();

    // The form refuses the busy channel and says the same.
    await page.goto("/live/");
    await page.getByLabel("Dein Twitch-Kanal").fill(channel);
    await page.getByRole("button", { name: "Runde starten" }).click();
    await expect(page.getByText(/läuft schon eine Runde\. Schreib „stop“/)).toBeVisible({
      timeout: 20_000,
    });

    // A viewer typing stop has no authority over the round.
    await sendChatMessage(page, roomId, "61", "stop", undefined, "jemand");
    await page.getByRole("button", { name: "Runde starten" }).click();
    await expect(page.getByText(/läuft schon eine Runde/)).toBeVisible();

    // The streamer's own stop frees the channel, and the form goes through.
    await sendChatMessage(page, roomId, "62", "Stop", undefined, channel);
    await page.getByRole("button", { name: "Runde starten" }).click();
    await page.waitForURL(/\/live\/[^/]+\/$/, { timeout: 20_000 });
    const fresh = new URL(page.url()).pathname.split("/").filter(Boolean)[1];
    expect(fresh).not.toBe(roomId);
  });

  test("der Chat rät mit, mit Plattform und Abzeichen am Namen", async ({ page }) => {
    const channel = freshChannel();
    const roomId = await openRoom(page, channel);

    // The host sees which channel is being read.
    // The sidebar is in the markup twice, once per breakpoint, and exactly one
    // of the two is visible at any width. Filtering on that is what makes this
    // assertion mean "the host can see it" rather than "it exists somewhere".
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });

    await sendChatMessage(page, roomId, "Mara42", "apfel", undefined, undefined, "moderator/1,vip/1");

    // The guess lands on the shared board under the viewer's chat name.
    await expect(page.getByText("apfel", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
    // With one chat only, the name still carries its platform, and the badges
    // Twitch showed. The e2e backend has no Twitch app, so they are icons.
    // The name sits inside its identity block: logo, badges, name, platform.
    const row = page.getByText("Mara42", { exact: true }).first().locator("..");
    await expect(row.locator('img[src="/brands/twitch.svg"]')).toBeAttached();
    await expect(row.getByText("auf Twitch")).toBeAttached();
    await expect(row.locator('[title="Moderator"]')).toBeAttached();
    await expect(row.locator('[title="VIP"]')).toBeAttached();
  });

  test("Bits, Abos und Geschenke werden gefeiert und gelistet", async ({ page }) => {
    const channel = freshChannel();
    const roomId = await openRoom(page, channel);
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });

    await sendPaidEvent(page, roomId, {
      kind: "gift_bomb", event_id: `b-${roomId}`, display_name: "Lena", amount: 5,
    });
    const toasts = page.getByTestId("live-support-toast");
    const bomb = toasts.filter({ hasText: "Lena" });
    await expect(bomb).toBeVisible({ timeout: 20_000 });
    await expect(bomb).toHaveAttribute("data-level", "big");
    await expect(bomb).toContainText("verschenkt 5 Abos");

    // The toast stands at the bottom centre, never over the middle of the board.
    const viewport = page.viewportSize();
    const box = await bomb.boundingBox();
    if (!viewport || !box) throw new Error("no layout");
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
    expect(box.y).toBeGreaterThan(viewport.height / 2);

    // The feed lists it, and a duplicate of the same event changes nothing.
    const feed = page.getByTestId("support-feed").filter({ visible: true });
    await expect(feed).toContainText("verschenkt 5 Abos");
    const again = await page.request.post(`/api/live/${roomId}/debug-event`, {
      data: { kind: "gift_bomb", event_id: `b-${roomId}`, display_name: "Lena", amount: 5 },
    });
    expect((await again.json()).stored).toBe(false);

    // Ten Bits are celebrated too, as a small toast, and it leaves by itself.
    await sendPaidEvent(page, roomId, {
      kind: "cheer", event_id: `c-${roomId}`, display_name: "Tom", amount: 10,
    });
    const cheer = toasts.filter({ hasText: "Tom" });
    await expect(cheer).toBeVisible({ timeout: 20_000 });
    await expect(cheer).toHaveAttribute("data-level", "small");
    await expect(feed).toContainText("hat 10 Bits gespendet");
    await expect(cheer).toHaveCount(0, { timeout: 10_000 });

    // Twenty gifted subs are the loudest level.
    await sendPaidEvent(page, roomId, {
      kind: "gift_bomb", event_id: `e-${roomId}`, display_name: "Ida", amount: 20,
    });
    await expect(toasts.filter({ hasText: "Ida" })).toHaveAttribute("data-level", "epic", {
      timeout: 20_000,
    });

    // Paid support never touches the round.
    await expect(page.getByText("Versuche:").filter({ visible: true })).toContainText("0");
  });

  test("das Brett steht mittig, die Seitenleiste verschiebt es nicht", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const channel = freshChannel();
    await openRoom(page, channel);
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });
    const board = await page.getByTestId("koop-board").boundingBox();
    if (!board) throw new Error("no board");
    expect(Math.abs(board.x + board.width / 2 - 720)).toBeLessThanOrEqual(2);
    // The sidebar is beside it, right of the board.
    const side = await page.getByText("Unterstützung", { exact: true }).filter({ visible: true }).boundingBox();
    if (!side) throw new Error("no sidebar");
    expect(side.x).toBeGreaterThan(board.x + board.width);
  });

  test("bei reduzierter Bewegung kommt der Toast ohne Konfetti", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const channel = freshChannel();
    const roomId = await openRoom(page, channel);
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });
    await sendPaidEvent(page, roomId, {
      kind: "gift_bomb", event_id: `r-${roomId}`, display_name: "Ruhig", amount: 20,
    });
    await expect(page.getByTestId("live-support-toast")).toContainText("verschenkt 20 Abos", {
      timeout: 20_000,
    });
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("der Finder steht groß da, und die Bestenliste hat drei Ansichten", async ({
    page,
    request,
  }) => {
    const channel = freshChannel();
    await page.goto("/live/");
    await page.getByLabel("Dein Twitch-Kanal").fill(channel);
    await page.getByRole("button", { name: "Heutiges Spiel" }).click();
    await page.getByRole("button", { name: "Runde starten" }).click();
    await page.waitForURL(/\/live\/[^/]+\/$/, { timeout: 20_000 });
    const roomId = new URL(page.url()).pathname.split("/").filter(Boolean)[1];
    const { word } = await (await request.get("/api/reveal")).json();

    await sendChatMessage(page, roomId, "Finja77", word, undefined, undefined, "subscriber/12");
    const finder = page.getByTestId("live-finder");
    await expect(finder).toBeVisible({ timeout: 20_000 });
    await expect(finder).toContainText("Gefunden von");
    await expect(finder).toContainText("Finja77");
    await expect(finder.locator('img[src="/brands/twitch.svg"]')).toBeAttached();

    // The finder tops the "Wortfinder" board.
    await page.getByRole("tab", { name: "Wortfinder" }).filter({ visible: true }).click();
    await expect(page.getByTestId("board-finders").filter({ visible: true })).toContainText("Finja77", {
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
    // The chats are toggles; Twitch is ticked by default and goes off here.
    const twitch = page.getByRole("button", { name: "Twitch" });
    await twitch.click();
    await expect(twitch).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByLabel("Dein Twitch-Kanal")).toHaveCount(0);

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
    await page.getByRole("button", { name: "Twitch" }).click();
    await page.getByLabel("Dein TikTok-Name").fill("endet.");
    await expect(page.getByText(/kein TikTok-Name/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Runde starten" })).toBeDisabled();
  });

  test("Twitch und TikTok raten zugleich auf einem Brett", async ({ page }) => {
    const channel = freshChannel();
    const handle = `tt.${Date.now().toString().slice(-8)}`;
    await page.goto("/live/");
    const tiktok = page.getByRole("button", { name: "TikTok" });
    await expect(tiktok).toBeEnabled({ timeout: 20_000 });
    await tiktok.click();
    await page.getByLabel("Dein Twitch-Kanal").fill(channel);
    // One ticked chat still empty keeps the room closed.
    await expect(page.getByRole("button", { name: "Runde starten" })).toBeDisabled();
    await page.getByLabel("Dein TikTok-Name").fill(`@${handle}`);
    await page.getByRole("button", { name: "Runde starten" }).click();
    await page.waitForURL(/\/live\/[^/]+\/$/, { timeout: 20_000 });
    const roomId = new URL(page.url()).pathname.split("/").filter(Boolean)[1];

    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(`@${handle}`, { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(page.getByText("Beide Chats raten mit", { exact: false }).filter({ visible: true }))
      .toBeVisible();

    await sendChatMessage(page, roomId, "11", "apfel", "twitch");
    await sendChatMessage(page, roomId, "tt:12", "birne", "tiktok");
    await expect(page.getByText("apfel", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("birne", { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    // Each name carries its chat, as a logo for the eye and as words for a reader.
    await expect(page.locator(`img[src="/brands/twitch.svg"]`).first()).toBeAttached();
    await expect(page.locator(`img[src="/brands/tiktok.png"]`).first()).toBeAttached();
    await expect(page.getByText("auf TikTok").first()).toBeAttached();
  });

  test("ein Chat wird pausiert, dazugenommen und getrennt", async ({ page }) => {
    const channel = freshChannel();
    const handle = `tt.${Date.now().toString().slice(-8)}`;
    const roomId = await openRoom(page, channel);
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });

    // A room with one chat offers no "Trennen": it always reads at least one.
    await expect(page.getByRole("button", { name: /Trennen/ }).filter({ visible: true })).toHaveCount(0);

    // TikTok joins the running round.
    const field = page.getByLabel("Dein TikTok-Name").filter({ visible: true });
    await expect(field).toBeVisible({ timeout: 20_000 });
    await field.fill(`@${handle}`);
    await page.getByRole("button", { name: "Verbinden" }).filter({ visible: true }).click();
    await expect(
      page.getByText(`@${handle}`, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });

    // Paused, TikTok lines do not land, Twitch lines still do.
    await page.getByRole("button", { name: /Pausieren \(TikTok\)/ }).filter({ visible: true }).click();
    await expect(page.getByText(/Pausiert\./).filter({ visible: true })).toBeVisible({
      timeout: 20_000,
    });
    // The ingest learns of the pause on its next pass; the seam forces one.
    await sendChatMessage(page, roomId, "tt:21", "kirsche", "tiktok");
    await sendChatMessage(page, roomId, "22", "apfel", "twitch");
    await expect(page.getByText("apfel", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("kirsche", { exact: true })).toHaveCount(0);

    // Resumed by the host, it counts again.
    await page.getByRole("button", { name: /Fortsetzen \(TikTok\)/ }).filter({ visible: true }).click();
    await expect(page.getByText(/Pausiert\./).filter({ visible: true })).toHaveCount(0, {
      timeout: 20_000,
    });
    await sendChatMessage(page, roomId, "tt:23", "kirsche", "tiktok");
    await expect(page.getByText("kirsche", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Twitch goes, TikTok stays and is now the only chat.
    await page.getByRole("button", { name: /Trennen \(Twitch\)/ }).filter({ visible: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Trennen" }).click();
    // Twitch is on offer again, and the last chat cannot be removed.
    await expect(page.getByText("Twitch dazunehmen").filter({ visible: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /Trennen/ }).filter({ visible: true })).toHaveCount(0);
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

    // It leaves by itself after five seconds, without a click, and a pointer
    // resting on it does not hold it: that pause kept it up in production.
    await banner.hover();
    await expect(banner).toHaveCount(0, { timeout: 7_000 });

    // Shown once: the confirmation took it off the server's list.
    const token = await page.evaluate(
      (id) => localStorage.getItem(`kontexto_koop_${id}`),
      roomId
    );
    const state = await page.request.get(
      `/api/live/${roomId}?token=${encodeURIComponent(token!)}`
    );
    expect((await state.json()).messages).toEqual([]);
  });

  test("eine beendete Runde sagt es dem Streamer", async ({ page }) => {
    const channel = freshChannel();
    const roomId = await openRoom(page, channel);
    await expect(
      page.getByText(channel, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });


    // The admin route needs a passkey session; the host's own stop is the
    // same unbinding and is what reaches the page the same way.
    const token = await page.evaluate(
      (id) => localStorage.getItem(`kontexto_koop_${id}`),
      roomId
    );
    const res = await page.request.post(`/api/live/${roomId}/stop`, {
      data: { player_token: token },
    });
    expect(res.ok()).toBe(true);

    await expect(
      page.getByText(/Stream-Runde wurde beendet/).filter({ visible: true })
    ).toBeVisible({ timeout: 20_000 });
    // The board stays, so the word can still be revealed there.
    await expect(page.getByPlaceholder("Wort eingeben...").first()).toBeVisible();
  });
});
