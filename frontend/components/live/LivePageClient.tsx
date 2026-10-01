"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import KoopPageClient from "@/components/koop/KoopPageClient";
import KoopSkeleton from "@/components/koop/KoopSkeleton";
import ChatIdentity from "@/components/live/ChatIdentity";
import HostMessageBanner from "@/components/live/HostMessageBanner";
import LiveCreateClient from "@/components/live/LiveCreateClient";
import LiveStatus from "@/components/live/LiveStatus";
import SupportToasts from "@/components/live/SupportToasts";
import RoomLanding from "@/components/RoomLanding";
import { needsAckRetry } from "@/lib/host-messages";
import { freshEvents, mergeFeed } from "@/lib/live-events";
import {
  addLiveChannel,
  fetchLivePlatforms,
  getLiveRoom,
  LiveApiError,
  markHostMessagesSeen,
  removeLiveChannel,
  setLiveChannelPaused,
} from "@/lib/live-api";
import { STOP_HINT } from "@/lib/live-copy";
import {
  LIVE_PLATFORMS,
  type LiveEvent,
  type LivePlatform,
  type LiveRoom,
  PLATFORM_NAMES,
} from "@/lib/live-types";
import type { Guess } from "@/lib/types";

const EMPTY_BOARDS = { busy: [], sharp: [], finders: [] };

/** "3 Wörter", "1 Wort, 1 gefunden": one line per viewer on the result card. */
function viewerSummary(hits: number, solves: number): string {
  const words = `${hits} ${hits === 1 ? "Wort" : "Wörter"}`;
  return solves > 0 ? `${words}, ${solves} gefunden` : words;
}

function asPlatform(source: string | null | undefined): LivePlatform | null {
  return LIVE_PLATFORMS.find((platform) => platform === source) ?? null;
}

/** What the add form says when the server refuses a second chat. */
function addRefusal(error: unknown, platform: LivePlatform): string {
  const code = error instanceof Error ? error.message : "";
  const name = PLATFORM_NAMES[platform];
  if (code === "channel_busy") return `Für diesen Kanal läuft schon eine Runde. ${STOP_HINT}`;
  if (code === "bad_channel") return `Diesen Kanalnamen gibt es auf ${name} nicht.`;
  if (code === "platform_bound") return `Diese Runde liest schon einen ${name}-Chat.`;
  if (code === "platform_full") {
    return "Gerade laufen zu viele TikTok-Runden gleichzeitig. Versuch es in ein paar Minuten noch mal.";
  }
  if (code === "platform_unavailable") return `${name} ist gerade nicht angebunden.`;
  if (code === "room_not_found") return "Die Stream-Runde wurde beendet.";
  return "Der Chat konnte nicht verbunden werden.";
}

/**
 * The one page behind /live/.
 *
 * Without a room id in the path it is the create form; with one it is the koop
 * board plus the chat sidebar. Both live here because the static export renders
 * one page per route and nginx falls back to it for /live/<id>/, the same way
 * the koop and duel routes work.
 *
 * The board itself is `KoopPageClient`, unchanged: a live room is a koop room,
 * so the round, the shared list, the ranks and the reveal are already right. The
 * chat is a second way into the same list, not a second game.
 */

function getRoomIdFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[0] === "live") {
    return segments[1];
  }
  return null;
}

/** How often the host's status line and leaderboard are refreshed.
 *
 * Three seconds, not five: the leaderboard moves with every chat guess, and a
 * board that updates in step with the list beside it reads as one thing. The
 * connection status is the other reason, since it can take the reader a few
 * seconds to join a channel and the streamer is watching that line. */
const POLL_MS = 3000;

