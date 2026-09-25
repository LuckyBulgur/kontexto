import { test, expect } from "@playwright/test";

test("Creator-Platz führt vom Tagesrätsel zur geprüften Einreichung", async ({ page }, testInfo) => {
  await page.route("**/api/creator-submissions", async (route) => {
    const body = route.request().postDataJSON();
    if (String(body.clip_url).includes("/shorts/test")) {
      await route.fulfill({ status: 201, contentType: "application/json", body: '{"id":1}' });
    } else {
      await route.continue();
    }
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const entry = page.getByRole("link", { name: /Heute präsentiert von noch niemandem/ });
  await expect(entry).toBeVisible();
  await expect(page.getByText("Spiel:")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("creator-spot-mobile.png") });
  await entry.click();
  await expect(page.getByRole("heading", { name: "Zeig Kontexto in deinem Clip" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("creator-form-mobile.png") });
  await page.locator("#clip_url").fill("https://evil.example/video/123");
  await page.locator("#channel_url").fill("https://www.youtube.com/@creator");
  await page.locator("#channel_name").fill("Creator");
  await page.getByRole("button", { name: "Clip einreichen" }).click();
  await expect(page.locator("form [role=alert]")).toContainText("TikTok, YouTube, Twitch oder Instagram");
  await page.locator("#clip_url").fill(`https://www.youtube.com/shorts/test${Date.now()}`);
  await page.getByRole("button", { name: "Clip einreichen" }).click();
  await expect(page.getByRole("status")).toContainText("Clip eingereicht");
});

test("Freigegebener Kanal bleibt auch nach dem Spiel sichtbar", async ({ page, request }) => {
  await page.route("**/api/creator-spot", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ creator: { platform: "youtube", channel_name: "Wortkanal", channel_url: "https://www.youtube.com/@wortkanal" } }),
  }));
  const { word } = await (await request.get("/api/reveal")).json();
  await page.goto("/");
  const channel = page.getByRole("link", { name: "Wortkanal auf YouTube öffnen" });
  await expect(channel).toHaveAttribute("href", "https://www.youtube.com/@wortkanal");
  await page.getByRole("textbox").fill(word);
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible();
  await expect(channel).toBeVisible();
  await expect(page.locator("#spielbereich").getByRole("link", { name: "Clip einreichen" })).toHaveAttribute("href", "/mitmachen/");
});

for (const [platform, logo] of [
  ["youtube", "youtube.png"],
  ["twitch", "twitch.svg"],
  ["tiktok", "tiktok.png"],
  ["instagram", "instagram-black.svg"],
] as const) {
  test(`${platform}: langer Kanalname lässt Platz für den Antrag`, async ({ page }, testInfo) => {
    const name = "EinSehrLangerKanalnameOhneLeerzeichenDerAufKleinenDisplaysGekuerztWerdenMuss";
    await page.setViewportSize({ width: 320, height: 740 });
    await page.route("**/api/creator-spot", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ creator: { platform, channel_name: name, channel_url: `https://example.com/${platform}` } }),
    }));
    await page.goto("/");
    const channel = page.getByRole("link", { name: `${name} auf ${platform === "tiktok" ? "TikTok" : platform === "youtube" ? "YouTube" : platform === "twitch" ? "Twitch" : "Instagram"} öffnen` });
    const apply = page.locator("#spielbereich").getByRole("link", { name: "Clip einreichen" });
    await expect(channel).toBeVisible();
    await expect(channel.locator("img").first()).toHaveAttribute("src", `/brands/${logo}`);
    await expect(apply).toBeVisible();
    expect(await channel.evaluate((el) => {
      const nameElement = el.querySelector("span");
      return nameElement !== null && nameElement.scrollWidth > nameElement.clientWidth;
    })).toBe(true);
    const bounds = await Promise.all([channel.boundingBox(), apply.boundingBox()]);
    expect(bounds[0] && bounds[1] && bounds[0].x + bounds[0].width <= bounds[1].x).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`creator-${platform}-mobile.png`) });
    if (platform === "youtube") {
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(apply).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("creator-youtube-desktop.png") });
    }
  });
}

test("Creator-Anträge stehen unter den aktuellen Streams", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("kontexto_admin_token", "test-token"));
  await page.route("**/api/admin/stats", (route) => route.fulfill({ json: { monthly: [] } }));
  await page.route("**/api/admin/live", (route) => route.fulfill({ json: { active_now: 0, by_page: {} } }));
  await page.route("**/api/admin/live-streams", (route) => route.fulfill({ json: {
    server_time: "2026-09-25T12:00:00Z",
    streams: [{
      koop_id: "test-stream", platform: "twitch", channel: "Testkanal", chat_state: "live",
      created_at: "2026-09-25T11:00:00Z", last_activity: "2026-09-25T12:00:00Z",
      round: 1, best_rank: null, solved: false, gave_up: false, viewers: 2,
      guesses: 0, recent_guesses: [], messages: [],
    }],
  } }));
  await page.route("**/api/admin/creator-submissions", (route) => route.fulfill({ json: {
    submissions: [], today_submission_id: null,
  } }));
  await page.goto("/admin/stats/#streams");
  const stream = page.getByRole("link", { name: /Testkanal/ });
  const applications = page.getByRole("heading", { name: "Creator-Clips" });
  await expect(stream).toBeVisible();
  await expect(applications).toBeVisible();
  expect((await stream.boundingBox())!.y).toBeLessThan((await applications.boundingBox())!.y);
  await page.screenshot({ path: testInfo.outputPath("creator-admin-under-streams.png") });
  await page.route("**/api/admin/live-streams", (route) => route.fulfill({ json: {
    server_time: "2026-09-25T12:00:00Z", streams: [],
  } }));
  await page.reload();
  const emptyStreams = page.getByText("Gerade läuft kein Stream.");
  await expect(emptyStreams).toBeVisible();
  await expect(applications).toBeVisible();
  expect((await emptyStreams.boundingBox())!.y).toBeLessThan((await applications.boundingBox())!.y);
});
