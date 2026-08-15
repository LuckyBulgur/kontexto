/**
 * Zentralisierte Konfetti-Helfer.
 *
 * Bündelt das zuvor in mehreren Spielkomponenten inline duplizierte
 * `canvas-confetti`-Setup an einer Stelle (DRY) und stellt während des
 * WM-2026-Events eine fußball-themierte Jubel-Variante bereit. Außerhalb des
 * Events ist das Verhalten identisch zum bisherigen Code.
 *
 * `canvas-confetti` wird dynamisch importiert, damit es nicht im Haupt-Bundle
 * landet (Lazy-Load wie bisher).
 */
import type * as ConfettiNS from "canvas-confetti";
import { isEventActive } from "@/lib/event-theme";

type ConfettiOptions = ConfettiNS.Options;
type ConfettiShape = ConfettiNS.Shape;

/** Nur die hier genutzte Teilmenge der canvas-confetti-API. */
interface ConfettiApi {
  (options?: ConfettiOptions): Promise<null> | null;
  shapeFromPath(pathData: string | { path: string; matrix?: DOMMatrix }): ConfettiShape;
}

/** WM-2026-Jubelpalette: Pitch-Grün, Gold, Weiß. */
const EVENT_COLORS = ["#1f8a4c", "#2bb673", "#d8a23a", "#f4d35e", "#ffffff"];

let confettiPromise: Promise<ConfettiApi> | null = null;
function loadConfetti(): Promise<ConfettiApi> {
  if (!confettiPromise) {
    confettiPromise = import("canvas-confetti").then((m) => m.default as unknown as ConfettiApi);
  }
  return confettiPromise;
}

let cachedShapes: ConfettiShape[] | null = null;
/**
 * Mischung aus runden Ball-Körpern und einem Fünfeck-Panel, evoziert
 * Fußbälle, ganz ohne Emojis (Content-Richtlinie). Einmalig gecacht.
 */
function footballShapes(confetti: ConfettiApi): ConfettiShape[] {
  if (!cachedShapes) {
    const pentagon = confetti.shapeFromPath({ path: "M5 0 L10 3.8 L8.1 10 L1.9 10 L0 3.8 Z" });
    cachedShapes = ["circle", "circle", pentagon];
  }
  return cachedShapes;
}

function eventDefaults(confetti: ConfettiApi): ConfettiOptions {
  return { colors: EVENT_COLORS, shapes: footballShapes(confetti) };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Voller Sieges-Jubel: 3 Sekunden Konfetti-Regen von beiden Seiten.
 * Wird auf den Kontexto-/Duell-/Koop-Lösungen ausgelöst.
 */
export async function fireConfetti(): Promise<void> {
  const confetti = await loadConfetti();
  const event = isEventActive();
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults: ConfettiOptions = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: 0,
    disableForReducedMotion: true,
    ...(event ? eventDefaults(confetti) : {}),
  };

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);
    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);

  if (event) showGoalFlash();
}

/**
 * Einzelner zentraler Burst für die Wördle-Lösungen (nach der Flip-Animation).
 */
export async function fireBurst(): Promise<void> {
  const confetti = await loadConfetti();
  const event = isEventActive();
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    disableForReducedMotion: true,
    ...(event ? eventDefaults(confetti) : {}),
  });
  if (event) showGoalFlash();
}

/**
 * Kleiner, dezenter Burst für die dekorative Demo auf der Startseite.
 * Kein „Tor!"-Overlay, da rein illustrativ.
 */
export async function fireDemoBurst(): Promise<void> {
  const confetti = await loadConfetti();
  confetti({
    particleCount: 70,
    spread: 60,
    origin: { y: 0.7 },
    disableForReducedMotion: true,
    ...(isEventActive() ? eventDefaults(confetti) : {}),
  });
}

/**
 * Kurzer, vollflächiger „TOR!"-Moment während des WM-Events. Rein dekorativ
 * (aria-hidden), als imperatives Overlay umgesetzt, damit die Aufruferseiten
 * nichts über React durchreichen müssen. Bei reduzierter Bewegung übersprungen.
 */
function showGoalFlash(): void {
  if (typeof document === "undefined") return;
  if (prefersReducedMotion()) return;
  if (document.querySelector(".event-goal-flash")) return;

  const el = document.createElement("div");
  el.className = "event-goal-flash";
  el.setAttribute("aria-hidden", "true");
  el.textContent = "TOR!";
  document.body.appendChild(el);

  const cleanup = () => el.remove();
  el.addEventListener("animationend", cleanup, { once: true });
  // Fallback, falls die Animation (z. B. ohne CSS) nicht feuert.
  window.setTimeout(cleanup, 1600);
}
