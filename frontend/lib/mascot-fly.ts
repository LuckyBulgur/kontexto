"use client";

import { MASCOTS, MASCOT_FLIGHT_MS, MascotGate, type MascotKind } from "@/lib/mascot";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Plays one mascot flight across the viewport.
 *
 * Imperative on purpose: a layer appended to `<body>`, outside the React tree,
 * so no client has to mount anything and nothing in the page shifts. Fixed,
 * `z-index: 40` (above the page, under dialogs at 50 and the toasts), never
 * catching a pointer and hidden from assistive technology. Removed by a timer
 * rather than `animationend`, because a background tab may never deliver the
 * event. Nothing plays under reduced motion.
 */

const gate = new MascotGate();

export function flyMascot(kind: MascotKind): void {
  if (prefersReducedMotion()) return;
  if (!gate.admit(kind, Date.now())) return;

  const mascot = MASCOTS[kind];
  const layer = document.createElement("div");
  layer.className = "mascot-layer";
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.mascot = kind;

  const img = document.createElement("img");
  img.src = mascot.src;
  img.alt = "";
  img.width = mascot.width;
  img.height = mascot.height;
  img.decoding = "async";
  img.className = Math.random() < 0.5 ? "mascot-flight" : "mascot-flight mascot-flight-reverse";
  img.style.top = `${Math.round(15 + Math.random() * 40)}%`;

  layer.appendChild(img);
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), MASCOT_FLIGHT_MS + 250);
}
