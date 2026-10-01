/**
 * An easter egg: whoever types "klopfen" as a guess hears a knock on a door.
 *
 * It knocks however the word got onto the board: typed here, played by a
 * teammate in a koop, or written in the stream chat of a live room, where the
 * host page plays it and the stream carries it. Typed here it plays on
 * submit, before the server has answered, so the knock lands on the Enter key
 * and not a round trip later; another player's word knocks when it arrives
 * (`knocksForArrival`). Duel and arena never send an opponent's word to the
 * client, which is the point of those modes, so there only your own typing
 * knocks. It has nothing to do with the round: the guess goes on exactly as
 * any other.
 *
 * The file (`public/sounds/klopfen.mp3`) is prepared for this, not used raw:
 * mono, leading silence cut, levelled to about -25 LUFS with true peaks at
 * -6 dBFS, so it never clips. On top of that it plays at KNOCK_VOLUME, because
 * a game page is usually quiet and a knock at full level would startle.
 *
 * The submit is the user gesture browsers ask for before audio may play; a
 * refusal anyway (a browser policy, no output device) is swallowed, because a
 * missing easter egg is not an error the player should see.
 */

export const KNOCK_WORD = "klopfen";
export const KNOCK_SRC = "/sounds/klopfen.mp3";
export const KNOCK_VOLUME = 0.6;

/** Whether a typed guess is the knock word, in any case and with stray spaces. */
export function isKnockWord(input: string): boolean {
  return input.trim().toLocaleLowerCase("de-DE") === KNOCK_WORD;
}

/**
 * Whether a word that arrived on a shared board from somebody else knocks.
 * Your own word already knocked on submit, and a tip is the game's word, not
 * a player's. A koop board takes each word once, so a chat that spams the
 * word knocks once per round.
 */
export function knocksForArrival(
  arrival: { word: string; by: string | null | undefined; isTip: boolean },
  ownNickname: string | null
): boolean {
  if (arrival.isTip || !isKnockWord(arrival.word)) return false;
  return !ownNickname || arrival.by !== ownNickname;
}

let audio: HTMLAudioElement | null = null;

/** Knock once. A second knock while the first still sounds starts it over. */
export function playKnock(): void {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  if (!audio) {
    audio = new Audio(KNOCK_SRC);
    audio.preload = "auto";
  }
  audio.volume = KNOCK_VOLUME;
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Blocked or no output device: the knock is a bonus, nothing to report.
  });
}
