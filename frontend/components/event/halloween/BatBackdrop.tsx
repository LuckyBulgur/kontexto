"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Spooktober background: now and then a bat flutters across the page on a
 * wavy path. Sparse, slow and faint, behind every piece of content,
 * `pointer-events: none` and `aria-hidden`.
 *
 * Built on the same technique as the football backdrop of the WM skin before
 * it: canvas plus requestAnimationFrame, sharp at the device pixel ratio,
 * time-based integration with a clamped `dt` so a paused tab does not jump,
 * paused while the tab is hidden, and nothing at all under reduced motion.
 * The wings are drawn procedurally each frame, which for three bats is
 * cheaper than keeping sprites.
 *
 * `busy` (the witching hour and Halloween itself) lets more bats out, more
 * often.
 */

interface Bat {
  flying: boolean;
  readyAt: number;
  startedAt: number;
  x: number;
  baseY: number;
  vx: number;
  amplitude: number;
  wobble: number;
  phase: number;
  flapRate: number;
  size: number;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** A bat seen from the front, wings at `lift` (-1 down, 1 up), centred on 0,0. */
function drawBat(ctx: CanvasRenderingContext2D, size: number, lift: number): void {
  const w = size / 2;
  const tip = -lift * size * 0.32;
  ctx.beginPath();
  // Left wing, scalloped trailing edge.
  ctx.moveTo(-size * 0.08, -size * 0.05);
  ctx.quadraticCurveTo(-w * 0.55, tip - size * 0.18, -w, tip);
  ctx.quadraticCurveTo(-w * 0.8, tip + size * 0.1, -w * 0.62, tip + size * 0.14);
  ctx.quadraticCurveTo(-w * 0.45, size * 0.02, -w * 0.3, size * 0.12);
  ctx.quadraticCurveTo(-w * 0.2, size * 0.04, -size * 0.08, size * 0.12);
  // Body.
  ctx.quadraticCurveTo(0, size * 0.24, size * 0.08, size * 0.12);
  // Right wing, mirrored.
  ctx.quadraticCurveTo(w * 0.2, size * 0.04, w * 0.3, size * 0.12);
  ctx.quadraticCurveTo(w * 0.45, size * 0.02, w * 0.62, tip + size * 0.14);
  ctx.quadraticCurveTo(w * 0.8, tip + size * 0.1, w, tip);
  ctx.quadraticCurveTo(w * 0.55, tip - size * 0.18, size * 0.08, -size * 0.05);
  // Ears.
  ctx.lineTo(size * 0.07, -size * 0.17);
  ctx.lineTo(size * 0.02, -size * 0.09);
  ctx.lineTo(-size * 0.02, -size * 0.09);
  ctx.lineTo(-size * 0.07, -size * 0.17);
  ctx.closePath();
  ctx.fill();
}

export default function BatBackdrop({ busy }: { busy: boolean }) {
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const count = busy ? 3 : 2;
    const pause: [number, number] = busy ? [4000, 9000] : [9000, 20000];

    let raf = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const launch = (bat: Bat, now: number) => {
      const fromLeft = Math.random() < 0.5;
      bat.flying = true;
      bat.startedAt = now;
      bat.size = rand(22, 38);
      bat.x = fromLeft ? -bat.size : width + bat.size;
      bat.vx = (fromLeft ? 1 : -1) * rand(70, 120);
      bat.baseY = rand(height * 0.08, height * 0.45);
      bat.amplitude = rand(18, 46);
      bat.wobble = rand(1.2, 2.2);
      bat.phase = rand(0, Math.PI * 2);
      bat.flapRate = rand(9, 13);
    };

    const now0 = performance.now();
    const bats: Bat[] = Array.from({ length: count }, (_, i) => ({
      flying: false,
      readyAt: now0 + 1500 + i * rand(2500, 6000),
      startedAt: 0,
      x: 0,
      baseY: 0,
      vx: 0,
      amplitude: 0,
      wobble: 0,
      phase: 0,
      flapRate: 0,
      size: 0,
    }));

    let last = now0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const dark = document.documentElement.classList.contains("dark");
      ctx.clearRect(0, 0, width, height);
      // On the night sky a black bat vanishes; a dusky violet one reads as a
      // silhouette against the moonlight without drawing the eye.
      ctx.fillStyle = dark ? "rgb(92, 72, 122)" : "rgb(40, 28, 52)";
      const alpha = dark ? 0.4 : 0.2;

      for (const bat of bats) {
        if (!bat.flying) {
          if (now >= bat.readyAt) launch(bat, now);
          continue;
        }
        bat.x += bat.vx * dt;
        const t = (now - bat.startedAt) / 1000;
        const y = bat.baseY + Math.sin(t * bat.wobble + bat.phase) * bat.amplitude;
        if (bat.x < -bat.size * 2 || bat.x > width + bat.size * 2) {
          bat.flying = false;
          bat.readyAt = now + rand(pause[0], pause[1]);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = alpha * Math.min(1, t / 0.6);
        ctx.translate(bat.x, y);
        drawBat(ctx, bat.size, Math.sin(t * bat.flapRate));
        ctx.restore();
      }
    };

    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [busy, reduceMotion]);

  if (reduceMotion) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
