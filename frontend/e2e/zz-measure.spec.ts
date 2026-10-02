// verify-language-fixture: throwaway measurement
import { test } from "./fixtures";
test("measure header", async ({ page }) => {
  await page.goto("/live/");
  await page.getByLabel("Dein Twitch-Kanal").fill(`m${Date.now().toString().slice(-8)}`);
  await page.getByRole("button", { name: "Runde starten" }).click();
  await page.waitForURL(/\/live\/[^/]+\/$/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Mitspiel-Link kopieren" }).waitFor({ timeout: 20_000 });
  for (const w of [390, 360]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const wide = [...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)
        .slice(0, 6)
        .map((e) => `${e.tagName}.${(e.className || "").toString().slice(0, 60)} r=${Math.round(e.getBoundingClientRect().right)}`);
      const h = document.querySelector("header > div");
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        parts: h ? [...h.children].map((c) => Math.round(c.getBoundingClientRect().width)) : [], wide };
    });
    console.log(w, JSON.stringify(r));
  }
});
