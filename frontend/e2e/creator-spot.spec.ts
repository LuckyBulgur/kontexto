import { test, expect } from "@playwright/test";

test("Creator-Platz führt vom Tagesrätsel zur geprüften Einreichung", async ({ page }, testInfo) => {
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
});
