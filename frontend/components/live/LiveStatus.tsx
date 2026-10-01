"use client";

import { useId, useState, type FormEvent } from "react";
import { Pause, Play, Plus, Radio, Trophy, Unplug } from "lucide-react";
import { Panel } from "@/components/design";
import PlatformMark from "@/components/live/PlatformMark";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { channelAddress, channelLabel, normaliseChannel } from "@/lib/live-channel";
import { PLATFORM_COPY, STOP_HINT_AHEAD, TIKTOK_NOTE } from "@/lib/live-copy";
import {
  ChatState, LiveChannel, LivePlatform, LiveViewer, PLATFORM_NAMES,
} from "@/lib/live-types";
import { cn } from "@/lib/utils";

const STATE_TEXT: Record<ChatState, string> = {
  connecting: "Verbindet sich mit dem Chat …",
  live: "Chat wird mitgelesen",
  error: "Der Chat lässt sich nicht lesen",
};

const PAUSED_TEXT = "Pausiert. Nachrichten aus diesem Chat zählen gerade nicht.";

interface LiveStatusProps {
  channels: LiveChannel[];
  /** Replaces every chat's own line: the round ended, or the server is gone. */
  notice: string | null;
  requirePrefix: boolean;
  top: LiveViewer[];
  /** Whether names carry a platform logo, decided once for the whole page. */
  marks: boolean;
  overlayUrl: string | null;
  onCopyOverlay: () => void;
  /** Platforms the server offers that this room does not read yet. */
  addable: LivePlatform[];
  /** Resolves to a sentence for the form, or null when the chat was added. */
  onAdd: (platform: LivePlatform, channel: string) => Promise<string | null>;
  onRemove: (platform: LivePlatform) => Promise<void>;
  onPause: (platform: LivePlatform, paused: boolean) => Promise<void>;
}

/**
 * The sidebar of a stream-chat room: which chats are read, what they have to
 * do, where the overlay is, and who is carrying the evening.
 *
 * It stands where the koop board shows its player list, because a live room has
 * exactly one player row, the host. The people playing are in the chats, and
 * the honest way to show them is the leaderboard below.
 *
 * Every chat can be paused and resumed here, and a second one added or one of
 * two removed, without touching the round. The sidebar is rendered twice, once
 * per breakpoint, so every id comes from useId.
 */
