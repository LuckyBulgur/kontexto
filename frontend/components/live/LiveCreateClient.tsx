"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Panel, Wordmark } from "@/components/design";
import { createLive } from "@/lib/live-api";
import { normaliseChannel } from "@/lib/live-channel";

/**
 * Opening a stream-chat room.
 *
 * One field carries the whole mode: the channel name. There is no login, no
 * OAuth redirect and no bot to invite, because the server only ever reads the
 * chat, and Twitch lets anybody do that anonymously. The cost of that is the one
 * rule below the field: a channel can only have one room at a time, first come.
 *
 * YouTube and TikTok are shown and disabled rather than hidden, because "not
 * yet" is an answer and an absent option is not.
 *
 * There is no nickname field. The host already has a name on this screen, the
 * channel, and it is the name their audience knows them by; a second one would
 * be a field that exists only so that something can be typed into it.
 */
export default function LiveCreateClient() {
  const [channel, setChannel] = useState("");
  const [gameSource, setGameSource] = useState<"today" | "random">("random");
  const [tipsAllowed, setTipsAllowed] = useState(true);
  const [requirePrefix, setRequirePrefix] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalised = normaliseChannel(channel);
  const channelTouched = channel.trim().length > 0;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalised || loading) return;

    setLoading(true);
    setError(null);
    try {
      const room = await createLive(normalised, {
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
        setError("Diesen Kanalnamen gibt es auf Twitch nicht.");
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
                <Button type="button" variant="default" className="w-full">
                  {"Twitch"}
                </Button>
                <Button type="button" variant="outline" className="w-full" disabled>
                  {"YouTube"}
                </Button>
                <Button type="button" variant="outline" className="w-full" disabled>
                  {"TikTok"}
                </Button>
              </div>
              <p className="text-micro text-muted-foreground/80">
                {"YouTube und TikTok kommen später, beide brauchen mehr als einen Kanalnamen."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel">{"Dein Twitch-Kanal"}</Label>
              <Input
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="z. B. kontexto"
                maxLength={120}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="channel-hint"
              />
              <p id="channel-hint" className="text-micro text-muted-foreground/80">
                {channelTouched && !normalised
                  ? "Das kann kein Twitch-Kanal sein. Vier bis 25 Zeichen, Buchstaben, Ziffern und Unterstrich."
                  : normalised
                    ? `Gelesen wird twitch.tv/${normalised}`
                    : "Der Name oder die ganze URL, beides geht."}
              </p>
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
