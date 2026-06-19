import { test, expect } from "@playwright/test";

// Echtzeit-Duell über den WebSocket: der riskanteste, ungetestete Pfad. Prüft
// zugleich, dass der Proxy den /ws-Upgrade korrekt durchreicht (same-origin,
// wie in Produktion via nginx). Zwei isolierte Browser-Kontexte = zwei Spieler.
test.describe("Kontexto-Duell (WebSocket-Echtzeit)", () => {
  test("Gegner erscheint live und sein Fortschritt wird übertragen", async ({
    browser,
    request,
  }) => {
    // 1. Alice erstellt das Duell über die API und erhält ihr Spieler-Token.
    const res = await request.post("/api/duel", {
      data: { game_number: 1, nickname: "Alice", tips_allowed: true },
    });
    expect(res.ok()).toBeTruthy();
    const { duel_id, player_token } = await res.json();

    // 2. Alices Browser: Token injizieren (wie nach einem eigenen Beitritt) und
    //    die Duell-Seite öffnen. Ihr WS verbindet sich daraufhin.
    const aliceCtx = await browser.newContext();
    const alice = await aliceCtx.newPage();
    await alice.addInitScript(
      ([id, token]) => localStorage.setItem(`kontexto_duel_${id}`, token),
      [duel_id, player_token] as const,
    );
    await alice.goto(`/duel/${duel_id}/`);
    await expect(alice.getByText("Alice").first()).toBeAttached();

    // 3. Bob tritt in einem zweiten Kontext über die echte UI bei.
    const bobCtx = await browser.newContext();
    const bob = await bobCtx.newPage();
    await bob.goto(`/duel/${duel_id}/`);
    await bob.getByPlaceholder("Dein Nickname...").fill("Bob");
    await bob.getByRole("button", { name: "Beitreten" }).click();

    // 4. Alice sieht Bob beitreten (WS "player_joined", per Sekunden-Poll).
    await expect(alice.getByText("Bob").first()).toBeAttached({ timeout: 15_000 });

    // 5. Bob rät ein Wort; Alice sieht seinen Fortschritt (WS "rank_update").
    //    guess_count wird zu "1x". toBeAttached (nicht toBeVisible): PlayerBar
    //    rendert Desktop- und Mobil-Variante doppelt, von denen je nach Viewport
    //    welche per CSS versteckt sind. Geprüft wird der WS-Datenpfad — dass das
    //    Update in Alices DOM ankommt —, nicht welcher Klon sichtbar ist.
    const bobInput = bob.getByRole("textbox");
    await bobInput.fill("apfel");
    await bobInput.press("Enter");
    await expect(alice.getByText("1x").first()).toBeAttached({ timeout: 15_000 });

    await aliceCtx.close();
    await bobCtx.close();
  });
});
