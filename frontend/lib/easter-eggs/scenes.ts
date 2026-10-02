import type { EggStep } from "./types";

/**
 * The hand-made easter eggs: scenes that combine several pictures, an overlay
 * and sounds, and the words that set them off. They win over the generated
 * catalogue for the same word.
 *
 * Every picture named here is a file under `/eggs/svg/` (the catalogue's own
 * or listed in `data/easter-eggs/extra-icons.txt`), every sound a file under
 * `/eggs/sfx/` or a synthesised one; `scenes.test.ts` holds both.
 *
 * Some words are not words the game ranks (`mlg`, `yeet`, `miau`). They still
 * fire, because the input path matches what the player typed before the server
 * answers, and the refusal message comes as usual.
 */

/**
 * MLG, the 2014 montage meme: air horns, hitmarkers, a scream, a sniper scope,
 * the sunglasses, "OH BABY A TRIPLE". About four seconds. The hitmarkers are a
 * third of a second apart at the closest, and nothing flashes, so the scene
 * stays under the three-flashes-a-second limit (WCAG 2.3.1).
 */
const MLG: readonly EggStep[] = [
  { kind: "sound", sound: "airhorn", at: 0 },
  { kind: "text", text: "MLG", at: 0 },
  { kind: "overlay", overlay: "shake", at: 0 },
  { kind: "sound", sound: "airhorn", at: 450, rate: 1.06 },
  { kind: "sprite", icon: "hundred-points", motion: "spin", at: 200 },
  { kind: "sprite", icon: "smiling-face-with-sunglasses", motion: "fly", at: 300 },
  { kind: "sprite", icon: "red-triangle", motion: "rain", count: 10, at: 400 },
  { kind: "sprite", icon: "cup-with-straw", motion: "spin", at: 500 },
  { kind: "sound", sound: "airhorn", at: 900, rate: 0.94 },
  { kind: "overlay", overlay: "scope", at: 700 },
  { kind: "overlay", overlay: "hitmarker", at: 1000 },
  { kind: "sound", sound: "hitmarker", at: 1000 },
  { kind: "sound", sound: "shot", at: 1000, volume: 0.7 },
  { kind: "overlay", overlay: "hitmarker", at: 1350 },
  { kind: "sound", sound: "hitmarker", at: 1350 },
  { kind: "sound", sound: "shot", at: 1350, volume: 0.7, rate: 1.1 },
  { kind: "overlay", overlay: "hitmarker", at: 1700 },
  { kind: "sound", sound: "hitmarker", at: 1700 },
  { kind: "sound", sound: "shot", at: 1700, volume: 0.7, rate: 0.9 },
  { kind: "sprite", icon: "collision", motion: "pop", at: 1700 },
  { kind: "sprite", icon: "fire", motion: "rise", count: 6, at: 1800 },
  { kind: "sound", sound: "scream", at: 2000 },
  { kind: "sprite", icon: "bullseye", motion: "spin", at: 2100 },
  { kind: "text", text: "WOW", at: 2300 },
  { kind: "speech", text: "Oh baby, a triple!", lang: "en-US", at: 2400, pitch: 1.3, rate: 1.1 },
  { kind: "overlay", overlay: "shades", at: 2600 },
  { kind: "sound", sound: "airhorn", at: 3300 },
  { kind: "sprite", icon: "face-with-tears-of-joy", motion: "rise", count: 5, at: 3200 },
];

const GHOST: readonly EggStep[] = [
  { kind: "sprite", icon: "ghost", motion: "fly" },
  { kind: "sprite", icon: "ghost", motion: "rise", count: 4, at: 400 },
  { kind: "sound", sound: "ghost" },
];

const THUNDERSTORM: readonly EggStep[] = [
  { kind: "sprite", icon: "cloud-with-lightning-and-rain", motion: "fly" },
  { kind: "sprite", icon: "droplet", motion: "rain", count: 18, at: 200 },
  { kind: "overlay", overlay: "flash", at: 600 },
  { kind: "sound", sound: "thunder", at: 650 },
  { kind: "overlay", overlay: "flash", at: 2200 },
];

const LIGHTNING: readonly EggStep[] = [
  { kind: "overlay", overlay: "flash" },
  { kind: "sprite", icon: "high-voltage", motion: "pop" },
  { kind: "sound", sound: "thunder", at: 80 },
];

const RAIN: readonly EggStep[] = [
  { kind: "sprite", icon: "cloud-with-rain", motion: "fly" },
  { kind: "sprite", icon: "droplet", motion: "rain", count: 20, at: 200 },
  { kind: "sound", sound: "rain" },
];

const SNOW: readonly EggStep[] = [
  { kind: "sprite", icon: "snowflake", motion: "rain", count: 22 },
  { kind: "sprite", icon: "snowman", motion: "pop", at: 900 },
  { kind: "sound", sound: "sleighbells", volume: 0.6 },
];

