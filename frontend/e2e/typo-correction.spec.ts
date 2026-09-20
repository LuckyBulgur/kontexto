import { test, expect } from "./fixtures";

// A mistyped guess should keep the game going instead of being rejected. One
// plausible reading is scored, anything less clear is only offered.
test.describe("typo correction", () => {
  test("an unambiguous typo is scored and named", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();

    // "fahrrda" is a transposition of "fahrrad" with no second candidate.
    await input.fill("fahrrda");
    await input.press("Enter");

    await expect(page.getByText("„fahrrda“ wurde als „fahrrad“ gewertet")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("an ambiguous typo is offered and guessed on click", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox");
    await expect(input).toBeVisible();

    // Four letters: too little evidence to rewrite the input by itself.
    await input.fill("bech");
    await input.press("Enter");

    await expect(page.getByText("Meintest du")).toBeVisible({ timeout: 10_000 });
    const suggestion = page.getByRole("button", { name: "buch", exact: true });
    await expect(suggestion).toBeVisible();

    await suggestion.click();
    await expect(page.getByText("buch", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("a real word is never rewritten", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox");
    await input.fill("fahrrad");
    await input.press("Enter");

    await expect(input).toHaveValue("");
    await expect(page.getByText(/wurde als .+ gewertet/)).toHaveCount(0);
  });
});
