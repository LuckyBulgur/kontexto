import { describe, expect, it } from "vitest";

import { formatStamp } from "./format";

describe("formatStamp", () => {
  it("shows a UTC instant just after Berlin midnight on the new local day", () => {
    expect(formatStamp("2026-09-23T22:10:00+00:00")).toBe("24.09.2026, 00:10 Uhr");
  });

  it("follows winter time", () => {
    expect(formatStamp("2026-01-14T23:30:00.123456+00:00")).toBe("15.01.2026, 00:30 Uhr");
  });

  it("does not invent a date for garbage", () => {
    expect(formatStamp("not a date")).toBe("k. A.");
  });
});