export default function LiveStatus({
  channels,
  notice,
  requirePrefix,
  top,
  marks,
  overlayUrl,
  onCopyOverlay,
  addable,
  onAdd,
  onRemove,
  onPause,
}: LiveStatusProps) {
  const several = channels.length > 1;
  const locked = notice !== null;

  return (
    <div className="flex w-full flex-col gap-3 md:w-64">
      <Panel padding="sm" className="gap-3">
        {channels.map((channel) => (
          <ChannelRow
            key={channel.platform}
            channel={channel}
            notice={notice}
            marked={several}
            removable={several && !locked}
            controllable={!locked}
            onRemove={onRemove}
            onPause={onPause}
          />
        ))}
        {notice && <p className="text-micro text-muted-foreground">{notice}</p>}
        <p className="text-micro text-muted-foreground/80">
          {`${several ? "Beide Chats raten mit" : "Dein Chat rät mit"}: ${
            requirePrefix ? "!k wort" : "ein Wort pro Nachricht"
          }`}
        </p>
        {!locked && <p className="text-micro text-muted-foreground/80">{STOP_HINT_AHEAD}</p>}
      </Panel>

      {!locked &&
        addable.map((platform) => (
          <AddChannelPanel key={platform} platform={platform} onAdd={onAdd} />
        ))}

      {overlayUrl && (
        <Panel padding="sm" className="gap-2">
          <span className="text-micro font-semibold text-muted-foreground">
            {"Einblendung für OBS"}
          </span>
          <p className="text-micro text-muted-foreground/80">
            {"Als Browserquelle einfügen, 480 mal 640, Hintergrund bleibt transparent."}
          </p>
          <Button variant="outline" size="sm" onClick={onCopyOverlay} className="w-full">
            {"Link kopieren"}
          </Button>
        </Panel>
      )}

      <Panel padding="sm" className="gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-micro font-semibold text-muted-foreground">
            {"Fleißigste im Chat"}
          </span>
        </div>
        {top.length === 0 ? (
          <p className="text-micro text-muted-foreground/80">
            {"Noch hat niemand geraten."}
          </p>
        ) : (
          <ol className="flex list-none flex-col gap-1">
            {top.map((viewer, index) => (
              <li
                key={`${viewer.platform}-${viewer.nickname}-${index}`}
                className="flex items-baseline justify-between gap-2 text-small"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate">{viewer.nickname}</span>
                  {marks && <PlatformMark platform={viewer.platform} />}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {viewer.hits}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function ChannelRow({
  channel,
  notice,
  marked,
  removable,
  controllable,
  onRemove,
  onPause,
}: {
  channel: LiveChannel;
  notice: string | null;
  marked: boolean;
  removable: boolean;
  controllable: boolean;
  onRemove: (platform: LivePlatform) => Promise<void>;
  onPause: (platform: LivePlatform, paused: boolean) => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const name = PLATFORM_NAMES[channel.platform];
  const label = channelLabel(channel.channel, channel.platform);
  const state: ChatState = notice ? "error" : channel.chat_state;

  const run = async (action: () => Promise<void>) => {
    setWorking(true);
    try {
      await action();
    } finally {
      setWorking(false);
    }
  };

  const line = notice
    ? null
    : channel.paused
      ? PAUSED_TEXT
      : // A waiting TikTok chat carries its reason while it is still connecting.
        channel.chat_state !== "live" && channel.chat_error
        ? channel.chat_error
        : STATE_TEXT[channel.chat_state];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Radio
          className={cn(
            "h-4 w-4 shrink-0",
            channel.paused && !notice
              ? "text-muted-foreground"
              : state === "live"
                ? "text-success-ink"
                : state === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
          )}
          aria-hidden
        />
        <span className="min-w-0 truncate font-display text-lead font-bold">{label}</span>
        {marked && <PlatformMark platform={channel.platform} className="ml-auto" />}
      </div>
      {line && <p className="text-micro text-muted-foreground">{line}</p>}
      {controllable && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={working}
            aria-pressed={channel.paused}
            onClick={() => void run(() => onPause(channel.platform, !channel.paused))}
          >
            {channel.paused ? (
              <Play className="size-3.5" aria-hidden />
            ) : (
              <Pause className="size-3.5" aria-hidden />
            )}
            {channel.paused ? "Fortsetzen" : "Pausieren"}
            <span className="sr-only">{` (${name})`}</span>
          </Button>
          {removable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1" disabled={working}>
                  <Unplug className="size-3.5" aria-hidden />
                  {"Trennen"}
                  <span className="sr-only">{` (${name})`}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{`${name}-Chat trennen?`}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {`${label} rät danach nicht mehr mit. Die Runde und die Bestenliste bleiben, der andere Chat rät weiter. Du kannst ${name} später wieder verbinden. Nur kurz aussetzen geht mit „Pausieren“.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{"Abbrechen"}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => void run(() => onRemove(channel.platform))}
                  >
                    {"Trennen"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
}

function AddChannelPanel({
  platform,
  onAdd,
}: {
  platform: LivePlatform;
  onAdd: (platform: LivePlatform, channel: string) => Promise<string | null>;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = PLATFORM_COPY[platform];
  const normalised = normaliseChannel(value, platform);
  const touched = value.trim().length > 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalised || sending) return;
    setSending(true);
    setError(null);
    try {
      const refusal = await onAdd(platform, normalised);
      if (refusal) setError(refusal);
      else setValue("");
    } finally {
      setSending(false);
    }
  };

  return (
    <Panel padding="sm" className="gap-2">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <span className="text-micro font-semibold text-muted-foreground">
          {`${PLATFORM_NAMES[platform]} dazunehmen`}
        </span>
        <Label htmlFor={`${id}-channel`}>{copy.label}</Label>
        <Input
          id={`${id}-channel`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
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
              : `Dann raten beide Chats auf diesem Brett. ${platform === "tiktok" ? TIKTOK_NOTE : ""}`}
        </p>
        {error && <p className="text-micro text-destructive">{error}</p>}
        <Button type="submit" variant="outline" size="sm" disabled={!normalised || sending}>
          <Plus className="size-3.5" aria-hidden />
          {sending ? "Verbindet …" : "Verbinden"}
        </Button>
      </form>
    </Panel>
  );
}
