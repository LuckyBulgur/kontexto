// verify-language-fixture: the selectors quote the German UI they drive.
import { test, expect } from "@playwright/test";

/**
 * The picker on a phone.
 *
 * The dialog carries three tabs, five to six rows and a live figure that
 * arrives a moment late, which is a lot of moving parts for 320 pixels. This
 * walks every tab at four widths and asserts the three ways it could go wrong:
 * the dialog leaving the viewport, a tab label clipped inside its column, and
 * the page behind it gaining a sideways scroll.
 */
const WIDTHS = [320, 360, 390, 430];
const TABS = ["Allein", "Mit Freunden", "Gegen Fremde"];

for (const width of WIDTHS) {
  test(`Der Modus-Waehler passt bei ${width} Pixeln`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/");
    await page.getByRole("button", { name: "Spielmodi" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    for (const tab of TABS) {
      await dialog.getByRole("tab", { name: tab }).click();
      await page.waitForTimeout(250);

      // The dialog stays inside the viewport.
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);

      // No tab label runs out of its column.
      const clipped = await dialog.getByRole("tab").evaluateAll((nodes) =>
        nodes.filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent)
      );
      expect(clipped).toEqual([]);

      // The page behind it never scrolls sideways.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
    // A picture for the eye that the assertions above cannot replace.
    await page.screenshot({ path: `.checks/mode-picker-${width}.png` });
  });
}
