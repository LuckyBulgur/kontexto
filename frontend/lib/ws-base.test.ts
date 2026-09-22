import { afterEach, describe, expect, it, vi } from "vitest";
import { wsBase } from "./ws-base";

/**
 * The socket has to follow the API, not the page.
 *
 * These two disagree exactly once: in `pnpm dev`, where the page is served on
 * :3000 and the backend runs on :8000. Before this, every realtime socket in
 * the project pointed at :3000 there and quietly reconnected forever, which is
 * why a local stream-chat round showed a rising leaderboard and an empty board.
 */

const original = process.env.NEXT_PUBLIC_API_URL;

function pageAt(href: string) {
  const url = new URL(href);
  vi.stubGlobal("window", {
    location: { protocol: url.protocol, host: url.host },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.NEXT_PUBLIC_API_URL = original;
});

describe("wsBase", () => {
  it("follows an absolute API origin, as in local dev", () => {
    pageAt("http://localhost:3000/live/abc/");
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api";
    expect(wsBase()).toBe("ws://localhost:8000/ws");
  });

  it("stays on the page origin when the API is a path, as in production", () => {
    pageAt("https://kontexto.de/koop/abc/");
    process.env.NEXT_PUBLIC_API_URL = "/api";
    expect(wsBase()).toBe("wss://kontexto.de/ws");
  });

  it("stays on the page origin when nothing is configured", () => {
    pageAt("https://kontexto.de/duel/abc/");
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(wsBase()).toBe("wss://kontexto.de/ws");
  });

  it("upgrades to wss for an https API", () => {
    pageAt("https://kontexto.de/arena/abc/");
    process.env.NEXT_PUBLIC_API_URL = "https://api.kontexto.de/api";
    expect(wsBase()).toBe("wss://api.kontexto.de/ws");
  });

  it("falls back to the page origin for a value that is not a URL", () => {
    pageAt("http://localhost:3000/koop/abc/");
    process.env.NEXT_PUBLIC_API_URL = "http://";
    expect(wsBase()).toBe("ws://localhost:3000/ws");
  });

  it("answers with nothing while there is no window", () => {
    vi.stubGlobal("window", undefined);
    expect(wsBase()).toBe("");
  });
});
