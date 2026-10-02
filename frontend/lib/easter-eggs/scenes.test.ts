import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { eggSpellings, matchEgg } from "./match";
import { SCENE_WORDS } from "./scenes";
import { EGG_MOTIONS, SYNTH_SOUNDS, type EggStep } from "./types";

const PUBLIC = join(__dirname, "..", "..", "public", "eggs");
const DATA = join(__dirname, "..", "..", "data", "easter-eggs");

function listFile(path: string): string[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .map((line) => line.split("#")[0].trim())
    .filter(Boolean);
}

const allSteps: EggStep[] = [...SCENE_WORDS.values()].flat();
const sceneIcons = new Set(allSteps.flatMap((s) => (s.kind === "sprite" ? [s.icon] : [])));
const sceneSounds = new Set(allSteps.flatMap((s) => (s.kind === "sound" ? [s.sound] : [])));

describe("easter egg scenes", () => {
  it("cover the hand-made scene words", () => {
    expect(SCENE_WORDS.size).toBeGreaterThan(100);
  });

  it("have a file for every picture and every sound they name", () => {
    const synth = new Set<string>(SYNTH_SOUNDS);
    for (const icon of sceneIcons) expect(existsSync(join(PUBLIC, "svg", `${icon}.svg`)), icon).toBe(true);
    for (const sound of sceneSounds) {
      if (!synth.has(sound)) expect(existsSync(join(PUBLIC, "sfx", `${sound}.mp3`)), sound).toBe(true);
    }
  });

  it("list exactly the pictures they use, for scripts/build-egg-icons.py", () => {
    expect(new Set(listFile(join(DATA, "scene-icons.txt")))).toEqual(sceneIcons);
  });

  it("ship no picture and no sound that no scene uses", () => {
    for (const file of readdirSync(join(PUBLIC, "svg"))) expect(sceneIcons.has(file.replace(/\.svg$/, "")), file).toBe(true);
    for (const file of readdirSync(join(PUBLIC, "sfx"))) expect(sceneSounds.has(file.replace(/\.mp3$/, "")), file).toBe(true);
  });

  it("keep the sound manifest in step with the sound files", () => {
    const manifest = JSON.parse(readFileSync(join(DATA, "sounds.json"), "utf-8")) as { id: string }[];
    const files = readdirSync(join(PUBLIC, "sfx")).map((file) => file.replace(/\.mp3$/, ""));
    expect(new Set(manifest.map((s) => s.id))).toEqual(new Set(files));
  });

  it("use only known motions", () => {
    for (const step of allSteps) if (step.kind === "sprite") expect(EGG_MOTIONS).toContain(step.motion);
  });

  it("leave the knock and the mascot to their own easter eggs", () => {
    for (const word of ["klopfen", "erdnuss"]) expect(SCENE_WORDS.has(word)).toBe(false);
  });

  it("keep to the one flash rule: two flashes at least a second apart", () => {
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
    expect(matchEgg("sonne")?.key).toBe("sonne");
  });

  it("finds a word as the player typed it", () => {
    expect(matchEgg("  Sonne! ")?.key).toBe("sonne");
    expect(matchEgg("AUSSERIRDISCHER")?.key).toBe("außerirdischer");
  });

  it("knows words the game does not rank", () => {
    for (const word of ["mlg", "yeet", "bruh", "noscope", "miau", "hatschi"]) expect(matchEgg(word), word).not.toBeNull();
  });

  it("plays the MLG scene with air horns, hitmarkers and the scream", () => {
    const sounds = (matchEgg("mlg")?.steps ?? []).flatMap((s) => (s.kind === "sound" ? [s.sound] : []));
    expect(sounds).toEqual(expect.arrayContaining(["airhorn", "hitmarker", "shot", "scream"]));
  });

  it("plays nothing for a word without a scene, the emoji catalogue is gone", () => {
    for (const word of ["hund", "katze", "apfel", "auto", "baum"]) expect(matchEgg(word), word).toBeNull();
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
