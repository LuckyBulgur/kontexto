"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Panel, Wordmark } from "@/components/design";
import { createLive, fetchLivePlatforms } from "@/lib/live-api";
import { channelAddress, normaliseChannel } from "@/lib/live-channel";
import { LivePlatform, PLATFORM_NAMES } from "@/lib/live-types";

/** Everything the form says differently per platform. */
const PLATFORM_COPY: Record<
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

/**
 * Opening a stream-chat room.
 *
 * One field carries the whole mode: the channel name. There is no login, no
 * OAuth redirect and no bot to invite, because the server only ever reads the
 * chat: Twitch lets anybody do that anonymously, and TikTok is read through a
 * provider the server holds a key for. The cost of that is the one rule below
 * the field: a channel can only have one room at a time, first come.
 *
 * Which platforms are on offer is asked from the server when the form opens,
 * because TikTok depends on that key and the page is a static export. YouTube
 * is shown and disabled rather than hidden, because "not yet" is an answer and
 * an absent option is not.
 *
 * There is no nickname field. The host already has a name on this screen, the
 * channel, and it is the name their audience knows them by; a second one would
 * be a field that exists only so that something can be typed into it.
 */
export default function LiveCreateClient() {
  const [platform, setPlatform] = useState<LivePlatform>("twitch");
  // Twitch needs nothing from the operator, so it is on offer before the answer
  // arrives and when the question fails.
  const [available, setAvailable] = useState<LivePlatform[]>(["twitch"]);
  const [channel, setChannel] = useState("");
  const [gameSource, setGameSource] = useState<"today" | "random">("random");
  const [tipsAllowed, setTipsAllowed] = useState(true);
  const [requirePrefix, setRequirePrefix] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLivePlatforms()
      .then((platforms) => {
        if (!cancelled && platforms.length > 0) setAvailable(platforms);
      })
      .catch(() => {
        // Stay on Twitch only; the create call would refuse TikTok anyway.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tiktokAvailable = available.includes("tiktok");
  const copy = PLATFORM_COPY[platform];
  const normalised = normaliseChannel(channel, platform);
  const channelTouched = channel.trim().length > 0;

  const choosePlatform = (next: LivePlatform) => {
    setPlatform(next);
    setError(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalised || loading) return;

    setLoading(true);
    setError(null);
    try {
      const room = await createLive(platform, normalised, {
        gameSource,
        tipsAllowed,
        requirePrefix,
      });
      // The same key the koop board reads, because a live room is a koop room
      // and the board is the same component.
      localStorage.setItem(`kontexto_koop_${room.koop_id}`, room.player_token);
      localStorage.setItem(`kontexto_live_${room.koop_id}`, room.overlay_token);
      window.location.href = `/live/${room.koop_id}/`;
    } catch (e) {
      if (e instanceof Error && e.message === "channel_busy") {
        setError("Für diesen Kanal läuft schon eine Runde. Warte, bis sie vorbei ist.");
      } else if (e instanceof Error && e.message === "bad_channel") {
        setError(`Diesen Kanalnamen gibt es auf ${PLATFORM_NAMES[platform]} nicht.`);
      } else if (e instanceof Error && e.message === "platform_full") {
        setError(
          "Gerade laufen zu viele TikTok-Runden gleichzeitig. Versuch es in ein paar Minuten noch mal."
        );
      } else if (e instanceof Error && e.message === "platform_unavailable") {
        setError(`${PLATFORM_NAMES[platform]} ist gerade nicht angebunden.`);
        setAvailable((current) => current.filter((p) => p !== platform));
        setPlatform("twitch");
      } else {
        setError("Die Runde konnte nicht gestartet werden");
      }
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <header className="relative flex flex-col items-center px-4 pt-5 pb-1">
        <div className="relative flex items-center justify-center w-full">
          <a href="/" className="absolute left-4">
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Zurück">
              <ArrowLeft className="h-6! w-6!" />
            </Button>
          </a>
          <Wordmark />
        </div>
        <h1 className="mt-2 text-h1">{"Mit dem Stream-Chat spielen"}</h1>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5">
        <form onSubmit={handleCreate}>
          <Panel className="gap-5">
            <p className="text-small text-muted-foreground">
              {`Trag deinen Kanal ein, dann liest der Server deinen Chat mit. Jede Nachricht,
              die aus einem einzigen Wort besteht, ist ein Versuch. Dein Publikum braucht
              kein Konto und keinen Link.`}
            </p>

            <div className="space-y-2">
              <Label className="text-micro font-semibold text-muted-foreground">
                {"Plattform"}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={platform === "twitch" ? "default" : "outline"}
                  aria-pressed={platform === "twitch"}
                  onClick={() => choosePlatform("twitch")}
                  className="w-full"
                >
                  {"Twitch"}
                </Button>
                <Button
                  type="button"
                  variant={platform === "tiktok" ? "default" : "outline"}
                  aria-pressed={platform === "tiktok"}
                  onClick={() => choosePlatform("tiktok")}
                  disabled={!tiktokAvailable}
                  className="w-full"
                >
                  {"TikTok"}
                </Button>
                <Button type="button" variant="outline" className="w-full" disabled>
                  {"YouTube"}
                </Button>
              </div>
              <p className="text-micro text-muted-foreground/80">
                {tiktokAvailable
                  ? "YouTube kommt später, dort braucht das Mitlesen eine Anmeldung pro Kanal."
                  : "TikTok ist gerade nicht angebunden. YouTube kommt später."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel">{copy.label}</Label>
              <Input
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder={copy.placeholder}
                maxLength={120}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="channel-hint"
              />
              <p id="channel-hint" className="text-micro text-muted-foreground/80">
                {channelTouched && !normalised
                  ? copy.invalid
                  : normalised
                    ? `Gelesen wird ${channelAddress(normalised, platform)}`
                    : copy.hint}
              </p>
              {platform === "tiktok" && (
                <p className="text-micro text-muted-foreground/80">
                  {`Du kannst die Runde schon vor dem Livegang starten, sie verbindet sich,
                  sobald du live bist. Den Chat liest der Server über den Dienst Euler Stream
                  mit, dein Konto bleibt unberührt.`}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{"Spiel"}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={gameSource === "random" ? "default" : "outline"}
                  onClick={() => setGameSource("random")}
                  className="w-full"
                >
                  {"Zufälliges Spiel"}
                </Button>
                <Button
                  type="button"
                  variant={gameSource === "today" ? "default" : "outline"}
                  onClick={() => setGameSource("today")}
                  className="w-full"
                >
                  {"Heutiges Spiel"}
                </Button>
              </div>
              <p className="text-micro text-muted-foreground/80">
                {`Ein zufälliges Spiel ist die Vorgabe, damit du das heutige Rätsel nicht vor
                laufender Kamera verrätst.`}
              </p>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="prefix">{"Nur Nachrichten mit !k"}</Label>
                <p className="mt-1 text-micro text-muted-foreground/80">
                  {`Aus für freies Raten, das ist lebendiger. An, wenn dein Chat so voll ist,
                  dass jedes zweite Wort im Spiel landet.`}
                </p>
              </div>
              <Switch
                id="prefix"
                checked={requirePrefix}
                onCheckedChange={setRequirePrefix}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="tips">{"Tipps erlauben"}</Label>
              <Switch id="tips" checked={tipsAllowed} onCheckedChange={setTipsAllowed} />
            </div>

            {error && <p className="text-small text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={loading || !normalised}
              className="w-full"
            >
              {loading ? "Wird gestartet..." : "Runde starten"}
            </Button>
          </Panel>
        </form>
      </main>
    </div>
  );
}
