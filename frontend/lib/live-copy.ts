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
 * The way out for a streamer who lost the host page.
 *
 * The streamer writes the word in their own chat and the server unbinds the
 * round (`backend/live_chat.is_stop_command`, recognised only from the channel
 * owner). Said wherever the streamer can be told that a round already holds the
 * channel, because without the host page there is no other button to press.
 */
export const STOP_HINT =
  "Schreib „stop“ in deinen eigenen Chat, dann ist die alte Runde beendet und du kannst sofort eine neue starten.";

/** The same, said in advance on the host page, before anybody is locked out. */
export const STOP_HINT_AHEAD =
  "Kommst du nicht mehr auf diese Seite, schreib „stop“ in deinen eigenen Chat. Dann ist die Runde beendet.";
