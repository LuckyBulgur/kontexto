import { describe, expect, it } from "vitest";
import {
  BANNER_UNITS,
  BIG_UNITS,
  EPIC_UNITS,
  FEED_LENGTH,
  FOLLOW_SINGLE_BACKLOG,
  HURRIED_TOAST_MS,
  HURRY_BACKLOG,
  MAX_WAITING_TOASTS,
  TOAST_MS,
  admitToast,
  activityKindOf,
  mergeLatestActivity,
  bitsColor,
  celebrationOf,
  celebrationStyle,
  eventActionParts,
  eventAction,
  eventDetail,
  eventSentence,
  eventUnits,
  followAction,
  freshEvents,
  isFreeEvent,
  mergeFeed,
  queuedToastMs,
  rainParticles,
  takeFollowToast,
  type Celebration,
  type ToastLevel,
} from "./live-events";
import type { LiveEvent, LiveEventKind } from "./live-types";

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

  it("celebrates every event, louder the more it cost", () => {
    expect(celebrationOf(event({ kind: "tiktok_gift", amount: 1 }))).toBe("small");
    expect(celebrationOf(event({ kind: "cheer", amount: 1 }))).toBe("small");
    expect(celebrationOf(event({ kind: "cheer", amount: 99 }))).toBe("small");
    expect(celebrationOf(event({ kind: "cheer", amount: BANNER_UNITS * 100 }))).toBe("banner");
    expect(celebrationOf(event({ kind: "sub", tier: "1000" }))).toBe("banner");
    expect(celebrationOf(event({ kind: "cheer", amount: BIG_UNITS * 100 - 1 }))).toBe("banner");
    expect(celebrationOf(event({ kind: "cheer", amount: BIG_UNITS * 100 }))).toBe("big");
    expect(celebrationOf(event({ kind: "gift_bomb", amount: 5 }))).toBe("big");
    expect(celebrationOf(event({ kind: "sub", tier: "3000" }))).toBe("big");
    expect(celebrationOf(event({ kind: "cheer", amount: EPIC_UNITS * 100 - 1 }))).toBe("big");
    expect(celebrationOf(event({ kind: "cheer", amount: EPIC_UNITS * 100 }))).toBe("epic");
    expect(celebrationOf(event({ kind: "gift_bomb", amount: 20 }))).toBe("epic");
    expect(celebrationOf(event({ kind: "tiktok_gift", amount: 29999 }))).toBe("epic");
  });
});

describe("how an event looks", () => {
  it.each<[number, string]>([
    [1, "#979797"],
    [99, "#979797"],
    [100, "#9c3ee8"],
    [999, "#9c3ee8"],
    [1000, "#1db2a5"],
    [4999, "#1db2a5"],
    [5000, "#0099fe"],
    [9999, "#0099fe"],
    [10000, "#f43021"],
  ])("colours %i Bits like Twitch's gem", (bits, color) => {
    expect(bitsColor(bits)).toBe(color);
    expect(celebrationStyle(event({ kind: "cheer", amount: bits })).colors[0]).toBe(color);
  });

  it("gives every category its own look", () => {
    expect(celebrationStyle(event({ kind: "cheer" }))).toMatchObject({ shape: "gem", icon: "gem" });
    expect(celebrationStyle(event({ kind: "sub" }))).toMatchObject({ shape: "star", icon: "star", rain: false });
    expect(celebrationStyle(event({ kind: "gift_sub" }))).toMatchObject({ icon: "gift", rain: false });
    expect(celebrationStyle(event({ kind: "gift_bomb", amount: 5 }))).toMatchObject({ icon: "gift", rain: true });
    expect(celebrationStyle(event({ kind: "gift_bomb", amount: 1 })).rain).toBe(false);
    expect(celebrationStyle(event({ kind: "tiktok_gift" }))).toMatchObject({ shape: "diamond", icon: "gift" });
    expect(celebrationStyle(event({ kind: "tiktok_sub" }))).toMatchObject({ shape: "star", icon: "star" });
    expect(celebrationStyle(event({ kind: "tiktok_chest" }))).toMatchObject({ shape: "coin", icon: "coins", rain: true });
  });

  it("adds gold to a Tier 3 sub only", () => {
    expect(celebrationStyle(event({ kind: "sub", tier: "3000" })).colors).toContain("#f5b700");
    expect(celebrationStyle(event({ kind: "sub", tier: "1000" })).colors).not.toContain("#f5b700");
  });

  it("rains more stars for more gifts, capped", () => {
    expect(rainParticles(event({ kind: "gift_bomb", amount: 5 }))).toBe(60);
    expect(rainParticles(event({ kind: "gift_bomb", amount: 100 }))).toBe(160);
  });
});

