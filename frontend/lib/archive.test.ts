import { describe, it, expect, vi, beforeEach } from "vitest";

// Reset module registry and cache before each test so the module-level memo is fresh.
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete process.env.KONTEXTO_REQUIRE_ARCHIVE;
});

describe("getArchiveEntries", () => {
  it("maps games and fetches reveals", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          games: [{ gameNumber: 12, date: "2026-06-05" }],
          todayGame: 13,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ word: "meer" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { getArchiveEntries } = await import("./archive");
    const entries = await getArchiveEntries();

    expect(entries[0]).toMatchObject({
      gameNumber: 12,
      date: "2026-06-05",
      word: "meer",
    });
  });

  it("throws when the games API is unreachable and KONTEXTO_REQUIRE_ARCHIVE=1 is set", async () => {
    process.env.KONTEXTO_REQUIRE_ARCHIVE = "1";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const { getArchiveEntries } = await import("./archive");
    await expect(getArchiveEntries()).rejects.toThrow();
  });

  it("resolves to [] when the games API fails and KONTEXTO_REQUIRE_ARCHIVE is not set", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const { getArchiveEntries } = await import("./archive");
    const entries = await getArchiveEntries();

    expect(entries).toEqual([]);
  });
});
