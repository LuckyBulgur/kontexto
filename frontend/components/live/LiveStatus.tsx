"use client";

import { useId, useState, type FormEvent } from "react";
import { HandCoins, Pause, Play, Plus, Radio, Trophy, Unplug } from "lucide-react";
import { Panel } from "@/components/design";
import ChannelBusyNotice from "@/components/live/ChannelBusyNotice";
import ChatIdentity from "@/components/live/ChatIdentity";
import PlatformMark from "@/components/live/PlatformMark";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { channelAddress, channelLabel, normaliseChannel } from "@/lib/live-channel";
import { CHANNEL_BUSY_COPY, PLATFORM_COPY, STOP_HINT_AHEAD } from "@/lib/live-copy";
import { eventAction, eventDetail } from "@/lib/live-events";
import {
  ChatState, LiveBadgeCatalog, LiveBoardId, LiveChannel, LiveEvent, LivePlatform, LiveViewer,
  LiveViewerBoards, PLATFORM_NAMES,
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
  boards: LiveViewerBoards;
  /** Paid support, newest first. */
  feed: LiveEvent[];
  catalog: LiveBadgeCatalog;
  /** Platforms the server offers that this room does not read yet. */
  addable: LivePlatform[];
  /** Resolves to a sentence for the form, or null when the chat was added. */
  onAdd: (platform: LivePlatform, channel: string) => Promise<AddRefusal | null>;
  onRemove: (platform: LivePlatform) => Promise<void>;
  onPause: (platform: LivePlatform, paused: boolean) => Promise<void>;
}

/**
 * The sidebar of a stream-chat room: which chats are read, what they have to
 * do, who is carrying the evening, and who supported the stream.
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
  boards,
  feed,
  catalog,
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
            removable={several && !locked}
            controllable={!locked}
            onRemove={onRemove}
            onPause={onPause}
          />
        ))}
        {notice && <p className="text-micro text-muted-foreground">{notice}</p>}
        <p className="text-micro text-muted-foreground/80">
          {`${several ? "Beide Chats raten mit" : "Dein Chat rät mit"}: ${
            requirePrefix ? "!k wort" : "jedes Wort zählt"
          }`}
        </p>
        {!locked && <p className="text-micro text-muted-foreground/80">{STOP_HINT_AHEAD}</p>}
      </Panel>

      {!locked &&
        addable.map((platform) => (
          <AddChannelPanel key={platform} platform={platform} onAdd={onAdd} />
        ))}

      <Leaderboards boards={boards} catalog={catalog} />

      <SupportFeed feed={feed} catalog={catalog} />
    </div>
  );
}

/** The three boards and what each one counts, in the order they are offered. */
const BOARDS: { id: LiveBoardId; label: string; empty: string; value: (v: LiveViewer) => string }[] = [
  {
    id: "busy",
    label: "Fleißig",
    empty: "Noch hat niemand geraten.",
    value: (v) => `${v.hits}`,
  },
  {
    id: "sharp",
    label: "Treffsicher",
    empty: "Noch kein Wort im grünen Bereich.",
    value: (v) => `${v.near_hits}`,
  },
  {
    id: "finders",
    label: "Wortfinder",
    empty: "Noch hat niemand ein Wort gefunden.",
    value: (v) => `${v.solves}`,
  },
];

const BOARD_HINT: Record<LiveBoardId, string> = {
  busy: "Gezählte Wörter",
  sharp: "Wörter bis Rang 300",
  finders: "Gefundene Lösungswörter",
};

/**
 * Who is carrying the evening, three ways: who plays most, who guesses close
 * most often, and who found the most words. All three over the whole stream.
 */
function Leaderboards({ boards, catalog }: { boards: LiveViewerBoards; catalog: LiveBadgeCatalog }) {
  return (
    <Panel padding="sm" className="gap-2">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-micro font-semibold text-muted-foreground">{"Bestenliste"}</span>
      </div>
      <Tabs defaultValue="busy" className="gap-2">
        <TabsList className="w-full">
          {BOARDS.map((board) => (
            <TabsTrigger key={board.id} value={board.id} className="flex-1 text-micro">
              {board.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {BOARDS.map((board) => {
          const rows = boards[board.id] ?? [];
          return (
            <TabsContent key={board.id} value={board.id} className="flex flex-col gap-1">
              <p className="text-micro text-muted-foreground/80">{BOARD_HINT[board.id]}</p>
              {rows.length === 0 ? (
                <p className="text-micro text-muted-foreground/80">{board.empty}</p>
              ) : (
                <ol className="flex list-none flex-col gap-1" data-testid={`board-${board.id}`}>
                  {rows.map((viewer, index) => (
                    <li
                      key={`${viewer.platform}-${viewer.nickname}-${index}`}
                      className="flex items-center justify-between gap-2 text-small"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <ChatIdentity
                          name={viewer.nickname}
                          platform={viewer.platform}
                          badges={viewer.badges}
                          catalog={catalog}
                        />
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {board.value(viewer)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </Panel>
  );
}

/**
 * Paid support, newest first: Bits, subscriptions, gifted subscriptions and
 * TikTok gifts. A list, never a ranking: who gave most is not a score here.
 */
function SupportFeed({ feed, catalog }: { feed: LiveEvent[]; catalog: LiveBadgeCatalog }) {
  return (
    <Panel padding="sm" className="gap-2">
      <div className="flex items-center gap-2">
        <HandCoins className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-micro font-semibold text-muted-foreground">{"Unterstützung"}</span>
      </div>
      {feed.length === 0 ? (
        <p className="text-micro text-muted-foreground/80">
          {"Bits, Abos und TikTok-Geschenke erscheinen hier und mit Konfetti unter dem Brett."}
        </p>
      ) : (
        <ol className="flex list-none flex-col gap-1.5" data-testid="support-feed">
          {feed.map((event) => {
            const detail = eventDetail(event);
            return (
              <li key={event.id} className="flex flex-col text-small">
                <ChatIdentity
                  name={event.actor}
                  platform={event.platform}
                  badges={event.badges}
                  catalog={catalog}
                  nameClassName="font-semibold"
                />
                <span className="text-micro text-muted-foreground">
                  {detail ? `${eventAction(event)}, ${detail}` : eventAction(event)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function ChannelRow({
  channel,
  notice,
  removable,
  controllable,
  onRemove,
  onPause,
}: {
  channel: LiveChannel;
  notice: string | null;
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
        <PlatformMark platform={channel.platform} className="ml-auto" />
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

/** Why a chat could not be added: a bound channel, or anything else in a sentence. */
export type AddRefusal = { busy: true } | { busy: false; message: string };

function AddChannelPanel({
  platform,
  onAdd,
}: {
  platform: LivePlatform;
  onAdd: (platform: LivePlatform, channel: string) => Promise<AddRefusal | null>;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const copy = PLATFORM_COPY[platform];
  const normalised = normaliseChannel(value, platform);
  const touched = value.trim().length > 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalised || sending) return;
    setSending(true);
    setError(null);
    setBusy(false);
    try {
      const refusal = await onAdd(platform, normalised);
      if (refusal?.busy) setBusy(true);
      else if (refusal) setError(refusal.message);
      else setValue("");
    } finally {
      setSending(false);
    }
  };

  // A bound channel is not an error line: the way out is a word in the
  // streamer's own chat, and it is said where it cannot be read past.
  if (busy) {
    return (
      <ChannelBusyNotice
        platform={platform}
        state="static"
        footnote={CHANNEL_BUSY_COPY.addChat}
        onCancel={() => setBusy(false)}
      />
    );
  }

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
              : "Dann raten beide Chats auf diesem Brett."}
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
