import { describe, expect, it } from "vitest";
import { CHANNEL_BUSY_COPY } from "./live-copy";
import { busyChannelOf, CHANNEL_POLL_MS, CHANNEL_WAIT_MS, waitExpired } from "./channel-busy";

const twitch = { platform: "twitch" as const, channel: "kontexto" };
const tiktok = { platform: "tiktok" as const, channel: "kontexto.de" };

describe("busyChannelOf", () => {
  it("takes the chat the refusal names", () => {
    expect(busyChannelOf("tiktok", [twitch, tiktok])).toEqual(tiktok);
    expect(busyChannelOf("twitch", [twitch, tiktok])).toEqual(twitch);
  });

  it("takes the only chat when the refusal names none", () => {
    expect(busyChannelOf(null, [tiktok])).toEqual(tiktok);
  });

  it("guesses nothing when the refusal names none and there are two", () => {
    expect(busyChannelOf(null, [twitch, tiktok])).toBeNull();
  });

  it("finds nothing for a platform that is not in the form", () => {
    expect(busyChannelOf("tiktok", [twitch])).toBeNull();
    expect(busyChannelOf("twitch", null)).toBeNull();
    expect(busyChannelOf("twitch", [])).toBeNull();
  });
});

describe("the wait", () => {
  it("outlasts the five minutes after which a closed host page frees the channel", () => {
    expect(CHANNEL_WAIT_MS).toBeGreaterThan(5 * 60 * 1000 + 30 * 1000);
    expect(CHANNEL_POLL_MS).toBeLessThanOrEqual(5000);
  });

  it("runs out exactly at its length", () => {
    expect(waitExpired(1000, 1000 + CHANNEL_WAIT_MS - 1)).toBe(false);
    expect(waitExpired(1000, 1000 + CHANNEL_WAIT_MS)).toBe(true);
  });
});

describe("the copy", () => {
  it("names the word the backend reads as a stop", () => {
    // backend/live_chat.is_stop_command accepts stop, stopp, !stop and !k stop.
    expect(CHANNEL_BUSY_COPY.word).toBe("stop");
    expect(CHANNEL_BUSY_COPY.waiting).toContain("„stop“");
  });
});
