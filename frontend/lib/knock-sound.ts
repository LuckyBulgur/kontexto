/**
 * An easter egg: whoever types "klopfen" as a guess hears a knock on a door.
 *
 * Played on submit, in every mode that uses `GuessInput`, before the server
 * has answered, so the knock lands on the Enter key and not a round trip
 * later. It has nothing to do with the round: the guess goes on exactly as
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