describe("the toast queue", () => {
  const toast = (id: number, level: Celebration) => ({ id, level });

  it("holds at most MAX_WAITING_TOASTS", () => {
    let queue: { id: number; level: Celebration }[] = [];
    for (let id = 1; id <= 30; id++) queue = admitToast(queue, toast(id, "small"));
    expect(queue).toHaveLength(MAX_WAITING_TOASTS);
    expect(queue[queue.length - 1].id).toBe(30);
  });

  it("lets a small toast give way before a large one", () => {
    const queue = [toast(1, "epic"), toast(2, "small"), toast(3, "small")];
    expect(admitToast(queue, toast(4, "small"), 3).map((t) => t.id)).toEqual([1, 3, 4]);
    const roses = [1, 2, 3, 4, 5].reduce((acc, id) => admitToast(acc, toast(id + 10, "small"), 3), queue);
    expect(roses[0].id).toBe(1);
  });

  it("drops the oldest when all are large", () => {
    const queue = [toast(1, "big"), toast(2, "epic"), toast(3, "banner")];
    expect(admitToast(queue, toast(4, "small"), 3).map((t) => t.id)).toEqual([2, 3, 4]);
  });

  it("lets a follow give way before any paid toast", () => {
    const queue: { id: number; level: ToastLevel }[] = [
      { id: 1, level: "small" }, { id: 2, level: "follow" }, { id: 3, level: "small" },
    ];
    expect(admitToast(queue, toast(4, "small"), 3).map((t) => t.id)).toEqual([1, 3, 4]);
  });

  it("plays a short queue in full and hurries a long one", () => {
    expect(queuedToastMs(TOAST_MS.epic, HURRY_BACKLOG - 1)).toBe(TOAST_MS.epic);
    expect(queuedToastMs(TOAST_MS.epic, HURRY_BACKLOG)).toBe(Math.round(TOAST_MS.epic * 0.6));
    // Never shorter than a name takes to read, and never longer than in full.
    expect(queuedToastMs(TOAST_MS.small, 20)).toBe(HURRIED_TOAST_MS);
    expect(queuedToastMs(1000, 20)).toBe(1000);
  });
});

describe("follows", () => {
  const follow = (id: number, actor = `Fan${id}`) =>
    event({ id, kind: "tiktok_follow", platform: "tiktok", actor, amount: 1 });

  it("is free: no units, no feed row", () => {
    expect(isFreeEvent(follow(1))).toBe(true);
    expect(isFreeEvent(event({ kind: "tiktok_gift" }))).toBe(false);
    expect(eventUnits(follow(1))).toBe(0);
    expect(mergeFeed([event({ id: 1 })], [follow(2), event({ id: 3 })]).map((e) => e.id)).toEqual([3, 1]);
  });

  it("goes one by one while the queue is short", () => {
    const queue = [follow(1), follow(2)];
    const first = takeFollowToast(queue);
    expect(first?.toast).toMatchObject({ id: 1, actor: "Fan1", others: 0 });
    expect(first?.rest.map((e) => e.id)).toEqual([2]);
    expect(takeFollowToast([])).toBeNull();
  });

  it("folds a long queue into one toast", () => {
    const queue = Array.from({ length: FOLLOW_SINGLE_BACKLOG + 6 }, (_, i) => follow(i + 1));
    const taken = takeFollowToast(queue);
    expect(taken?.toast).toMatchObject({ id: queue.length, actor: "Fan1", others: queue.length - 1 });
    expect(taken?.rest).toEqual([]);
  });

  it("says it in one sentence", () => {
    expect(followAction(0)).toBe("folgt jetzt");
    expect(followAction(1)).toBe("und 1 weitere Person folgen jetzt");
    expect(followAction(1200)).toBe("und 1.200 weitere folgen jetzt");
    expect(eventAction(follow(1))).toBe("folgt jetzt");
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

  it("splits around the number, so a toast can count it up", () => {
    expect(eventActionParts(event({ kind: "cheer", amount: 2500 }))).toEqual({
      before: "hat ", value: 2500, after: " Bits gespendet",
    });
    expect(eventActionParts(event({ kind: "gift_bomb", amount: 10, tier: "3000" }))).toEqual({
      before: "verschenkt ", value: 10, after: " Abos (Stufe 3)",
    });
    expect(eventActionParts(event({ kind: "upgrade" })).value).toBeNull();
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
      { kind: "tiktok_sub" }, { kind: "tiktok_chest" }, { kind: "tiktok_follow" },
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

describe("latest activity", () => {
  it.each<[LiveEventKind, string]>([
    ["tiktok_follow", "follow"],
    ["cheer", "donation"],
    ["tiktok_gift", "donation"],
    ["tiktok_chest", "donation"],
    ["sub", "sub"],
    ["resub", "sub"],
    ["gift_sub", "sub"],
    ["gift_bomb", "sub"],
    ["upgrade", "sub"],
    ["tiktok_sub", "sub"],
  ])("files %s under %s", (kind, slot) => {
    expect(activityKindOf(kind)).toBe(slot);
  });

  it("keeps the newest event per slot", () => {
    const latest = mergeLatestActivity({}, [
      event({ id: 1, kind: "cheer", actor: "Alt" }),
      event({ id: 2, kind: "sub", actor: "Abo" }),
      event({ id: 3, kind: "tiktok_gift", platform: "tiktok", actor: "Neu" }),
    ]);
    expect(latest.donation?.actor).toBe("Neu");
    expect(latest.sub?.actor).toBe("Abo");
    expect(latest.follow).toBeUndefined();
  });

  it("ignores an older event and is idempotent", () => {
    const newer = event({ id: 9, kind: "sub", actor: "Neu" });
    const latest = mergeLatestActivity({}, [newer]);
    expect(mergeLatestActivity(latest, [event({ id: 4, kind: "resub", actor: "Alt" })])).toBe(latest);
    expect(mergeLatestActivity(latest, [newer])).toBe(latest);
    expect(mergeLatestActivity(latest, [])).toBe(latest);
  });
});