export default function LivePageClient() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [stale, setStale] = useState(false);
  // The chat no longer counts. The board stays playable and revealable, only
  // the chat panel says so.
  const [ended, setEnded] = useState(false);
  const [checked, setChecked] = useState(false);
  // What the server can read right now, so the sidebar offers only a second
  // chat that could actually connect.
  const [available, setAvailable] = useState<LivePlatform[]>([]);
  // The highest operator note this page has put on screen. Confirmations are
  // cumulative, so one number is enough to resend a lost one.
  const shownUpTo = useRef(0);
  // The newest paid event this page holds. 0 until the first poll answers;
  // that first answer fills the feed and plays no toast, because a host who
  // reopens the page should not get the last hour played back.
  const eventCursor = useRef(0);
  const [feed, setFeed] = useState<LiveEvent[]>([]);
  const [celebrate, setCelebrate] = useState<LiveEvent[]>([]);

  useEffect(() => {
    const id = getRoomIdFromPath();
    setRoomId(id);
    // Only the streamer has a token for this room, and nobody else is meant to
    // have one: a live round has exactly one person at the keyboard and the
    // rest in the chat. The room URL is on screen during a stream, so viewers
    // will open it; they are sent to the mode rather than into a board they
    // cannot use.
    setIsHost(Boolean(id && localStorage.getItem(`kontexto_koop_${id}`)));
    setChecked(true);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const token = localStorage.getItem(`kontexto_koop_${roomId}`);
    if (!token) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      try {
        const first = eventCursor.current === 0;
        const next = await getLiveRoom(roomId, token, Math.max(0, eventCursor.current));
        if (cancelled) return;
        setRoom(next);
        setStale(false);
        const incoming = freshEvents(next.events ?? [], eventCursor.current);
        if (incoming.length > 0) {
          eventCursor.current = incoming[incoming.length - 1].id;
          setFeed((current) => mergeFeed(current, incoming));
          if (!first) setCelebrate(incoming);
        } else if (first) {
          // Nothing yet: from here on every event is new and celebrated.
          eventCursor.current = -1;
        }
        if (needsAckRetry(next.messages, shownUpTo.current)) {
          markHostMessagesSeen(roomId, token, shownUpTo.current).catch(() => {
            // Sent again after the next poll; the banner will not repeat it.
          });
        }
      } catch (error) {
        if (cancelled) return;
        // The host holds the room's token, so a 404 cannot mean "not yours":
        // the chat binding was ended, by the operator or by the host's own
        // stop. That is final, so the page stops asking.
        if (error instanceof Error && error.message === "room_not_found") {
          setEnded(true);
          clearInterval(timer);
          return;
        }
        // Keep the last known panel and mark it stale instead of dropping it.
        // Clearing it swapped the whole chat sidebar for the ordinary koop
        // player list, so a backend that went away for ten seconds looked like
        // a mode that had never been there. The round itself is unaffected.
        setStale(true);
      }
    };
    load();
    timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !isHost) return;
    let cancelled = false;
    fetchLivePlatforms()
      .then((platforms) => {
        if (!cancelled) setAvailable(platforms);
      })
      .catch(() => {
        // No offer to add a chat; the chats the room reads are unaffected.
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, isHost]);

  /** Runs one chat change and shows the room the server answers with. */
  const changeChats = useCallback(
    async (action: (koopId: string, token: string) => Promise<LiveRoom>): Promise<void> => {
      if (!roomId) return;
      const token = localStorage.getItem(`kontexto_koop_${roomId}`);
      if (!token) return;
      setRoom(await action(roomId, token));
      setStale(false);
    },
    [roomId]
  );

  const handleAdd = useCallback(
    async (platform: LivePlatform, channel: string): Promise<string | null> => {
      try {
        await changeChats((id, token) => addLiveChannel(id, token, platform, channel));
        toast.success(`${PLATFORM_NAMES[platform]}-Chat verbunden`);
        return null;
      } catch (error) {
        if (error instanceof LiveApiError && error.message === "platform_unavailable") {
          setAvailable((current) => current.filter((p) => p !== platform));
        }
        if (error instanceof LiveApiError && error.message === "room_not_found") setEnded(true);
        return addRefusal(error, platform);
      }
    },
    [changeChats]
  );

  const handleRemove = useCallback(
    async (platform: LivePlatform) => {
      try {
        await changeChats((id, token) => removeLiveChannel(id, token, platform));
        toast.success(`${PLATFORM_NAMES[platform]}-Chat getrennt`);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (code === "room_not_found") setEnded(true);
        toast.error(
          code === "last_channel"
            ? "Die Runde braucht mindestens einen Chat."
            : "Der Chat konnte nicht getrennt werden."
        );
      }
    },
    [changeChats]
  );

  const handlePause = useCallback(
    async (platform: LivePlatform, paused: boolean) => {
      try {
        await changeChats((id, token) => setLiveChannelPaused(id, token, platform, paused));
        toast.success(
          paused
            ? `${PLATFORM_NAMES[platform]}-Chat pausiert`
            : `${PLATFORM_NAMES[platform]}-Chat rät wieder mit`
        );
      } catch (error) {
        if (error instanceof Error && error.message === "room_not_found") setEnded(true);
        toast.error(
          paused ? "Der Chat konnte nicht pausiert werden." : "Der Chat konnte nicht fortgesetzt werden."
        );
      }
    },
    [changeChats]
  );

  const handleMessageShown = useCallback(
    (id: number) => {
      if (!roomId) return;
      const token = localStorage.getItem(`kontexto_koop_${roomId}`);
      if (!token) return;
      shownUpTo.current = Math.max(shownUpTo.current, id);
      markHostMessagesSeen(roomId, token, shownUpTo.current).catch(() => {
        // The next poll still carries it, and that is what triggers the retry.
      });
    },
    [roomId]
  );

  const catalog = room?.badge_catalog ?? {};

  const renderBy = useCallback(
    (guess: Guess) => {
      const platform = asPlatform(guess.source);
      // The host at the keyboard has no chat and no badges: the plain name.
      if (!platform) return guess.by;
      return (
        <ChatIdentity
          name={guess.by ?? ""}
          platform={platform}
          badges={guess.badges}
          catalog={catalog}
          size={guess.rank === 1 ? "lg" : "sm"}
          nameClassName={guess.rank === 1 ? "font-bold text-rank-foreground" : undefined}
          className="align-middle"
        />
      );
    },
    [catalog]
  );

  const renderFinder = useCallback(
    (solvedBy: string, winning: Guess | undefined) => (
      <div data-testid="live-finder" className="flex flex-col items-center gap-1 text-center">
        <span className="text-small text-muted-foreground">{"Gefunden von"}</span>
        <ChatIdentity
          name={solvedBy}
          platform={asPlatform(winning?.source)}
          badges={winning?.badges}
          catalog={catalog}
          size="lg"
          nameClassName="font-display text-h1 font-bold text-foreground"
          className="max-w-full justify-center"
        />
      </div>
    ),
    [catalog]
  );

  if (!checked) return <KoopSkeleton />;
  if (!roomId) return <LiveCreateClient />;
  if (!isHost) {
    return (
      <RoomLanding
        title="Diese Runde gehört zu einem Stream"
        description="Mitraten geht im Chat des Kanals, nicht auf dieser Seite. Du kannst aber selbst eine Runde für deinen eigenen Stream starten."
        createHref="/live/"
        createLabel="Eigene Runde starten"
        note={`Ist das deine Runde und du kommst hier nicht mehr rein? ${STOP_HINT}`}
      />
    );
  }

  return (
    <>
      <HostMessageBanner messages={room?.messages ?? []} onShown={handleMessageShown} />
      <SupportToasts events={celebrate} catalog={catalog} />
      <KoopPageClient
        basePath="live"
        label="Stream-Chat"
        showInvite={false}
        shareable={false}
        createHref="/live/"
        showNames
        sidebarBelowOnMobile
        centerBoard
        arrivalEffects
        renderBy={renderBy}
        renderFinder={renderFinder}
        notFoundMessage="Diese Runde gibt es nicht"
        tipsDisabledMessage="Tipps sind in dieser Runde ausgeschaltet"
        giveUpDescription="Bist du sicher? Das Lösungswort steht danach auf dem Brett, also auch im Stream. Danach kannst du eine nächste Runde starten."
        resultLabel="Stream-Chat"
        resultGroupNoun="aus dem Chat"
        resultRows={(room?.boards?.busy ?? room?.top ?? []).map((viewer) => ({
          name: viewer.nickname,
          detail: viewerSummary(viewer.hits, viewer.solves),
          label: (
            <ChatIdentity
              name={viewer.nickname}
              platform={viewer.platform}
              badges={viewer.badges}
              catalog={catalog}
            />
          ),
        }))}
        sidebar={
          room ? (
            <LiveStatus
              channels={room.channels}
              notice={
                ended
                  ? "Die Stream-Runde wurde beendet. Der Chat rät nicht mehr mit, das Wort kannst du hier noch auflösen."
                  : stale
                    ? "Keine Verbindung zum Server. Die Runde läuft weiter."
                    : null
              }
              requirePrefix={room.require_prefix}
              boards={room.boards ?? EMPTY_BOARDS}
              feed={feed}
              catalog={catalog}
              addable={available.filter(
                (platform) => !room.channels.some((c) => c.platform === platform)
              )}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onPause={handlePause}
            />
          ) : null
        }
      />
    </>
  );
}
