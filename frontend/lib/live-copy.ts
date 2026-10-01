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
