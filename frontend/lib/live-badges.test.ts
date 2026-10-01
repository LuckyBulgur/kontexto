import { describe, expect, it } from "vitest";
import { MAX_SHOWN_BADGES, describeBadge, visibleBadges } from "./live-badges";
import type { LiveBadgeCatalog } from "./live-types";

const CATALOG: LiveBadgeCatalog = {
  "subscriber/12": {
    title: "1-Year Subscriber",
    image: "https://static-cdn.jtvnw.net/badges/v1/a/1",
    image_2x: "https://static-cdn.jtvnw.net/badges/v1/a/2",
  },
  "glhf-pledge/1": {
    title: "GLHF Pledge",
    image: "https://static-cdn.jtvnw.net/badges/v1/b/1",
    image_2x: "https://static-cdn.jtvnw.net/badges/v1/b/2",
  },
};

describe("a badge", () => {
  it("uses Twitch's picture and a German name for a known role", () => {
    const view = describeBadge({ set_id: "subscriber", version: "12" }, CATALOG);
    expect(view.title).toBe("Abonnent");
    expect(view.picture?.image).toContain("static-cdn.jtvnw.net");
    expect(view.icon).toBe("subscriber");
  });

  it("keeps Twitch's own title for a badge it has no German name for", () => {
    expect(describeBadge({ set_id: "glhf-pledge", version: "1" }, CATALOG).title).toBe("GLHF Pledge");
  });

  it("falls back to an icon for a known role without a picture", () => {
    const view = describeBadge({ set_id: "moderator", version: "1" }, {});
    expect(view.picture).toBeNull();
    expect(view.icon).toBe("moderator");
  });

  it("draws TikTok roles with icons and names the fan club level", () => {
    const view = describeBadge({ set_id: "tt-fan", version: "7" }, CATALOG);
    expect(view).toMatchObject({ title: "Fanclub, Stufe 7", picture: null, icon: "fan" });
  });
});

describe("the badges in front of a name", () => {
  it("leaves out what cannot be drawn and caps at three", () => {
    const views = visibleBadges(
      [
        { set_id: "broadcaster", version: "1" },
        { set_id: "no-picture-no-icon", version: "1" },
        { set_id: "subscriber", version: "12" },
        { set_id: "glhf-pledge", version: "1" },
        { set_id: "vip", version: "1" },
      ],
      CATALOG
    );
    expect(views.map((v) => v.code)).toEqual(["broadcaster/1", "subscriber/12", "glhf-pledge/1"]);
    expect(views).toHaveLength(MAX_SHOWN_BADGES);
  });

  it("is empty without badges", () => {
    expect(visibleBadges(undefined, CATALOG)).toEqual([]);
  });
});
