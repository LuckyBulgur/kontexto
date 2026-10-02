import { describe, expect, it } from "vitest";
import { FAILURES_FOR_NOTICE, INITIAL_UPDATE_STATE, nextUpdateState, parseVersion, type UpdateState } from "./update-check";

const ok = (build: string) => ({ kind: "ok", build }) as const;
const failed = (online = true) => ({ kind: "failed", online }) as const;

describe("nextUpdateState", () => {
  it("stays idle while the server answers with the same build", () => {
    expect(nextUpdateState(INITIAL_UPDATE_STATE, ok("abc"), "abc")).toEqual(INITIAL_UPDATE_STATE);
  });

  it("reloads as soon as another build answers", () => {
    expect(nextUpdateState(INITIAL_UPDATE_STATE, ok("new"), "old").phase).toBe("reloading");
  });

  it("says an update runs only after repeated failures", () => {
    let state: UpdateState = INITIAL_UPDATE_STATE;
    for (let i = 1; i < FAILURES_FOR_NOTICE; i++) {
      state = nextUpdateState(state, failed(), "old");
      expect(state.phase).toBe("idle");
    }
    state = nextUpdateState(state, failed(), "old");
    expect(state.phase).toBe("updating");
  });

  it("keeps the notice through the outage and reloads on the new build", () => {
    let state: UpdateState = { phase: "updating", failures: 5 };
    state = nextUpdateState(state, failed(), "old");
    expect(state.phase).toBe("updating");
    expect(nextUpdateState(state, ok("new"), "old").phase).toBe("reloading");
  });

  it("drops the notice when the old build answers again, it was a blip", () => {
    expect(nextUpdateState({ phase: "updating", failures: 3 }, ok("old"), "old")).toEqual(INITIAL_UPDATE_STATE);
  });

  it("never blames a deploy for the player's own network", () => {
    let state: UpdateState = INITIAL_UPDATE_STATE;
    for (let i = 0; i < 5; i++) state = nextUpdateState(state, failed(false), "old");
    expect(state.phase).toBe("idle");
  });

  it("does not leave reloading once decided", () => {
    const reloading: UpdateState = { phase: "reloading", failures: 0 };
    expect(nextUpdateState(reloading, ok("old"), "old")).toBe(reloading);
  });
});

describe("parseVersion", () => {
  it("reads the build id", () => {
    expect(parseVersion({ build: "54b8db9" })).toBe("54b8db9");
  });

  it.each([null, "x", {}, { build: "" }, { build: 3 }, { build: "x".repeat(101) }])("refuses %j", (body) => {
    expect(parseVersion(body)).toBeNull();
  });
});
