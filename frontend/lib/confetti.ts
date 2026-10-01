/**
 * Confetti helpers, in one place.
 *
 * Collects the `canvas-confetti` setup that used to be duplicated inline in
 * several game components, and gives a running seasonal event its own
 * celebration. Outside an event the behaviour is exactly the plain one.
 *
 * `canvas-confetti` is imported dynamically so it stays out of the main bundle.
 */
import type * as ConfettiNS from "canvas-confetti";
import { SPOOKTOBER_2026, isSkinOn } from "@/lib/event-theme";
import type { Celebration, CelebrationShape, CelebrationStyle } from "@/lib/live-events";

type ConfettiOptions = ConfettiNS.Options;
type ConfettiShape = ConfettiNS.Shape;

/** The subset of the canvas-confetti API used here. */
interface ConfettiApi {
  (options?: ConfettiOptions): Promise<null> | null;
  shapeFromPath(pathData: string | { path: string; matrix?: DOMMatrix }): ConfettiShape;
}

/** Pumpkin, witch purple, slime green, candle cream and night. */
const SPOOK_COLORS = ["#ef7f1a", "#7b4bb3", "#8cc63f", "#fff3d6", "#2a1f33"];

let confettiPromise: Promise<ConfettiApi> | null = null;
function loadConfetti(): Promise<ConfettiApi> {
  if (!confettiPromise) {
    confettiPromise = import("canvas-confetti").then((m) => m.default as unknown as ConfettiApi);
  }
  return confettiPromise;
}

let cachedShapes: ConfettiShape[] | null = null;
/**
 * A wrapped bonbon, a candy corn and plain drops. Drawn as paths rather than
 * emoji (content rule M10). Cached after the first use.
 */
function candyShapes(confetti: ConfettiApi): ConfettiShape[] {
  if (!cachedShapes) {
    const bonbon = confetti.shapeFromPath({
      path: "M4 5L0 1.5V8.5ZM14 5L18 1.5V8.5ZM4 5C4 2.5 6.2 1 9 1S14 2.5 14 5 11.8 9 9 9 4 7.5 4 5Z",
    });
    const candyCorn = confetti.shapeFromPath({ path: "M5 0L10 12H0Z" });
    cachedShapes = [bonbon, bonbon, candyCorn, "circle"];
  }
  return cachedShapes;
}

function spooky(): boolean {
  return isSkinOn(SPOOKTOBER_2026);
}

function spookDefaults(confetti: ConfettiApi): ConfettiOptions {
  return { colors: SPOOK_COLORS, shapes: candyShapes(confetti), scalar: 1.4 };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The full win: three seconds of confetti from both sides. Fired on the
 * Kontexto, duel and koop solves.
 */
export async function fireConfetti(): Promise<void> {
  const confetti = await loadConfetti();
  const event = spooky();
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults: ConfettiOptions = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: 0,
    disableForReducedMotion: true,
    ...(event ? spookDefaults(confetti) : {}),
  };

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);
    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);

  if (event) showSpookFlash("Süßes!");
}

/** One central burst for the Wordle solves, after the tile flip. */
export async function fireBurst(): Promise<void> {
  const confetti = await loadConfetti();
  const event = spooky();
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    disableForReducedMotion: true,
    ...(event ? spookDefaults(confetti) : {}),
  });
  if (event) showSpookFlash("Süßes!");
}

/**
 * A small burst for the decorative demo on the home page. No flash, it is an
 * illustration and not a win.
 */
export async function fireDemoBurst(): Promise<void> {
  const confetti = await loadConfetti();
  confetti({
    particleCount: 70,
    spread: 60,
    origin: { y: 0.7 },
    disableForReducedMotion: true,
    ...(spooky() ? spookDefaults(confetti) : {}),
  });
}

/**
 * Candy out of the pumpkin: a short fountain from a point on screen, given in
 * viewport pixels.
 */
export async function fireCandyBurst(x: number, y: number): Promise<void> {
  if (typeof window === "undefined") return;
  const confetti = await loadConfetti();
  const origin = { x: x / window.innerWidth, y: y / window.innerHeight };
  const shared: ConfettiOptions = {
    ...spookDefaults(confetti),
    particleCount: 18,
    startVelocity: 24,
    spread: 50,
    ticks: 140,
    gravity: 0.9,
    zIndex: 41,
    origin,
    disableForReducedMotion: true,
  };
  confetti({ ...shared, angle: 60 });
  confetti({ ...shared, angle: 120 });
}

/** Candy falling from the top edge for a second and a half. */
export async function fireCandyRain(): Promise<void> {
  const confetti = await loadConfetti();
  const end = Date.now() + 1500;
  const interval = setInterval(() => {
    if (Date.now() > end) return clearInterval(interval);
    confetti({
      ...spookDefaults(confetti),
      particleCount: 6,
      angle: 270,
      spread: 40,
      startVelocity: 8,
      gravity: 0.7,
      ticks: 320,
      zIndex: 41,
      origin: { x: Math.random(), y: -0.05 },
      disableForReducedMotion: true,
    });
  }, 120);
}

