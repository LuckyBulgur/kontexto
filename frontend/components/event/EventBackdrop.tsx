"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { useEventTheme } from "@/lib/use-event-theme";

/**
 * WM-2026-Hintergrund: einzelne Fußbälle, die in einer realistischen
 * Schuss-Parabel (echte Wurf-Physik mit Schwerkraft) über den Viewport
 * fliegen. Bewusst sparsam, langsam und dezent — hinter allem Inhalt,
 * `pointer-events:none` und `aria-hidden`.
 *
 * Performance/A11y:
 * - Canvas + requestAnimationFrame, DPR-scharf, höchstens 2 Bälle.
 * - Ball wird einmalig als Offscreen-Sprite vorgerendert; pro Frame nur
 *   `drawImage`.
 * - Zeit-basierte Integration mit `dt`-Clamping → kein Sprung nach Tab-Pause.
 * - Pausiert bei verstecktem Tab (`document.hidden`).
 * - Bei `prefers-reduced-motion` keine Bewegung (rendert `null`); die statische
 *   Stadion-Textur der Skin bleibt über CSS erhalten.
 */

const MAX_BALLS = 2;
const SPRITE_SIZE = 160; // Offscreen-Auflösung des Ball-Sprites (px)

type Phase = "waiting" | "flying";

interface Ball {
  phase: Phase;
  readyAt: number; // ms — Start des nächsten Schusses (im Wartezustand)
  flightStart: number; // ms — Beginn des aktuellen Flugs (für Einblenden)
  x: number; y: number; // px
  vx: number; vy: number; // px/s
  g: number; // px/s² (Schwerkraft)
  angle: number; rad: number; // Rotation + Winkelgeschwindigkeit (rad/s)
  size: number; // gezeichnete Ballgröße (px)
  dir: 1 | -1; // Flugrichtung (1 = nach rechts)
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function regularPentagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) {
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = rot - Math.PI / 2 + (k * 2 * Math.PI) / 5;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Zeichnet einen klassischen Schwarz-Weiß-Fußball (Kugel-Schattierung,
 * zentrales Fünfeck + fünf Außen-Fünfecke, Nähte) einmalig in ein Offscreen-
 * Canvas. `bright` hellt das Weiß für dunkle Hintergründe auf.
 */
function renderBallSprite(bright: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const r = SPRITE_SIZE / 2;
  ctx.translate(r, r);
  const radius = r - 4;

  // Kugel-Schattierung (Lichtquelle oben links).
  const grad = ctx.createRadialGradient(-radius * 0.35, -radius * 0.35, radius * 0.1, 0, 0, radius);
  if (bright) {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#c7c7cd");
  } else {
    grad.addColorStop(0, "#fdfdfd");
    grad.addColorStop(1, "#b9b9c0");
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Auf die Kugel beschneiden, damit Außen-Fünfecke am Rand realistisch abschneiden.
  ctx.save();
  ctx.clip();

  const black = "#1c1c1f";
  const seam = "rgba(28,28,31,0.55)";
  const centerR = radius * 0.34;

  // Nähte vom Zentrum zu den Außen-Panels.
  ctx.strokeStyle = seam;
  ctx.lineWidth = radius * 0.045;
  ctx.lineCap = "round";
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * centerR, Math.sin(a) * centerR);
    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.stroke();
  }

  // Außen-Fünfecke (zwischen den zentralen Ecken, weit am Rand).
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) * 2 * Math.PI) / 5;
    const ox = Math.cos(a) * radius * 0.92;
    const oy = Math.sin(a) * radius * 0.92;
    regularPentagon(ctx, ox, oy, radius * 0.3, a + Math.PI / 5);
    ctx.fillStyle = black;
    ctx.fill();
  }

  // Zentrales Fünfeck.
  regularPentagon(ctx, 0, 0, centerR, 0);
  ctx.fillStyle = black;
  ctx.fill();

  ctx.restore();

  // Feine Außenkontur.
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return c;
}

export default function EventBackdrop() {
  const { active } = useEventTheme();
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => setMounted(true), []);

  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const enabled = mounted && active && !isAdmin && !reduceMotion;

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let darkSprite = renderBallSprite(false); // dunkler Ball für hellen Hintergrund
    let brightSprite = renderBallSprite(true); // heller Ball für dunklen Hintergrund

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    /** Konfiguriert einen neuen Schuss (echte Parabel mit Schwerkraft). */
    const launch = (ball: Ball, now: number) => {
      const fromLeft = Math.random() < 0.5;
      const dir: 1 | -1 = fromLeft ? 1 : -1;
      const size = rand(48, 82);
      const margin = size;
      const x0 = fromLeft ? -margin : width + margin;
      const x1 = fromLeft ? width + margin : -margin;
      const T = rand(5.5, 8); // Sekunden über den Schirm — bewusst langsam
      const y0 = rand(height * 0.6, height * 0.86);
      const apexY = rand(height * 0.12, height * 0.34);
      const riseH = Math.max(40, y0 - apexY);
      const tr = T * rand(0.42, 0.5); // Zeit bis zum Scheitelpunkt
      const g = (2 * riseH) / (tr * tr);
      ball.phase = "flying";
      ball.flightStart = now;
      ball.x = x0;
      ball.y = y0;
      ball.vx = (x1 - x0) / T;
      ball.vy = -g * tr; // Anfangsgeschwindigkeit nach oben
      ball.g = g;
      ball.angle = rand(0, Math.PI * 2);
      ball.rad = dir * rand(1.6, 2.8); // gemächlicher Drall
      ball.size = size;
      ball.dir = dir;
    };

    const now0 = performance.now();
    const balls: Ball[] = [];
    for (let i = 0; i < MAX_BALLS; i++) {
      balls.push({
        phase: "waiting",
        readyAt: now0 + i * rand(2000, 4500) + rand(0, 1500),
        flightStart: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, angle: 0, rad: 0, size: 0, dir: 1,
      });
    }

    let last = now0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05); // s, gegen Sprünge gedeckelt
      last = now;

      const isDark = document.documentElement.classList.contains("dark");
      const sprite = isDark ? brightSprite : darkSprite;
      const baseAlpha = isDark ? 0.2 : 0.14;

      ctx.clearRect(0, 0, width, height);

      for (const ball of balls) {
        if (ball.phase === "waiting") {
          if (now >= ball.readyAt) launch(ball, now);
          continue;
        }

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vy += ball.g * dt;
        ball.angle += ball.rad * dt;

        const margin = ball.size * 1.2;
        const goneX = ball.dir === 1 ? ball.x > width + margin : ball.x < -margin;
        if (goneX || ball.y > height + margin) {
          ball.phase = "waiting";
          ball.readyAt = now + rand(2200, 5000);
          continue;
        }

        // Sanftes Einblenden zu Flugbeginn.
        const fadeIn = Math.min(1, (now - ball.flightStart) / 600);

        ctx.save();
        ctx.globalAlpha = baseAlpha * fadeIn;
        ctx.translate(ball.x, ball.y);
        ctx.rotate(ball.angle);
        ctx.drawImage(sprite, -ball.size / 2, -ball.size / 2, ball.size, ball.size);
        ctx.restore();
      }
    };

    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      darkSprite = brightSprite = null as unknown as HTMLCanvasElement;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
