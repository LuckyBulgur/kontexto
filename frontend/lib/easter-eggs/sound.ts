"use client";

import { eggAudioContext } from "./audio-context";
import type { SynthSound } from "./types";

/**
 * Sound for the easter eggs, on one shared Web Audio graph.
 *
 * Always on, the player's decision: there is no switch. The files under
 * `/eggs/sfx/` are prepared like the knock (mono, about -25 LUFS, true peak
 * -6 dBFS, `scripts/build-egg-sounds.py`) and play at MASTER_VOLUME on top, so
 * a quiet game page is not startled. Up to MAX_VOICES sounds overlap, because
 * one word after the other should each be heard; past that the oldest stops.
 *
 * Browsers start audio only after a user gesture. The typed path unlocks the
 * context inside the submit handler (`audio-context.ts`); a word that arrives
 * from a stream chat plays once the host has clicked anything on the page.
 * Anything that refuses (policy, no output device, a failed fetch) is
 * swallowed: a missing sound is not an error the player should see.
 */

export const MASTER_VOLUME = 0.6;
export const MAX_VOICES = 6;
const SFX_BASE = "/eggs/sfx/";

let master: GainNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const voices: AudioScheduledSourceNode[] = [];

function audio(): { ctx: AudioContext; out: GainNode } | null {
  const ctx = eggAudioContext();
  if (!ctx) return null;
  if (!master) {
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  return { ctx, out: master };
}

function load(ctx: AudioContext, id: string): Promise<AudioBuffer | null> {
  let pending = buffers.get(id);
  if (!pending) {
    pending = fetch(`${SFX_BASE}${id}.mp3`)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => {
        // Not cached, so a flaky network may succeed on the next word.
        buffers.delete(id);
        return null;
      });
    buffers.set(id, pending);
  }
  return pending;
}

function track(node: AudioScheduledSourceNode): void {
  voices.push(node);
  node.addEventListener("ended", () => {
    const i = voices.indexOf(node);
    if (i >= 0) voices.splice(i, 1);
  });
  while (voices.length > MAX_VOICES) {
    const oldest = voices.shift();
    try {
      oldest?.stop();
    } catch {
      // Already stopped.
    }
  }
}

function gainNode(ctx: AudioContext, out: GainNode, volume: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  gain.connect(out);
  return gain;
}

/** A short hitmarker tick: two square blips and a click of noise, 70 ms. */
function hitmarker(ctx: AudioContext, out: GainNode, volume: number): void {
  const t = ctx.currentTime;
  const gain = gainNode(ctx, out, volume * 0.5);
  gain.gain.setValueAtTime(volume * 0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(1900, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.06);
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + 0.08);
  track(osc);
}

const SYNTHS: Readonly<Record<SynthSound, (ctx: AudioContext, out: GainNode, volume: number) => void>> = {
  hitmarker,
};

/** Play one sound now. `rate` above 1 is higher and shorter. */
export function playSound(id: string, volume = 1, rate = 1): void {
  const a = audio();
  if (!a) return;
  if (a.ctx.state === "suspended") a.ctx.resume().catch(() => undefined);
  const synth = SYNTHS[id as SynthSound];
  if (synth) {
    synth(a.ctx, a.out, volume);
    return;
  }
  load(a.ctx, id).then((buffer) => {
    if (!buffer || a.ctx.state === "closed") return;
    const source = a.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(gainNode(a.ctx, a.out, volume));
    source.start();
    track(source);
  });
}

/** Say a line with a local voice of the browser; nothing is downloaded. */
export function speak(text: string, lang: string, pitch = 1, rate = 1): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = MASTER_VOLUME;
    const available = window.speechSynthesis.getVoices();
    const wanted = lang.toLowerCase();
    const voice =
      available.find((v) => v.lang.toLowerCase() === wanted) ??
      available.find((v) => v.lang.toLowerCase().startsWith(wanted.slice(0, 2)));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  } catch {
    // No voice on this system: the line is a bonus.
  }
}
