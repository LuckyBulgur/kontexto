"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import KoopPageClient from "@/components/koop/KoopPageClient";
import KoopSkeleton from "@/components/koop/KoopSkeleton";
import HostMessageBanner from "@/components/live/HostMessageBanner";
import LiveCreateClient from "@/components/live/LiveCreateClient";
import LiveStatus from "@/components/live/LiveStatus";
import RoomLanding from "@/components/RoomLanding";
import { copyTextToClipboard } from "@/lib/clipboard";
import { needsAckRetry } from "@/lib/host-messages";
import { getLiveRoom, markHostMessagesSeen } from "@/lib/live-api";
import { LiveRoom } from "@/lib/live-types";

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
  if (segments.length >= 2 && segments[0] === "live" && segments[1] !== "overlay") {
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
  // The highest operator note this page has put on screen. Confirmations are
  // cumulative, so one number is enough to resend a lost one.
  const shownUpTo = useRef(0);

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
        const next = await getLiveRoom(roomId, token);
        if (cancelled) return;
        setRoom(next);
        setStale(false);
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

  const handleCopyOverlay = useCallback(async () => {
    if (!room) return;
    const url = `${window.location.origin}/live/overlay/?token=${encodeURIComponent(
      room.overlay_token
    )}`;
    const ok = await copyTextToClipboard(url);
    if (ok) toast.success("Link für OBS kopiert");
    else prompt("Link kopieren:", url);
  }, [room]);

  if (!checked) return <KoopSkeleton />;
  if (!roomId) return <LiveCreateClient />;
  if (!isHost) {
    return (
      <RoomLanding
        title="Diese Runde gehört zu einem Stream"
        description="Mitraten geht im Chat des Kanals, nicht auf dieser Seite. Du kannst aber selbst eine Runde für deinen eigenen Stream starten."
        createHref="/live/"
        createLabel="Eigene Runde starten"
      />
    );
  }

  return (
    <>
      <HostMessageBanner messages={room?.messages ?? []} onShown={handleMessageShown} />
      <KoopPageClient
        basePath="live"
        label="Stream-Chat"
        showInvite={false}
        shareable={false}
        createHref="/live/"
        showNames
        notFoundMessage="Diese Runde gibt es nicht"
        tipsDisabledMessage="Tipps sind in dieser Runde ausgeschaltet"
        giveUpDescription="Bist du sicher? Das Lösungswort steht danach auf dem Brett und in der Einblendung, also auch im Stream. Danach kannst du eine nächste Runde starten."
        resultLabel="Stream-Chat"
        resultGroupNoun="aus dem Chat"
        resultRows={(room?.top ?? []).map((viewer) => ({
          name: viewer.nickname,
          detail: `${viewer.hits} Treffer`,
        }))}
        sidebar={
          room ? (
            <LiveStatus
              channel={room.channel}
              platform={room.platform}
              chatState={ended || stale ? "error" : room.chat_state}
              chatError={
                ended
                  ? "Die Stream-Runde wurde beendet. Der Chat rät nicht mehr mit, das Wort kannst du hier noch auflösen."
                  : stale
                    ? "Keine Verbindung zum Server. Die Runde läuft weiter."
                    : room.chat_error
              }
              requirePrefix={room.require_prefix}
              top={room.top}
              overlayUrl={room.overlay_token}
              onCopyOverlay={handleCopyOverlay}
            />
          ) : null
        }
      />
    </>
  );
}
