import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EGG_CATALOG } from "./catalog.generated";
import { eggSpellings, matchEgg } from "./match";
import { SCENE_WORDS } from "./scenes";
import { EGG_MOTIONS, SYNTH_SOUNDS, type EggStep } from "./types";

const PUBLIC = join(__dirname, "..", "..", "public", "eggs");
const BACKEND_DATA = join(__dirname, "..", "..", "..", "backend", "data");

function wordList(name: string): Set<string> {
  return new Set(
    readFileSync(join(BACKEND_DATA, name), "utf-8")
      .split("\n")
      .map((line) => line.split("#")[0].trim())
      .filter(Boolean),
  );
}

const allSteps: EggStep[] = [
  ...[...EGG_CATALOG.values()].flatMap(([icon, motion, sound]): EggStep[] => [
    { kind: "sprite", icon, motion },
    ...(sound ? [{ kind: "sound", sound } as const] : []),
  ]),
  ...[...SCENE_WORDS.values()].flat(),
];

describe("easter egg catalogue", () => {
  it("covers well over a thousand words", () => {
    expect(EGG_CATALOG.size).toBeGreaterThan(1500);
    expect(SCENE_WORDS.size).toBeGreaterThan(100);
  });

  it("has a file for every picture and every sound it names", () => {
    const synth = new Set<string>(SYNTH_SOUNDS);
    for (const step of allSteps) {
      if (step.kind === "sprite") expect(existsSync(join(PUBLIC, "svg", `${step.icon}.svg`)), step.icon).toBe(true);
      if (step.kind === "sound" && !synth.has(step.sound)) {
        expect(existsSync(join(PUBLIC, "sfx", `${step.sound}.mp3`)), step.sound).toBe(true);
      }
    }
  });

  it("ships no picture and no sound that nothing uses", () => {
    const icons = new Set(allSteps.flatMap((s) => (s.kind === "sprite" ? [s.icon] : [])));
    const extra = readFileSync(join(__dirname, "..", "..", "data", "easter-eggs", "extra-icons.txt"), "utf-8")
      .split("\n")
      .map((l) => l.split("#")[0].trim())
      .filter(Boolean);
    for (const icon of extra) icons.add(icon);
    for (const file of readdirSync(join(PUBLIC, "svg"))) expect(icons.has(file.replace(/\.svg$/, "")), file).toBe(true);
  });

  it("uses only known motions", () => {
    for (const step of allSteps) if (step.kind === "sprite") expect(EGG_MOTIONS).toContain(step.motion);
  });

  it("never pictures a word the game refuses to name on its own", () => {
    const blocked = wordList("hint_blocklist_de.txt");
    const stop = wordList("stopwords_de.txt");
    for (const word of EGG_CATALOG.keys()) {
      expect(blocked.has(word), word).toBe(false);
      expect(stop.has(word), word).toBe(false);
    }
  });

  it("leaves the knock and the mascot to their own easter eggs", () => {
    for (const word of ["klopfen", "erdnuss"]) {
      expect(EGG_CATALOG.has(word)).toBe(false);
      expect(SCENE_WORDS.has(word)).toBe(false);
    }
  });

  it("keeps scenes to the one flash rule: two flashes at least a second apart", () => {
    for (const steps of SCENE_WORDS.values()) {
      const flashes = steps
        .filter((s) => s.kind === "overlay" && s.overlay === "flash")
        .map((s) => s.at ?? 0)
        .sort((a, b) => a - b);
      for (let i = 1; i < flashes.length; i++) expect(flashes[i] - flashes[i - 1]).toBeGreaterThanOrEqual(1000);
    }
  });
});

describe("matchEgg", () => {
  it("finds a word as the server returns it", () => {
    expect(matchEgg("hund")?.key).toBe("hund");
  });

  it("finds a word as the player typed it", () => {
    expect(matchEgg("  Hund! ")?.key).toBe("hund");
    expect(matchEgg("KAEFER")?.key).toBe("käfer");
  });

  it("gives the scene precedence over the catalogue", () => {
    const geist = matchEgg("geist");
    expect(geist?.steps.some((s) => s.kind === "sound" && s.sound === "ghost")).toBe(true);
    expect(geist?.steps.length).toBeGreaterThan(2);
  });

  it("knows words the game does not rank", () => {
    for (const word of ["mlg", "yeet", "bruh", "noscope", "miau", "hatschi"]) expect(matchEgg(word), word).not.toBeNull();
  });

  it("plays the MLG scene with air horns, hitmarkers and the scream", () => {
    const sounds = (matchEgg("mlg")?.steps ?? []).flatMap((s) => (s.kind === "sound" ? [s.sound] : []));
    expect(sounds).toEqual(expect.arrayContaining(["airhorn", "hitmarker", "shot", "scream"]));
  });

  it("says nothing for an ordinary miss", () => {
    expect(matchEgg("qwrtz")).toBeNull();
    expect(matchEgg("")).toBeNull();
    expect(matchEgg("!!!")).toBeNull();
  });
});

describe("eggSpellings", () => {
  it("folds written-out umlauts and the sharp s", () => {
    expect(eggSpellings("Strauss")).toContain("strauß");
    expect(eggSpellings("Muehle")).toContain("mühle");
  });
});
