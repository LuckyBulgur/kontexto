"use client";

import { useSyncExternalStore } from "react";
import { emptyProgress, type SpooktoberProgress } from "@/lib/events/spooktober";

/**
 * State of the Spooktober runtime that React components render: the creatures
 * currently on stage, the flashlight and the player's progress.
 *
 * A plain external store rather than a context, because the controller that
 * writes it is called from outside React (the lazy hooks in
 * `lib/events/hooks.ts`), and the components that read it are mounted in
 * different trees (the layout's runtime and the header buttons).
 */

export type ActorKind =
  | "ghost"
  | "bats"
  | "spider"
  | "witch"
  | "cat"
  | "hand"
  | "smoke"
  | "owl"
  | "wolf"
  | "eyes"
  | "fog"
  | "bubbles";

export interface Actor {
  id: number;
  kind: ActorKind;
  /** Viewport x in px where the actor starts, when it has an origin. */
  x: number;
  /** Viewport y in px where the actor starts, when it has an origin. */
  y: number;
}

export interface StageState {
  actors: readonly Actor[];
  flashlight: boolean;
  /** The pumpkin has been emptied and relights at this time (ms), or 0. */
  pumpkinEmptyUntil: number;
  progress: SpooktoberProgress;
}

let state: StageState = {
  actors: [],
  flashlight: false,
  pumpkinEmptyUntil: 0,
  progress: emptyProgress(),
};

const listeners = new Set<() => void>();

export function getStage(): StageState {
  return state;
}

export function setStage(patch: Partial<StageState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_STATE = state;

export function useStage(): StageState {
  return useSyncExternalStore(subscribe, getStage, () => SERVER_STATE);
}

let nextId = 1;

/** Puts an actor on stage. Returns its id, so the caller can take it off. */
export function addActor(kind: ActorKind, x = 0, y = 0): number {
  const id = nextId;
  nextId += 1;
  setStage({ actors: [...state.actors, { id, kind, x, y }] });
  return id;
}

export function removeActor(id: number): void {
  if (!state.actors.some((a) => a.id === id)) return;
  setStage({ actors: state.actors.filter((a) => a.id !== id) });
}
