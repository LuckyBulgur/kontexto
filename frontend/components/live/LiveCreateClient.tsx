"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Panel, Wordmark } from "@/components/design";
import CategoryPicker from "@/components/categories/CategoryPicker";
import {
  CategorySetup,
  DEFAULT_CATEGORY_SETUP,
  loadCategorySetup,
  normalizeSetup,
  saveCategorySetup,
} from "@/lib/categories";
import { useCategoryCatalogue } from "@/lib/use-category-catalogue";
import { createLive, fetchLivePlatforms, LiveApiError } from "@/lib/live-api";
import { channelAddress, normaliseChannel, readyChannels } from "@/lib/live-channel";
import { PLATFORM_COPY, STOP_HINT, TIKTOK_NOTE } from "@/lib/live-copy";
import { LIVE_PLATFORMS, LivePlatform, PLATFORM_NAMES } from "@/lib/live-types";

/**
 * Opening a stream-chat room.
 *
 * One field per chat carries the whole mode: the channel name. A streamer who
 * multistreams ticks Twitch and TikTok and gets one board for both audiences;
 * a second chat can also be added from the room later. There is no login, no
 * OAuth redirect and no bot to invite, because the server only ever reads the
 * chat: Twitch lets anybody do that anonymously, and TikTok is read through a
 * provider the server holds a key for. The cost of that is the one rule below
 * the fields: a channel can only have one room at a time, first come.
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
  // Which chats play. Toggles rather than a single choice, because a stream
  // that runs on both platforms wants both; Twitch alone is the default.
  const [selected, setSelected] = useState<LivePlatform[]>(["twitch"]);
  // Twitch needs nothing from the operator, so it is on offer before the answer
  // arrives and when the question fails.
  const [available, setAvailable] = useState<LivePlatform[]>(["twitch"]);
  const [inputs, setInputs] = useState<Partial<Record<LivePlatform, string>>>({});
  // "categories" is a random game from the chosen fields; see RoomCreateClient.
  const [gameSource, setGameSource] = useState<"today" | "random" | "categories">("random");
  const [categorySetup, setCategorySetup] = useState<CategorySetup>(DEFAULT_CATEGORY_SETUP);
  const usesCategories = gameSource === "categories";
  const { catalogue, failed, retry } = useCategoryCatalogue(usesCategories);

  useEffect(() => {
    const stored = loadCategorySetup();
    if (stored) setCategorySetup(stored);
  }, []);

  useEffect(() => {
    if (catalogue) setCategorySetup((current) => normalizeSetup(current, catalogue));
  }, [catalogue]);
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
  // Kept in the fixed platform order whatever the click order, so the first
  // chat, whose name the host plays under, is always the same one.
  const chosen = LIVE_PLATFORMS.filter((p) => selected.includes(p));
  const ready = readyChannels(chosen, inputs);

  const togglePlatform = (next: LivePlatform) => {
    setSelected((current) =>
      current.includes(next) ? current.filter((p) => p !== next) : [...current, next]
    );
    setError(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || loading) return;

    setLoading(true);
    setError(null);
    const categories = usesCategories ? categorySetup : null;
    if (categories) saveCategorySetup(categories);
    try {
      const room = await createLive(ready, {
        gameSource: gameSource === "today" ? "today" : "random",
        tipsAllowed,
        requirePrefix,
        categories,
      });
      // The same key the koop board reads, because a live room is a koop room
      // and the board is the same component.
      localStorage.setItem(`kontexto_koop_${room.koop_id}`, room.player_token);
      localStorage.setItem(`kontexto_live_${room.koop_id}`, room.overlay_token);
      window.location.href = `/live/${room.koop_id}/`;
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      // The refusal names its chat; with one chat ticked it can only be that one.
      const about =
        (e instanceof LiveApiError ? e.platform : null) ??
        (chosen.length === 1 ? chosen[0] : null);
      const name = about ? PLATFORM_NAMES[about] : null;
      if (code === "channel_busy") {
        setError(
          name && chosen.length > 1
            ? `Für diesen ${name}-Kanal läuft schon eine Runde. ${STOP_HINT}`
            : `Für diesen Kanal läuft schon eine Runde. ${STOP_HINT}`
        );
      } else if (code === "bad_channel") {
        setError(
          name ? `Diesen Kanalnamen gibt es auf ${name} nicht.` : "Einen der Kanalnamen gibt es nicht."
        );
      } else if (code === "platform_full") {
        setError(
          "Gerade laufen zu viele TikTok-Runden gleichzeitig. Versuch es in ein paar Minuten noch mal."
        );
      } else if (code === "platform_unavailable" && about) {
        setError(`${PLATFORM_NAMES[about]} ist gerade nicht angebunden.`);
        setAvailable((current) => current.filter((p) => p !== about));
        setSelected((current) => current.filter((p) => p !== about));
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
              <Label id="platforms-label" className="text-micro font-semibold text-muted-foreground">
                {"Welche Chats raten mit?"}
              </Label>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="platforms-label">
                <Button
                  type="button"
                  variant={selected.includes("twitch") ? "default" : "outline"}
                  aria-pressed={selected.includes("twitch")}
                  onClick={() => togglePlatform("twitch")}
                  className="w-full"
                >
                  {"Twitch"}
                </Button>
                <Button
                  type="button"
                  variant={selected.includes("tiktok") ? "default" : "outline"}
                  aria-pressed={selected.includes("tiktok")}
                  onClick={() => togglePlatform("tiktok")}
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
                {chosen.length === 0
                  ? "Wähl mindestens einen Chat aus."
                  : tiktokAvailable
                    ? "Streamst du auf beiden, wähl beide: Dann raten beide Chats auf einem Brett. YouTube kommt später."
                    : "TikTok ist gerade nicht angebunden. YouTube kommt später."}
              </p>
            </div>

            {chosen.map((platform) => (
              <ChannelField
                key={platform}
                platform={platform}
                value={inputs[platform] ?? ""}
                onChange={(value) => setInputs((current) => ({ ...current, [platform]: value }))}
              />
            ))}

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
                <Button
                  type="button"
                  variant={usesCategories ? "default" : "outline"}
                  onClick={() => setGameSource("categories")}
                  className="col-span-2 w-full"
                >
                  {"Aus Kategorien"}
                </Button>
              </div>
              <p className="text-micro text-muted-foreground/80">
                {`Ein zufälliges Spiel ist die Vorgabe, damit du das heutige Rätsel nicht vor
                laufender Kamera verrätst. Mit Kategorien steht die Kategorie auf Wunsch auch
                im Overlay.`}
              </p>
            </div>

            {usesCategories && (
              <CategoryPicker
                idPrefix="live"
                value={categorySetup}
                onChange={setCategorySetup}
                catalogue={catalogue}
                failed={failed}
                onRetry={retry}
              />
            )}

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
              disabled={loading || !ready || (usesCategories && !catalogue)}
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

/** One channel field, with a hint that reads the name back or says why not. */
function ChannelField({
  platform,
  value,
  onChange,
}: {
  platform: LivePlatform;
  value: string;
  onChange: (value: string) => void;
}) {
  const copy = PLATFORM_COPY[platform];
  const normalised = normaliseChannel(value, platform);
  const touched = value.trim().length > 0;
  const id = `channel-${platform}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{copy.label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={copy.placeholder}
        maxLength={120}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-describedby={`${id}-hint`}
        aria-invalid={touched && !normalised}
      />
      <p id={`${id}-hint`} className="text-micro text-muted-foreground/80">
        {touched && !normalised
          ? copy.invalid
          : normalised
            ? `Gelesen wird ${channelAddress(normalised, platform)}`
            : copy.hint}
      </p>
      {platform === "tiktok" && (
        <p className="text-micro text-muted-foreground/80">{TIKTOK_NOTE}</p>
      )}
    </div>
  );
}
