/**
 * The shape of an easter egg: what a typed word sets off.
 *
 * An egg is a short timeline of steps, each starting `at` milliseconds after
 * the word: a picture that moves, a full-screen overlay, a sound, a spoken
 * line, confetti. The generated catalogue (`catalog.generated.ts`) gives most
 * words one picture and at most one sound; the hand-made scenes
 * (`scenes.ts`) combine several. Pure data, so it can be tested without a DOM.
 */

/** How a picture crosses the screen. Each is one CSS keyframe pass, in `app/globals.css`. */
export type EggMotion = "fly" | "run" | "drive" | "swim" | "rain" | "rise" | "pop" | "bounce" | "spin";

export const EGG_MOTIONS: readonly EggMotion[] = ["fly", "run", "drive", "swim", "rain", "rise", "pop", "bounce", "spin"];

/** Full-screen layers drawn without a picture file. */
export type EggOverlay =
  /** One white flash, 400 ms, never repeated within a second (WCAG 2.3.1). */
  | "flash"
  /** The screen dims for two seconds. Never in a live room, it would hide the stream. */
  | "night"
  /** A rainbow arc rises from the bottom. */
  | "rainbow"
  /** The page content shakes for 600 ms. Never in a live room. */
  | "shake"
  /** A hitmarker, the X of a shooter game, at a random spot. */
  | "hitmarker"
  /** Pixel sunglasses drop onto the screen ("deal with it"). */
  | "shades"
  /** A scope ring turns once around the middle. */
  | "scope";

export interface SpriteStep {
  kind: "sprite";
  /** A file under `/eggs/svg/`, without the extension. */
  icon: string;
  motion: EggMotion;
  /** How many copies; `rain` and `rise` default to several, everything else to one. */
  count?: number;
  at?: number;
}

export interface OverlayStep {
  kind: "overlay";
  overlay: EggOverlay;
  at?: number;
}

export interface TextStep {
  kind: "text";
  /** Shown in capitals, slowly shifting colour; MLG style. */
  text: string;
  at?: number;
}

export interface SoundStep {
  kind: "sound";
  /** A file under `/eggs/sfx/`, or a synthesised sound (see `SYNTH_SOUNDS`). */
  sound: string;
  at?: number;
  /** 0 to 1 on top of the master volume. */
  volume?: number;
  /** Playback rate; above 1 is higher and shorter. */
  rate?: number;
}

export interface SpeechStep {
  kind: "speech";
  text: string;
  /** BCP 47 tag of the voice to use, e.g. `en-US`. */
  lang: string;
  at?: number;
  pitch?: number;
  rate?: number;
}

export interface ConfettiStep {
  kind: "confetti";
  style: "burst" | "fireworks";
  at?: number;
}

export type EggStep = SpriteStep | OverlayStep | TextStep | SoundStep | SpeechStep | ConfettiStep;

export interface EggSpec {
  /** What the cooldown counts: the word as matched. */
  key: string;
  steps: readonly EggStep[];
}

/** Synthesised in the browser rather than loaded, because no file is needed for a click. */
export const SYNTH_SOUNDS = ["hitmarker"] as const;
export type SynthSound = (typeof SYNTH_SOUNDS)[number];

/**
 * Where a word came from. `own`: the player typed it. `team`: a teammate in a
 * koop room. `live`: the stream chat of a live room, or the host typing there,
 * where everything shows on stream and stays clear of the middle of the board.
 */
export type EggSource = "own" | "team" | "live";
