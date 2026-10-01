import { describe, expect, it } from "vitest";
import {
  BANNER_UNITS,
  BIG_UNITS,
  FEED_LENGTH,
  celebrationOf,
  eventAction,
  eventDetail,
  eventSentence,
  eventUnits,
  freshEvents,
  mergeFeed,
} from "./live-events";
import type { LiveEvent } from "./live-types";

function event(fields: Partial<LiveEvent>): LiveEvent {
  return {
    id: 1,
    platform: "twitch",
    kind: "cheer",
    actor: "Mara",
    badges: [],
    amount: 100,
    tier: null,
    months: null,
    gift_name: null,
    gift_count: null,
    gift_image: null,
    created_at: null,
    ...fields,
  };
}

describe("what an event is worth", () => {
  it("prices both platforms on one scale", () => {
    expect(eventUnits(event({ kind: "cheer", amount: 100 }))).toBe(1);
    expect(eventUnits(event({ kind: "tiktok_gift", amount: 100 }))).toBe(1);
    expect(eventUnits(event({ kind: "sub", tier: "prime" }))).toBe(5);
    expect(eventUnits(event({ kind: "resub", tier: "3000" }))).toBe(25);
    expect(eventUnits(event({ kind: "gift_bomb", amount: 10, tier: "1000" }))).toBe(50);
  });

  it("keeps small things in the feed and makes big things loud", () => {
    expect(celebrationOf(event({ kind: "tiktok_gift", amount: 1 }))).toBe("feed");
    expect(celebrationOf(event({ kind: "cheer", amount: 50 }))).toBe("feed");
    expect(celebrationOf(event({ kind: "cheer", amount: BANNER_UNITS * 100 }))).toBe("banner");
    expect(celebrationOf(event({ kind: "sub", tier: "1000" }))).toBe("banner");
    expect(celebrationOf(event({ kind: "cheer", amount: BIG_UNITS * 100 }))).toBe("big");
    expect(celebrationOf(event({ kind: "gift_bomb", amount: 5 }))).toBe("big");
  });
});

// Built from code points so this file does not carry the characters it forbids.
const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2015)}]`);

describe("what an event says", () => {
  it.each<[Partial<LiveEvent>, string]>([
    [{ kind: "cheer", amount: 1 }, "hat 1 Bit gespendet"],
    [{ kind: "cheer", amount: 1500 }, "hat 1.500 Bits gespendet"],
    [{ kind: "sub", tier: "prime" }, "hat mit Prime abonniert"],
    [{ kind: "sub", tier: "2000" }, "hat abonniert (Stufe 2)"],
    [{ kind: "resub", months: 14, tier: "1000" }, "abonniert seit 14 Monaten"],
    [{ kind: "gift_sub", tier: "1000" }, "verschenkt ein Abo"],
    [{ kind: "gift_bomb", amount: 1 }, "verschenkt ein Abo"],
    [{ kind: "gift_bomb", amount: 10, tier: "3000" }, "verschenkt 10 Abos (Stufe 3)"],
    [{ kind: "upgrade" }, "verlängert das Abo"],
    [{ kind: "tiktok_gift", gift_name: "Rose", gift_count: 5, amount: 5 }, "schickt 5-mal Rose"],
    [{ kind: "tiktok_gift", gift_name: "Löwe", gift_count: 1, amount: 29999 }, "schickt Löwe"],
    [{ kind: "tiktok_gift", amount: 3 }, "schickt Geschenk"],
    [{ kind: "tiktok_sub", months: 1 }, "hat abonniert"],
    [{ kind: "tiktok_chest", amount: 200 }, "verteilt eine Schatztruhe mit 200 Diamanten"],
  ])("%o", (fields, sentence) => {
    expect(eventAction(event(fields))).toBe(sentence);
  });

  it("names the diamonds of a gift on a line of its own", () => {
    expect(eventDetail(event({ kind: "tiktok_gift", amount: 1 }))).toBe("1 Diamant");
    expect(eventDetail(event({ kind: "tiktok_gift", amount: 29999 }))).toBe("29.999 Diamanten");
    expect(eventDetail(event({ kind: "cheer" }))).toBeNull();
  });

  it("puts the name first", () => {
    expect(eventSentence(event({ actor: "Anonym", kind: "gift_bomb", amount: 3 }))).toBe(
      "Anonym verschenkt 3 Abos"
    );
  });

  it("follows the house typography", () => {
    const kinds: Partial<LiveEvent>[] = [
      { kind: "cheer" }, { kind: "sub" }, { kind: "resub", months: 3 }, { kind: "gift_sub" },
      { kind: "gift_bomb", amount: 4 }, { kind: "upgrade" }, { kind: "tiktok_gift" },
      { kind: "tiktok_sub" }, { kind: "tiktok_chest" },
    ];
    for (const fields of kinds) {
      const text = eventSentence(event(fields));
      expect(text).not.toMatch(LONG_DASHES);
      expect(text).not.toMatch(/!/);
    }
  });
});

describe("the feed", () => {
  it("takes only what is new, oldest first", () => {
    const events = [event({ id: 3 }), event({ id: 1 }), event({ id: 2 })];
    expect(freshEvents(events, 1).map((e) => e.id)).toEqual([2, 3]);
  });

  it("merges newest first, without duplicates, and caps", () => {
    const feed = mergeFeed([event({ id: 2 }), event({ id: 1 })], [event({ id: 3 }), event({ id: 2 })]);
    expect(feed.map((e) => e.id)).toEqual([3, 2, 1]);
    const many = Array.from({ length: FEED_LENGTH + 5 }, (_, i) => event({ id: i + 1 }));
    const capped = mergeFeed([], many);
    expect(capped).toHaveLength(FEED_LENGTH);
    expect(capped[0].id).toBe(FEED_LENGTH + 5);
  });
});
