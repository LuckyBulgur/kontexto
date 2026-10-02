/**
 * What the stream-chat forms say per platform: the create form and the
 * sidebar that adds a second chat to a running room use the same words.
 */

import type { LivePlatform } from "./live-types";

/** Everything the form says differently per platform. */
export const PLATFORM_COPY: Record<
  LivePlatform,
  { label: string; placeholder: string; hint: string; invalid: string }
> = {
  twitch: {
    label: "Dein Twitch-Kanal",
    placeholder: "z. B. kontexto",
    hint: "Der Name oder die ganze URL, beides geht.",
    invalid:
      "Das kann kein Twitch-Kanal sein. Vier bis 25 Zeichen, Buchstaben, Ziffern und Unterstrich.",
  },
  tiktok: {
    label: "Dein TikTok-Name",
    placeholder: "z. B. @kontexto",
    hint: "Mit oder ohne @, oder der Link zu deinem Profil.",
    invalid:
      "Das kann kein TikTok-Name sein. Zwei bis 24 Zeichen, Buchstaben, Ziffern, Punkt und Unterstrich.",
  },
};

/** The note under a TikTok field: when it connects, and through whom. */
export const TIKTOK_NOTE = `Du kannst die Runde schon vor dem Livegang starten, sie verbindet sich,
sobald du live bist. Den Chat liest der Server über den Dienst Euler Stream
mit, dein Konto bleibt unberührt.`;

/**
 * The way out for a streamer whose channel still holds a round, said by
 * `components/live/ChannelBusyNotice.tsx` wherever the streamer can be told so.
 *
 * The streamer writes the word in their own chat and the server unbinds the
 * round (`backend/live_chat.is_stop_command`, recognised only from the channel
 * owner). It used to be one red sentence under the form, which streamers read
 * past: the word to type is the largest thing on the screen now, and the create
 * form waits for it by itself.
 */
export const CHANNEL_BUSY_COPY = {
  headline: "Auf deinem Kanal läuft noch eine Runde",
  instruction: "Schreib dieses Wort in deinen eigenen Chat:",
  word: "stop",
  copy: "Kopieren",
  copied: "Kopiert",
  tiktokLive: "Auf TikTok kommt es nur an, während du live bist.",
  waiting: "Sobald dein „stop“ im Chat steht, startet die neue Runde hier von selbst.",
  fallback:
    "Hast du die alte Seite geschlossen, wird der Kanal nach etwa fünf Minuten auch ohne „stop“ frei.",
  expired: "Der Kanal ist immer noch belegt. Schreib „stop“ in deinen Chat und prüf dann noch mal.",
  retry: "Noch mal prüfen",
  cancel: "Abbrechen",
  addChat: "Danach kannst du den Chat hier hinzufügen.",
  landingHeadline: "Ist das deine Runde und du kommst nicht mehr rein?",
  landingFootnote: "Dann ist die alte Runde beendet und du kannst sofort eine neue starten.",
} as const;

/** The same, said in advance on the host page, before anybody is locked out. */
export const STOP_HINT_AHEAD =
  "Kommst du nicht mehr auf diese Seite, schreib „stop“ in deinen eigenen Chat. Dann ist die Runde beendet.";

/**
 * The guest link (`lib/live-invite.ts`): the host's copy button, its renewal in
 * the sidebar and what a guest reads. No sentence here contains the link
 * itself, because the host page is on stream.
 */
export const GUEST_LINK_COPY = {
  button: "Mitspiel-Link",
  buttonLabel: "Mitspiel-Link kopieren",
  copied: "Mitspiel-Link kopiert. Wer ihn öffnet, rät im Browser mit.",
  copyFailed: "Kopieren hat nicht geklappt. Erlaub der Seite den Zugriff auf die Zwischenablage.",
  sectionTitle: "Mitspieler im Browser",
  sectionHint:
    "Den Mitspiel-Link oben kannst du privat weitergeben. Wer ihn öffnet, rät auf deinem Brett mit, ohne Chat.",
  renew: "Neuen Link erzeugen",
  renewTitle: "Neuen Mitspiel-Link erzeugen?",
  renewDescription:
    "Der bisherige Link lässt danach niemanden mehr herein. Wer schon miträt, bleibt dabei. Der neue Link landet direkt in deiner Zwischenablage.",
  renewConfirm: "Neuen Link erzeugen",
  renewCancel: "Abbrechen",
  renewed: "Neuer Mitspiel-Link kopiert. Der alte gilt nicht mehr.",
  renewedNotCopied: "Neuer Mitspiel-Link erzeugt. Kopier ihn oben mit „Mitspiel-Link“.",
  renewFailed: "Der Link konnte nicht erneuert werden.",
  joinTitle: "Bei der Stream-Runde mitraten",
  joinDescription: "Du rätst auf dem Brett des Streams mit, neben dem Chat. Nur Raten, die Runde steuert der Streamer.",
  expired: "Dieser Mitspiel-Link gilt nicht mehr. Frag nach einem neuen.",
  full: "Die Runde ist voll. Frag später noch mal.",
  guestLabel: "Stream-Runde",
} as const;

/** "Noch niemand", "1 Person", "3 Personen": the guest count in the sidebar. */
export function guestCountText(guests: number): string {
  if (guests <= 0) return "Noch niemand dabei.";
  return guests === 1 ? "1 Person rät mit." : `${guests} Personen raten mit.`;
}
