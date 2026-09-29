import { describe, expect, it } from "vitest";
import {
  channelAddress,
  channelLabel,
  normaliseChannel,
  readyChannels,
  showsPlatformMarks,
} from "./live-channel";

describe("Twitch channel names", () => {
  it("takes a plain name", () => {
    expect(normaliseChannel("  KontextoDE ", "twitch")).toBe("kontextode");
  });

  it("takes what people actually paste", () => {
    expect(normaliseChannel("https://www.twitch.tv/kontexto", "twitch")).toBe("kontexto");
    expect(normaliseChannel("twitch.tv/kontexto?tt_content=x", "twitch")).toBe("kontexto");
    expect(normaliseChannel("@kontexto", "twitch")).toBe("kontexto");
  });

  it("refuses what Twitch could not have as a login", () => {
    expect(normaliseChannel("", "twitch")).toBeNull();
    expect(normaliseChannel("abc", "twitch")).toBeNull();
    expect(normaliseChannel("hat leerzeichen", "twitch")).toBeNull();
    expect(normaliseChannel("hat-bindestrich", "twitch")).toBeNull();
    expect(normaliseChannel("ä".repeat(6), "twitch")).toBeNull();
    expect(normaliseChannel("x".repeat(26), "twitch")).toBeNull();
    expect(normaliseChannel("mit.punkt", "twitch")).toBeNull();
  });

  // The server keeps the authoritative copy of this rule; if the two disagreed,
  // the form would either promise a name the server refuses or block one it
  // would have taken.
  it("agrees with the server on the boundaries", () => {
    expect(normaliseChannel("abcd", "twitch")).toBe("abcd");
    expect(normaliseChannel("x".repeat(25), "twitch")).toBe("x".repeat(25));
    expect(normaliseChannel("a_1", "twitch")).toBeNull();
  });
});

describe("TikTok channel names", () => {
  it("takes a handle with or without the @", () => {
    expect(normaliseChannel("@Kontexto.DE", "tiktok")).toBe("kontexto.de");
    expect(normaliseChannel("kontexto", "tiktok")).toBe("kontexto");
  });

  it("takes the profile and the live URL", () => {
    expect(normaliseChannel("https://www.tiktok.com/@abc_1", "tiktok")).toBe("abc_1");
    expect(normaliseChannel("https://www.tiktok.com/@abc_1/live?lang=de", "tiktok")).toBe(
      "abc_1"
    );
  });

  it("agrees with the server on the boundaries", () => {
    expect(normaliseChannel("ab", "tiktok")).toBe("ab");
    expect(normaliseChannel("x".repeat(24), "tiktok")).toBe("x".repeat(24));
    expect(normaliseChannel("a", "tiktok")).toBeNull();
    expect(normaliseChannel("x".repeat(25), "tiktok")).toBeNull();
    expect(normaliseChannel("endet.", "tiktok")).toBeNull();
    expect(normaliseChannel("hat leerzeichen", "tiktok")).toBeNull();
  });

  it("is written the way the platform writes it", () => {
    expect(channelAddress("kontexto", "tiktok")).toBe("tiktok.com/@kontexto");
    expect(channelLabel("kontexto", "tiktok")).toBe("@kontexto");
    expect(channelAddress("kontexto", "twitch")).toBe("twitch.tv/kontexto");
    expect(channelLabel("kontexto", "twitch")).toBe("kontexto");
  });
});

describe("platform marks", () => {
  it("stay off while one platform plays", () => {
    expect(showsPlatformMarks([])).toBe(false);
    expect(showsPlatformMarks(["twitch", "twitch", null, undefined])).toBe(false);
  });

  it("come on once two platforms are in play, from any source", () => {
    expect(showsPlatformMarks(["twitch", "tiktok"])).toBe(true);
    // A room back on one chat still shows mixed rows for a while.
    expect(showsPlatformMarks(["twitch", null, "tiktok"])).toBe(true);
  });
});

describe("the chats a create form sends", () => {
  it("needs at least one chat", () => {
    expect(readyChannels([], { twitch: "kontexto" })).toBeNull();
  });

  it("sends every ticked chat, normalised", () => {
    expect(
      readyChannels(["twitch", "tiktok"], {
        twitch: "https://twitch.tv/Kontexto",
        tiktok: "@Kontexto.DE",
      })
    ).toEqual([
      { platform: "twitch", channel: "kontexto" },
      { platform: "tiktok", channel: "kontexto.de" },
    ]);
  });

  it("waits until every ticked field is valid", () => {
    expect(readyChannels(["twitch", "tiktok"], { twitch: "kontexto" })).toBeNull();
    expect(readyChannels(["twitch", "tiktok"], { twitch: "kontexto", tiktok: "endet." })).toBeNull();
  });

  it("ignores a name typed for a platform that is not ticked", () => {
    expect(readyChannels(["tiktok"], { twitch: "kontexto", tiktok: "kontexto" })).toEqual([
      { platform: "tiktok", channel: "kontexto" },
    ]);
  });
});