const RAINBOW: readonly EggStep[] = [
  { kind: "overlay", overlay: "rainbow" },
  { kind: "sprite", icon: "sparkles", motion: "rain", count: 10, at: 300 },
  { kind: "sound", sound: "chimes" },
];

const EARTHQUAKE: readonly EggStep[] = [
  { kind: "overlay", overlay: "shake" },
  { kind: "sound", sound: "rockfall" },
  { kind: "sprite", icon: "rock", motion: "rain", count: 8, at: 200 },
  { kind: "overlay", overlay: "shake", at: 900 },
];

const NIGHT: readonly EggStep[] = [
  { kind: "overlay", overlay: "night" },
  { kind: "sprite", icon: "crescent-moon", motion: "pop", at: 200 },
  { kind: "sprite", icon: "star", motion: "rain", count: 12, at: 300 },
  { kind: "sound", sound: "cricket", volume: 0.8 },
];

const SUN: readonly EggStep[] = [
  { kind: "sprite", icon: "sun", motion: "spin" },
  { kind: "sprite", icon: "sparkles", motion: "rain", count: 8, at: 400 },
];

const FIREWORKS: readonly EggStep[] = [
  { kind: "confetti", style: "fireworks" },
  { kind: "sprite", icon: "fireworks", motion: "rise", count: 5 },
  { kind: "sound", sound: "fireworks" },
];

const PARTY: readonly EggStep[] = [
  { kind: "confetti", style: "burst" },
  { kind: "sprite", icon: "party-popper", motion: "pop" },
  { kind: "sprite", icon: "balloon", motion: "rise", count: 6, at: 200 },
  { kind: "sound", sound: "partyhorn" },
];

const ROCKET: readonly EggStep[] = [
  { kind: "sprite", icon: "rocket", motion: "rise", count: 1 },
  { kind: "sprite", icon: "fire", motion: "rise", count: 4, at: 150 },
  { kind: "sound", sound: "whoosh" },
  { kind: "sound", sound: "explosion", at: 900, volume: 0.5 },
];

const LOVE: readonly EggStep[] = [
  { kind: "sprite", icon: "red-heart", motion: "rise", count: 12 },
  { kind: "sprite", icon: "smiling-face-with-hearts", motion: "pop", at: 300 },
  { kind: "sound", sound: "kiss" },
];

const MONEY: readonly EggStep[] = [
  { kind: "sprite", icon: "money-with-wings", motion: "rain", count: 10 },
  { kind: "sprite", icon: "coin", motion: "rain", count: 12, at: 200 },
  { kind: "sound", sound: "register" },
  { kind: "sound", sound: "coins", at: 300 },
];

const BALLOONS: readonly EggStep[] = [
  { kind: "sprite", icon: "balloon", motion: "rise", count: 9 },
  { kind: "sound", sound: "balloonblow", volume: 0.6 },
  { kind: "sound", sound: "balloonpop", at: 2600 },
];

const UFO: readonly EggStep[] = [
  { kind: "sprite", icon: "flying-saucer", motion: "fly" },
  { kind: "sprite", icon: "alien", motion: "rise", count: 3, at: 600 },
  { kind: "sound", sound: "ufo" },
];

const DINOSAUR: readonly EggStep[] = [
  { kind: "sprite", icon: "t-rex", motion: "run" },
  { kind: "overlay", overlay: "shake", at: 300 },
  { kind: "sound", sound: "rockfall", at: 300 },
  { kind: "overlay", overlay: "shake", at: 1400 },
  { kind: "sprite", icon: "sauropod", motion: "run", at: 900 },
];

const MAGIC: readonly EggStep[] = [
  { kind: "sprite", icon: "magic-wand", motion: "spin" },
  { kind: "sprite", icon: "sparkles", motion: "rain", count: 16, at: 200 },
  { kind: "sprite", icon: "glowing-star", motion: "rise", count: 6, at: 400 },
  { kind: "sound", sound: "chimes" },
];

const PIZZA: readonly EggStep[] = [
  { kind: "sprite", icon: "pizza", motion: "rain", count: 16 },
  { kind: "sound", sound: "chewing", at: 600 },
];

const SHARK: readonly EggStep[] = [
  { kind: "sprite", icon: "shark", motion: "swim" },
  { kind: "sprite", icon: "water-wave", motion: "swim", at: 300 },
  { kind: "sound", sound: "splash", at: 200 },
  { kind: "sound", sound: "waves", at: 400, volume: 0.6 },
];

const LAUGH: readonly EggStep[] = [
  { kind: "sprite", icon: "face-with-tears-of-joy", motion: "rise", count: 10 },
  { kind: "sound", sound: "laugh" },
];

const SNEEZE: readonly EggStep[] = [
  { kind: "sprite", icon: "sneezing-face", motion: "pop" },
  { kind: "sound", sound: "sneeze" },
  { kind: "speech", text: "Gesundheit!", lang: "de-DE", at: 1100 },
];

