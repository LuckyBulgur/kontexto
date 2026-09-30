"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BatGlyph, CatGlyph, GhostGlyph, HandGlyph, SmokeGlyph, SpiderGlyph, WitchGlyph } from "./art";
import { removeActor, useStage, type Actor, type ActorKind } from "./stage-store";

/**
 * The layer every creature is played on: fixed, above the page, under dialogs
 * and toasts, never catching a pointer and hidden from assistive technology.
 *
 * Each actor is one CSS keyframe that runs once (`app/event-halloween.css`),
 * and it leaves the stage after its own duration. A timer rather than
 * `animationend`, because a swarm is several animations and a background tab
 * may never deliver the event.
 */

/** Keep in step with the keyframe durations in app/event-halloween.css. */
const DURATION_MS: Record<ActorKind, number> = {
  ghost: 6000,
  bats: 1800,
  spider: 4600,
  witch: 6500,
  cat: 7000,
  hand: 3400,
  smoke: 1200,
};

const SWARM_SIZE = 6;

type BatFlight = { tx: number; ty: number; delay: number };

/**
 * A fan of flights away from the point: upwards from the middle of the screen,
 * downwards from a point near the top (the header pumpkin), so the swarm
 * crosses the page instead of leaving it at once.
 */
function swarm(downward: boolean): BatFlight[] {
  const base = downward ? 0 : Math.PI;
  return Array.from({ length: SWARM_SIZE }, (_, i) => {
    const angle = base + (Math.PI * (i + 0.5)) / SWARM_SIZE + (Math.random() - 0.5) * 0.4;
    const distance = 180 + Math.random() * 220;
    return { tx: Math.cos(angle) * distance, ty: Math.sin(angle) * distance, delay: Math.random() * 180 };
  });
}

function ActorView({ actor }: { actor: Actor }) {
  // Fixed per actor for its lifetime; read once, never during a re-render.
  const [flights] = useState<BatFlight[]>(() =>
    actor.kind === "bats" ? swarm(actor.y < window.innerHeight * 0.25) : [],
  );
  const [spiderX] = useState(() => (actor.x > 0 ? actor.x : window.innerWidth * (0.2 + Math.random() * 0.6)));

  useEffect(() => {
    const timer = window.setTimeout(() => removeActor(actor.id), DURATION_MS[actor.kind] + 250);
    return () => window.clearTimeout(timer);
  }, [actor.id, actor.kind]);

  switch (actor.kind) {
    case "ghost":
      return <GhostGlyph className="spook-actor spook-ghost" />;
    case "witch":
      return <WitchGlyph className="spook-actor spook-witch" />;
    case "cat":
      return <CatGlyph className="spook-actor spook-cat" />;
    case "spider":
      return (
        <div className="spook-actor spook-spider" style={{ left: spiderX }}>
          <SpiderGlyph className="relative block w-full" />
        </div>
      );
    case "hand":
      return <HandGlyph className="spook-actor spook-hand" />;
    case "smoke":
      return (
        <div className="spook-actor spook-smoke" style={{ left: actor.x, top: actor.y }}>
          <SmokeGlyph className="block w-full" />
        </div>
      );
    case "bats":
      return (
        <div className="absolute" style={{ left: actor.x, top: actor.y }}>
          {flights.map((f, i) => (
            <div
              key={i}
              className="spook-actor spook-bat"
              style={{ "--tx": `${f.tx}px`, "--ty": `${f.ty}px`, animationDelay: `${f.delay}ms` } as CSSProperties}
            >
              <BatGlyph className="block w-full" />
            </div>
          ))}
        </div>
      );
  }
}

export default function EffectStage() {
  const { actors } = useStage();
  if (actors.length === 0) return null;
  return (
    <div className="spook-stage" aria-hidden="true">
      {actors.map((actor) =>
        actor.kind === "hand" ? (
          <div key={actor.id} className="absolute inset-y-0" style={{ left: actor.x }}>
            <ActorView actor={actor} />
          </div>
        ) : (
          <ActorView key={actor.id} actor={actor} />
        ),
      )}
    </div>
  );
}
