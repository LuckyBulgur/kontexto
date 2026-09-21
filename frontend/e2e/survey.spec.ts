import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// Attribution survey: a modal opens shortly after the first finished game, takes
// an answer in one click, and never opens for that visitor again.

async function solveDailyGame(page: Page, word: string) {
  await page.goto("/");
  const input = page.getByRole("textbox");
  await expect(input).toBeVisible();
  await input.fill(word);
  await input.press("Enter");
  await expect(
    page.getByRole("heading", { name: word, exact: true }),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("source survey", () => {
  test("asks after a win, accepts one click and stays away afterwards", async ({
    page,
    request,
  }) => {
    const reveal = await request.get("/api/reveal");
    expect(reveal.ok()).toBeTruthy();
    const { word } = await reveal.json();

    await solveDailyGame(page, word);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole("heading", { name: "Woher kennst du Kontexto?" })).toBeVisible();

    // One click sends the answer; the optional free text is the follow-up and
    // must never stand between the visitor and a recorded answer.
    const answer = dialog.getByRole("button", { name: "Reddit" });
    await expect(answer).toBeVisible();
    await answer.click();

    await expect(dialog.getByText("Danke!", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Fertig" }).click();
    await expect(dialog).toBeHidden();

    // The answer is remembered across reloads, so nothing asks again.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: word, exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Woher kennst du Kontexto?")).toBeHidden();
  });

  test("stays hidden while the game is still running", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("textbox")).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("cannot be dismissed with Escape while the question stands", async ({ page, request }) => {
    const reveal = await request.get("/api/reveal");
    const { word } = await reveal.json();
    await solveDailyGame(page, word);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    // The skip button is the way out, and it leaves no answer behind.
    await dialog.getByRole("button", { name: "Überspringen" }).click();
    await expect(dialog).toBeHidden();
  });
});
