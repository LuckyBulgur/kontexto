/**
 * The one AudioContext of the easter eggs, and the call that unlocks it.
 *
 * Kept apart from `sound.ts` and imported statically by `lib/events/hooks.ts`,
 * because browsers (Safari above all) start audio only when the context is
 * created or resumed inside the user gesture itself. The rest of the egg code
 * arrives by dynamic import, a promise tick too late for that, so the submit
 * handler unlocks here synchronously and the sound plays a moment later.
 */

let context: AudioContext | null = null;

export function eggAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  return context;
}

/** Call inside a user gesture: creates or resumes the context. */
export function unlockEggAudio(): void {
  const ctx = eggAudioContext();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => undefined);
}
