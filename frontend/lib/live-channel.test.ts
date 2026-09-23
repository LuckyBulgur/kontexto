import { describe, expect, it } from "vitest";
import { channelAddress, channelLabel, normaliseChannel } from "./live-channel";

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
