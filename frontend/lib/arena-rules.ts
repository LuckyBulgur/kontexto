/**
 * The arena rule numbers, mirrored from backend/arena.py.
 *
 * They live here only so the interface can describe a mode before a round
 * exists; nothing on the client enforces them. The server writes every deadline
 * and refuses every late guess, so a stale copy here can make a description
 * wrong but never a round.
 */

/** backend/arena.py: ROYALE_PHASE_SECONDS */
export const ROYALE_PHASE_SECONDS = [180, 120, 90, 60, 45, 30] as const;
/** backend/arena.py: ROYALE_MAX_PLAYERS */
export const ROYALE_MAX_PLAYERS = 8;
/**
 * backend/arena.py: MIN_PLAYERS and MAX_PLAYERS.
 *
 * Deliberately not the same as the queue's PARTY_RULES. The random queue holds a
 * Battle Royale back until three people are waiting, because two strangers in a
 * mode built around elimination is a bad first impression. A private lobby knows
 * better than the server what it wants and may start at two.
 */
export const ARENA_MIN_PLAYERS = 2;
export const ARENA_MAX_PLAYERS = 8;
/** backend/arena.py: BLITZ_SECONDS */
export const BLITZ_SECONDS = 120;
/** backend/arena.py: TIMERUSH_START_SECONDS */
export const TIMERUSH_START_SECONDS = 60;
/** backend/arena.py: TIMERUSH_BONUS_SECONDS */
export const TIMERUSH_BONUS_SECONDS = 8;
