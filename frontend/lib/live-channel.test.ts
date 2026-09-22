import { describe, expect, it } from "vitest";
import { normaliseChannel } from "./live-channel";

describe("channel names", () => {
  it("takes a plain name", () => {
    expect(normaliseChannel("  KontextoDE ")).toBe("kontextode");
  });

  it("takes what people actually paste", () => {
    expect(normaliseChannel("https://www.twitch.tv/kontexto")).toBe("kontexto");
    expect(normaliseChannel("twitch.tv/kontexto?tt_content=x")).toBe("kontexto");
    expect(normaliseChannel("@kontexto")).toBe("kontexto");
  });

  it("refuses what Twitch could not have as a login", () => {
    expect(normaliseChannel("")).toBeNull();
    expect(normaliseChannel("abc")).toBeNull();
    expect(normaliseChannel("hat leerzeichen")).toBeNull();
    expect(normaliseChannel("hat-bindestrich")).toBeNull();
    expect(normaliseChannel("ä".repeat(6))).toBeNull();
    expect(normaliseChannel("x".repeat(26))).toBeNull();
  });

  // The server keeps the authoritative copy of this rule; if the two disagreed,
  // the form would either promise a name the server refuses or block one it
  // would have taken.
  it("agrees with the server on the boundaries", () => {
    expect(normaliseChannel("abcd")).toBe("abcd");
    expect(normaliseChannel("x".repeat(25))).toBe("x".repeat(25));
    expect(normaliseChannel("a_1")).toBeNull();
  });
});