function animal(icon: string, sound: string, motion: "run" | "fly" | "swim" | "bounce" = "run"): readonly EggStep[] {
  return [
    { kind: "sprite", icon, motion },
    { kind: "sound", sound },
  ];
}

/** Every scene with the words that set it off, in the form the server or the player writes them. */
const SCENES: ReadonlyArray<readonly [readonly string[], readonly EggStep[]]> = [
  [["mlg", "noscope", "360noscope", "yeet", "bruh", "digga", "headshot", "sigma", "triple", "sniper", "krass", "montage", "illuminati", "wombo", "combo"], MLG],
  [["geist", "gespenst", "gespenster", "geister", "spuk", "poltergeist", "buh"], GHOST],
  [["gewitter", "donner", "sturm", "unwetter"], THUNDERSTORM],
  [["blitz", "blitzschlag"], LIGHTNING],
  [["regen", "regnen", "regenwetter", "platzregen"], RAIN],
  [["schnee", "schneien", "schneeflocke", "schneeflocken", "schneesturm"], SNOW],
  [["regenbogen"], RAINBOW],
  [["erdbeben", "beben"], EARTHQUAKE],
  [["nacht", "nachts", "mitternacht", "dunkel", "sternenhimmel"], NIGHT],
  [["sonne", "sonnig", "sonnenschein"], SUN],
  [["feuerwerk", "silvester", "neujahr", "raketen"], FIREWORKS],
  [["party", "feier", "feiern", "konfetti", "fete", "geburtstag"], PARTY],
  [["rakete", "start", "countdown"], ROCKET],
  [["liebe", "lieben", "verliebt", "herzen", "valentinstag"], LOVE],
  [["geld", "reich", "millionär", "jackpot", "lotto", "kohle", "kasse"], MONEY],
  [["ballon", "luftballon", "luftballons", "ballons"], BALLOONS],
  [["ufo", "außerirdischer", "alien", "aliens"], UFO],
  [["dinosaurier", "dino", "saurier", "t-rex", "trex"], DINOSAUR],
  [["zauberer", "zauberin", "zaubern", "zauberei", "magie", "magier", "hokuspokus", "abrakadabra", "simsalabim"], MAGIC],
  [["pizza", "pizzen"], PIZZA],
  [["hai", "haie", "haifisch"], SHARK],
  [["lol", "xd", "rofl", "haha", "hahaha", "lmao"], LAUGH],
  [["hatschi", "niesen"], SNEEZE],
  [["miau", "miauen"], animal("cat", "meow")],
  [["wuff", "wau", "bellen"], animal("dog", "bark")],
  [["muh"], animal("cow", "moo")],
  [["mäh", "määh", "bäh"], animal("ewe", "sheep")],
  [["kikeriki"], animal("rooster", "rooster", "fly")],
  [["quak", "quaken"], animal("frog", "frog", "bounce")],
  [["oink", "grunz", "grunzen"], animal("pig", "pig")],
  [["iah"], animal("donkey", "donkey")],
  [["wiehern"], animal("horse", "neigh")],
  [["schuhu"], animal("owl", "owl", "fly")],
  [["summ", "summen", "bzz"], animal("honeybee", "bee", "fly")],
  [["tatütata", "tatütataa", "martinshorn"], [{ kind: "sprite", icon: "ambulance", motion: "drive" }, { kind: "sound", sound: "siren" }]],
  [["hupen", "tröt", "töröö"], [{ kind: "sprite", icon: "automobile", motion: "drive" }, { kind: "sound", sound: "carhorn" }]],
  [["boing", "boink"], [{ kind: "sprite", icon: "basketball", motion: "bounce" }, { kind: "sound", sound: "boing" }]],
  [["pew", "pewpew"], [{ kind: "sprite", icon: "high-voltage", motion: "fly" }, { kind: "sound", sound: "laser" }]],
  [["kaboom", "bumm", "wumms", "peng"], [{ kind: "sprite", icon: "collision", motion: "pop" }, { kind: "overlay", overlay: "shake" }, { kind: "sound", sound: "explosion" }]],
  [["ding", "dong", "dingdong"], [{ kind: "sprite", icon: "bellhop-bell", motion: "pop" }, { kind: "sound", sound: "doorbell" }]],
  [["tick", "tack", "ticktack"], [{ kind: "sprite", icon: "alarm-clock", motion: "pop" }, { kind: "sound", sound: "clock" }]],
  [["gg", "ez", "sieg", "gewonnen"], [{ kind: "sprite", icon: "trophy", motion: "pop" }, { kind: "confetti", style: "burst" }, { kind: "sound", sound: "cheer" }]],
];

export const SCENE_WORDS: ReadonlyMap<string, readonly EggStep[]> = new Map(
  SCENES.flatMap(([words, steps]) => words.map((w) => [w, steps] as const)),
);