/* ------------------------------------------------------------------------- *
 * Paid support on the live host page (components/live/SupportToasts.tsx).
 *
 * Every event is celebrated out of its toast at the top centre; the level
 * decides how much. The category colours win over the seasonal skin here,
 * because they carry meaning (platform, Bits tier). The canvas sits under the
 * toasts and over the board, and canvas-confetti draws it with
 * `pointer-events: none`, so the host keeps typing through the party.
 * ------------------------------------------------------------------------- */

/** Matches `z-40` minus one: over the board, under the toast stack. */
const SUPPORT_Z = 39;

/** One heavy effect (cannons, firework) at a time. */
let heavyUntil = 0;
/** At most one small burst per this many milliseconds. */
const SMALL_GAP_MS = 400;
let lastSmall = 0;

const supportShapeCache = new Map<CelebrationShape, ConfettiShape[]>();
function supportShapes(confetti: ConfettiApi, shape: CelebrationShape): ConfettiShape[] {
  const cached = supportShapeCache.get(shape);
  if (cached) return cached;
  let shapes: ConfettiShape[];
  switch (shape) {
    case "gem":
      shapes = [confetti.shapeFromPath({ path: "M3 0h6l3 4-6 8-6-8Z" })];
      break;
    case "star":
      shapes = [
        confetti.shapeFromPath({
          path: "M6 0l1.8 3.9 4.2.5-3.1 2.9.8 4.2L6 9.4 2.3 11.5l.8-4.2L0 4.4l4.2-.5Z",
        }),
      ];
      break;
    case "diamond":
      shapes = [confetti.shapeFromPath({ path: "M5 0l5 7-5 7-5-7Z" }), "circle"];
      break;
    case "coin":
      shapes = ["circle"];
      break;
  }
  supportShapeCache.set(shape, shapes);
  return shapes;
}

/**
 * Celebrate one paid event, starting from its toast.
 *
 * `origin` is the toast's rectangle in viewport pixels. Skipped entirely under
 * reduced motion; the toast still says who gave what.
 */
export async function fireSupportCelebration(
  level: Celebration,
  style: CelebrationStyle,
  origin: { left: number; top: number; width: number; height: number },
  rainCount: number
): Promise<void> {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  const confetti = await loadConfetti();
  const base: ConfettiOptions = {
    colors: [...style.colors],
    shapes: supportShapes(confetti, style.shape),
    scalar: 1.15,
    zIndex: SUPPORT_Z,
    disableForReducedMotion: true,
  };
  const x = (origin.left + origin.width / 2) / window.innerWidth;
  const now = Date.now();

  if (level === "small") {
    if (now - lastSmall < SMALL_GAP_MS) return;
    lastSmall = now;
    const y = (origin.top + origin.height / 2) / window.innerHeight;
    confetti({ ...base, particleCount: 30, spread: 70, startVelocity: 26, ticks: 110, origin: { x, y } });
  } else {
    const y = origin.top / window.innerHeight;
    confetti({ ...base, particleCount: 90, angle: 90, spread: 80, startVelocity: 45, ticks: 160, origin: { x, y } });
  }

  if ((level === "big" || level === "epic") && now >= heavyUntil) {
    const duration = level === "epic" ? 5000 : 3000;
    heavyUntil = now + duration;
    const end = now + duration;
    const interval = setInterval(() => {
      const left = end - Date.now();
      if (left <= 0) return clearInterval(interval);
      if (level === "epic") {
        const at = { x: 0.12 + Math.random() * 0.76, y: 0.12 + Math.random() * 0.4 };
        confetti({ ...base, particleCount: 70, spread: 360, startVelocity: 32, ticks: 90, gravity: 0.8, origin: at });
      } else {
        const n = Math.max(8, Math.round(40 * (left / duration)));
        confetti({ ...base, particleCount: n, angle: 60, spread: 55, startVelocity: 60, origin: { x: 0, y: 0.9 } });
        confetti({ ...base, particleCount: n, angle: 120, spread: 55, startVelocity: 60, origin: { x: 1, y: 0.9 } });
      }
    }, level === "epic" ? 320 : 250);
  }

  if (style.rain) {
    const duration = level === "epic" ? 4000 : 2000;
    const end = Date.now() + duration;
    const perTick = Math.max(2, Math.round(rainCount / (duration / 120)));
    const interval = setInterval(() => {
      if (Date.now() > end) return clearInterval(interval);
      confetti({
        ...base,
        particleCount: perTick,
        angle: 270,
        spread: 50,
        startVelocity: 6,
        gravity: 0.6,
        ticks: 360,
        origin: { x: Math.random(), y: -0.05 },
      });
    }, 120);
  }
}

/**
 * A short full-screen word ("Süßes!", "Saures!", "Buh!"). Purely decorative
 * (aria-hidden), imperative so no caller has to thread it through React.
 * Skipped under reduced motion.
 */
export function showSpookFlash(text: string): void {
  if (typeof document === "undefined") return;
  if (prefersReducedMotion()) return;
  if (document.querySelector(".spook-flash")) return;

  const el = document.createElement("div");
  el.className = "spook-flash";
  el.setAttribute("aria-hidden", "true");
  el.textContent = text;
  document.body.appendChild(el);

  const cleanup = () => el.remove();
  el.addEventListener("animationend", cleanup, { once: true });
  // Fallback in case the animation never fires (no CSS, a hidden tab).
  window.setTimeout(cleanup, 1600);
}
