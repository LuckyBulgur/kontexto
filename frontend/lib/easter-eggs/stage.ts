"use client";

import type { EggMotion, EggOverlay } from "./types";

/**
 * Draws the easter eggs: one layer per egg, appended to `<body>`.
 *
 * Imperative on purpose, the same contract as the mascot (`lib/mascot-fly.ts`):
 * outside the React tree, so no client mounts anything and nothing in the page
 * shifts; fixed, `z-index: 40` (above the page, under dialogs and toasts);
 * never catching a pointer and hidden from assistive technology. A layer is
 * removed by a timer rather than `animationend`, because a background tab may
 * never deliver the event. At most MAX_LAYERS eggs show at once; a new one
 * removes the oldest, so typing fast never piles up work for the browser.
 *
 * Every motion is one CSS keyframe pass (`app/globals.css`, "Easter eggs").
 * Randomness (height, direction, delay) goes in as inline custom properties.
 * In a live room the pictures that stand still (pop, spin) and the drops
 * (rain, rise) keep to the outer quarter on each side, so the board in the
 * middle stays readable on stream.
 */

export const MAX_LAYERS = 6;

/** How long each motion runs, kept in step with the keyframes in `app/globals.css`. */
export const MOTION_MS: Readonly<Record<EggMotion, number>> = {
  fly: 3200,
  run: 3800,
  drive: 3000,
  swim: 4200,
  rain: 3400,
  rise: 3800,
  pop: 1900,
  bounce: 3200,
  spin: 2200,
};

export const OVERLAY_MS: Readonly<Record<EggOverlay, number>> = {
  flash: 450,
  night: 2800,
  rainbow: 3000,
  shake: 650,
  hitmarker: 450,
  shades: 2000,
  scope: 1200,
};

export const TEXT_MS = 1600;

const DEFAULT_COUNT: Readonly<Partial<Record<EggMotion, number>>> = { rain: 12, rise: 7 };

const layers: HTMLElement[] = [];

function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** A horizontal position in percent: anywhere, or in the outer quarter on each side in a live room. */
function horizontal(live: boolean, min = 2, max = 92): number {
  if (!live) return random(min, max);
  return Math.random() < 0.5 ? random(min, 22) : random(72, max);
}

export function openLayer(live: boolean): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "egg-layer";
  layer.setAttribute("aria-hidden", "true");
  if (live) layer.dataset.live = "";
  document.body.appendChild(layer);
  layers.push(layer);
  while (layers.length > MAX_LAYERS) layers.shift()?.remove();
  return layer;
}

export function closeLayerAfter(layer: HTMLElement, ms: number): void {
  window.setTimeout(() => {
    layer.remove();
    const i = layers.indexOf(layer);
    if (i >= 0) layers.splice(i, 1);
  }, ms + 250);
}

function picture(icon: string): HTMLImageElement {
  const img = document.createElement("img");
  img.src = `/eggs/svg/${icon}.svg`;
  img.alt = "";
  img.decoding = "async";
  img.draggable = false;
  return img;
}

export function addSprite(layer: HTMLElement, icon: string, motion: EggMotion, count: number | undefined, live: boolean): void {
  const copies = Math.max(1, Math.min(30, count ?? DEFAULT_COUNT[motion] ?? 1));
  for (let i = 0; i < copies; i++) {
    const img = picture(icon);
    img.dataset.egg = icon;
    const reverse = Math.random() < 0.5;
    img.className = `egg-sprite egg-${motion}${reverse ? " egg-reverse" : ""}`;
    const style = img.style;
    switch (motion) {
      case "fly":
        style.top = `${random(8, 55)}%`;
        break;
      case "run":
      case "drive":
      case "bounce":
        style.bottom = `${random(2, 10)}vh`;
        break;
      case "swim":
        style.bottom = `${random(4, 20)}vh`;
        break;
      case "rain":
        style.left = `${horizontal(live)}%`;
        style.setProperty("--egg-delay", `${Math.round(random(0, copies > 1 ? 1000 : 0))}ms`);
        style.setProperty("--egg-dur", `${Math.round(random(2200, 2400))}ms`);
        style.setProperty("--egg-turn", `${Math.round(random(-200, 200))}deg`);
        break;
      case "rise":
        style.left = `${horizontal(live)}%`;
        style.setProperty("--egg-delay", `${Math.round(random(0, copies > 1 ? 800 : 0))}ms`);
        style.setProperty("--egg-dur", `${Math.round(random(2600, 3000))}ms`);
        break;
      case "pop":
      case "spin":
        style.left = `${horizontal(live, 8, 80)}%`;
        style.top = `${random(12, 55)}%`;
        break;
    }
    layer.appendChild(img);
  }
}

