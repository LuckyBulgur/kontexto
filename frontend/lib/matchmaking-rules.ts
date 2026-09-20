import { QueueModeId } from "./matchmaking-types";

/**
 * When a round of each mode starts, mirrored from `PARTY_RULES` in
 * backend/matchmaking.py.
 *
 * The copy exists so the mode list can say "ab 3, bis zu 8" before the player
 * has joined any queue, without an extra request. Nothing on the client decides
 * anything: once a ticket exists, the waiting screen uses the numbers the server
 * sent with it, so a stale copy here can make a preview wrong but never a round.
 */
export const PARTY_RULES: Record<QueueModeId, { min: number; max: number; graceSeconds: number }> = {
  duel: { min: 2, max: 2, graceSeconds: 0 },
  wordle_duel: { min: 2, max: 2, graceSeconds: 0 },
  blitz: { min: 2, max: 8, graceSeconds: 12 },
  koop: { min: 2, max: 4, graceSeconds: 15 },
  timerush: { min: 2, max: 8, graceSeconds: 15 },
  royale: { min: 3, max: 8, graceSeconds: 25 },
};

/** "Genau 2 Spieler" or "3 bis 8 Spieler", for the mode list. */
export function partySizeLabel(rule: { min: number; max: number }): string {
  return rule.min === rule.max
    ? `Genau ${rule.min} Spieler`
    : `${rule.min} bis ${rule.max} Spieler`;
}

/**
 * What the queue is waiting for right now, in one sentence.
 *
 * Three states, because they are three different things to be told: not enough
 * people yet, enough but still hoping for more, and about to start.
 */
export function waitingSentence(
  waiting: number,
  rule: { min_players: number; max_players: number; grace_seconds: number }
): string {
  if (waiting < rule.min_players) {
    const missing = rule.min_players - waiting;
    return missing === 1
      ? "Es fehlt noch eine Person."
      : `Es fehlen noch ${missing} Personen.`;
  }
  if (rule.grace_seconds > 0 && waiting < rule.max_players) {
    return `Genug Leute da. Wir warten noch kurz auf mehr, höchstens ${rule.grace_seconds} Sekunden.`;
  }
  return "Genug Leute da, es geht gleich los.";
}
