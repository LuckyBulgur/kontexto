import { describe, expect, it } from "vitest";
import {
  buildInviteUrl,
  guestTokenKey,
  hasInviteParam,
  hashWithoutInvite,
  INVITE_PARAM,
  type KeyValueStore,
  pendingInviteKey,
  readInviteFromHash,
  readStored,
  writeStored,
} from "./live-invite";

const SECRET = "Ab3_dE-fGh1jKlMnOpQrStUv";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const blocked: KeyValueStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("buildInviteUrl", () => {
  it("puts the secret in the fragment, never in the path or query", () => {
    const url = new URL(buildInviteUrl("https://kontexto.de", "aB3dE9", SECRET));
    expect(url.pathname).toBe("/live/aB3dE9/");
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#${INVITE_PARAM}=${SECRET}`);
  });

  it("reads back what it builds", () => {
    const url = new URL(buildInviteUrl("https://kontexto.de", "aB3dE9", SECRET));
    expect(readInviteFromHash(url.hash)).toBe(SECRET);
  });
});

describe("readInviteFromHash", () => {
  it("takes the secret with or without the leading #", () => {
    expect(readInviteFromHash(`#${INVITE_PARAM}=${SECRET}`)).toBe(SECRET);
    expect(readInviteFromHash(`${INVITE_PARAM}=${SECRET}`)).toBe(SECRET);
  });

  it("finds it next to other parameters", () => {
    expect(readInviteFromHash(`#a=1&${INVITE_PARAM}=${SECRET}&b=2`)).toBe(SECRET);
  });

  it("refuses what the server never hands out", () => {
    expect(readInviteFromHash("")).toBeNull();
    expect(readInviteFromHash("#spielbereich")).toBeNull();
    expect(readInviteFromHash(`#${INVITE_PARAM}=`)).toBeNull();
    expect(readInviteFromHash(`#${INVITE_PARAM}=kurz`)).toBeNull();
    expect(readInviteFromHash(`#${INVITE_PARAM}=${"x".repeat(129)}`)).toBeNull();
    expect(readInviteFromHash(`#${INVITE_PARAM}=<script>alert(1)</script>`)).toBeNull();
  });
});

describe("hashWithoutInvite", () => {
  it("leaves nothing when the invite was all there was", () => {
    expect(hashWithoutInvite(`#${INVITE_PARAM}=${SECRET}`)).toBe("");
  });

  it("keeps the other parameters", () => {
    expect(hashWithoutInvite(`#a=1&${INVITE_PARAM}=${SECRET}`)).toBe("#a=1");
  });

  it("strips a malformed invite too", () => {
    expect(hasInviteParam(`#${INVITE_PARAM}=kurz`)).toBe(true);
    expect(hashWithoutInvite(`#${INVITE_PARAM}=kurz`)).toBe("");
  });

  it("does not see an anchor as an invite", () => {
    expect(hasInviteParam("#spielbereich")).toBe(false);
    expect(hasInviteParam("")).toBe(false);
  });
});

describe("storage keys", () => {
  it("keeps the guest seat apart from the host key the live page reads", () => {
    expect(guestTokenKey("aB3dE9")).not.toBe("kontexto_koop_aB3dE9");
    expect(pendingInviteKey("aB3dE9")).not.toBe(guestTokenKey("aB3dE9"));
  });
});

describe("readStored / writeStored", () => {
  it("round-trips and removes", () => {
    const store = memoryStore();
    writeStored(store, "k", "v");
    expect(readStored(store, "k")).toBe("v");
    writeStored(store, "k", null);
    expect(store.data.has("k")).toBe(false);
  });

  it("survives a store that throws or is missing", () => {
    expect(readStored(blocked, "k")).toBeNull();
    expect(() => writeStored(blocked, "k", "v")).not.toThrow();
    expect(() => writeStored(blocked, "k", null)).not.toThrow();
    expect(readStored(null, "k")).toBeNull();
    expect(() => writeStored(null, "k", "v")).not.toThrow();
  });
});