export function addText(layer: HTMLElement, text: string, live: boolean): void {
  const el = document.createElement("div");
  el.className = "egg-text";
  el.textContent = text;
  el.style.top = live ? "6%" : `${Math.round(random(18, 34))}%`;
  el.style.left = live ? `${horizontal(true, 4, 70)}%` : `${Math.round(random(20, 60))}%`;
  layer.appendChild(el);
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(viewBox: string, className: string, children: string): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, "svg");
  el.setAttribute("viewBox", viewBox);
  el.setAttribute("class", className);
  // Static markup of our own, no input from anybody: safe to set as a string.
  el.innerHTML = children;
  return el;
}

/** The X of a shooter game: four short diagonal strokes around an empty middle. */
const HITMARKER =
  '<g stroke-linecap="square">' +
  '<path d="M6 6L16 16M34 6L24 16M6 34L16 24M34 34L24 24" stroke="#1a1a1a" stroke-width="6"/>' +
  '<path d="M6 6L16 16M34 6L24 16M6 34L16 24M34 34L24 24" stroke="#ffffff" stroke-width="3"/></g>';

/** Pixel sunglasses, drawn on a 24 by 6 grid. */
const SHADES =
  '<g fill="#111">' +
  '<rect x="0" y="0" width="24" height="1"/><rect x="1" y="1" width="9" height="3"/><rect x="14" y="1" width="9" height="3"/>' +
  '<rect x="2" y="4" width="7" height="1"/><rect x="15" y="4" width="7" height="1"/><rect x="10" y="1" width="4" height="1"/></g>' +
  '<g fill="#fff"><rect x="2" y="1" width="2" height="1"/><rect x="3" y="2" width="1" height="1"/>' +
  '<rect x="15" y="1" width="2" height="1"/><rect x="16" y="2" width="1" height="1"/></g>';

/** A scope: ring, crosshair and four ticks. */
const SCOPE =
  '<circle cx="50" cy="50" r="44" fill="none" stroke="#111" stroke-width="5"/>' +
  '<circle cx="50" cy="50" r="44" fill="none" stroke="#e8e8e8" stroke-width="2"/>' +
  '<path d="M50 4V40M50 60V96M4 50H40M60 50H96" stroke="#111" stroke-width="3"/>' +
  '<circle cx="50" cy="50" r="2.5" fill="#e11d48"/>';

/** Six solid arcs, outermost red; no gradient, each band is one colour. */
const RAINBOW_BANDS = ["#e5484d", "#f76b15", "#ffc53d", "#46a758", "#0090ff", "#8e4ec6"]
  .map((color, i) => `<path d="M${10 + i * 7} 100A${90 - i * 7} ${90 - i * 7} 0 0 1 ${190 - i * 7} 100" fill="none" stroke="${color}" stroke-width="7"/>`)
  .join("");

/** Shakes the page content once. Not in a live room, and only `<main>`, so fixed layers stay put. */
function shakePage(): void {
  const main = document.querySelector("main");
  if (!main) return;
  main.classList.remove("egg-shake");
  // Force a reflow so a second shake restarts the animation.
  void main.offsetWidth;
  main.classList.add("egg-shake");
  window.setTimeout(() => main.classList.remove("egg-shake"), OVERLAY_MS.shake + 50);
}

export function addOverlay(layer: HTMLElement, overlay: EggOverlay, live: boolean): void {
  switch (overlay) {
    case "shake":
      if (!live) shakePage();
      layer.classList.add("egg-shake");
      return;
    case "night": {
      if (live) return;
      const el = document.createElement("div");
      el.className = "egg-night";
      layer.appendChild(el);
      return;
    }
    case "flash": {
      const el = document.createElement("div");
      el.className = "egg-flash";
      layer.appendChild(el);
      return;
    }
    case "rainbow":
      layer.appendChild(svg("0 0 200 100", "egg-rainbow", RAINBOW_BANDS));
      return;
    case "hitmarker": {
      const el = svg("0 0 40 40", "egg-hitmarker", HITMARKER);
      el.style.left = `${horizontal(live, 10, 82)}%`;
      el.style.top = `${random(18, 70)}%`;
      layer.appendChild(el);
      return;
    }
    case "shades": {
      const wrap = document.createElement("div");
      wrap.className = "egg-shades";
      wrap.style.left = live ? `${horizontal(true, 4, 70)}%` : `${Math.round(random(25, 55))}%`;
      wrap.appendChild(svg("0 0 24 6", "egg-shades-glasses", SHADES));
      const caption = document.createElement("span");
      caption.textContent = "DEAL WITH IT";
      wrap.appendChild(caption);
      layer.appendChild(wrap);
      return;
    }
    case "scope": {
      const el = svg("0 0 100 100", "egg-scope", SCOPE);
      if (live) el.style.left = `${horizontal(true, 4, 76)}%`;
      layer.appendChild(el);
      return;
    }
  }
}
