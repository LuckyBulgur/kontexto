"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import GuessBar from "@/components/GuessBar";
import { Panel } from "@/components/admin/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminLiveStreams, sendHostMessage } from "@/lib/api";
import { formatNumber, formatStamp } from "@/lib/format";
import type { AdminLiveStream, AdminLiveStreams } from "@/lib/types";

/**
 * Every live-chat round running right now, and a line to send its streamer.
 *
 * Polls on its own, because the stats payload is a one-shot snapshot and a
 * stream changes by the second. The poll pauses while the tab is hidden: a
 * dashboard left open overnight should not keep reading the database.
 *
 * A note lands on the streamer's host page only, never on the OBS overlay
 * (see components/live/HostMessageBanner.tsx), so it is safe to write
 * something meant for them alone.
 */

const POLL_MS = 5000;

/** Mirrors live_chat.HOST_MESSAGE_MAX_CHARS; the server has the last word. */
const MAX_CHARS = 280;

const PLATFORM_NAMES: Record<AdminLiveStream["platform"], string> = {
  twitch: "Twitch",
  tiktok: "TikTok",
};

const CHAT_STATE_LABELS: Record<AdminLiveStream["chat_state"], string> = {
  connecting: "verbindet",
  live: "Chat verbunden",
  error: "Chat getrennt",
};

const SEND_ERRORS: Record<string, string> = {
  bad_message: `Die Nachricht muss 1 bis ${MAX_CHARS} Zeichen haben.`,
  room_not_found: "Dieser Stream läuft nicht mehr.",
  too_many_pending: "Der Stream hat die letzten Nachrichten noch nicht angezeigt.",
  unauthorized: "Die Anmeldung ist abgelaufen. Bitte neu anmelden.",
};

function channelUrl(stream: AdminLiveStream): string {
  return stream.platform === "tiktok"
    ? `https://www.tiktok.com/@${encodeURIComponent(stream.channel)}/live`
    : `https://www.twitch.tv/${encodeURIComponent(stream.channel)}`;
}

/** "18:04" in Berlin time, the part of a stamp that matters within one evening. */
function clockTime(iso: string | null): string {
  if (!iso) return "k. A.";
  const stamp = formatStamp(iso);
  const match = /(\d{2}:\d{2}) Uhr$/.exec(stamp);
  return match ? match[1] : stamp;
}

function roundState(stream: AdminLiveStream): string {
  if (stream.solved) return "gelöst";
  if (stream.gave_up) return "aufgegeben";
  return stream.best_rank === null ? "noch kein Treffer" : `bester Rang ${formatNumber(stream.best_rank)}`;
}

export default function LiveStreams({ token }: { token: string }) {
  const [data, setData] = useState<AdminLiveStreams | null>(null);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await getAdminLiveStreams(token);
      setData(next);
      setStale(false);
    } catch {
      // Keep the last list on screen and say it is old, rather than blanking
      // a view the operator is in the middle of typing into.
      setStale(true);
    }
  }, [token]);

  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      if (timer !== undefined) return;
      void load();
      timer = window.setInterval(() => void load(), POLL_MS);
    };
    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };
    const sync = () => (document.visibilityState === "visible" ? start() : stop());
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      stop();
    };
  }, [load]);

  if (!data) {
    return (
      <Panel>
        <p className="text-small text-muted-foreground">
          {stale ? "Die Streams konnten nicht geladen werden." : "Lädt …"}
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {stale && (
        <p className="text-small text-destructive">
          {"Keine Verbindung zum Server. Die Liste zeigt den letzten Stand."}
        </p>
      )}
      {data.streams.length === 0 ? (
        <Panel>
          <p className="text-small text-muted-foreground">{"Gerade läuft kein Stream."}</p>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.streams.map((stream) => (
            <StreamCard key={stream.koop_id} stream={stream} token={token} onSent={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function StreamCard({
  stream,
  token,
  onSent,
}: {
  stream: AdminLiveStream;
  token: string;
  onSent: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const trimmed = text.trim();
  const inputId = `host-message-${stream.koop_id}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendHostMessage(token, stream.koop_id, trimmed);
      setText("");
      toast.success(`Nachricht an ${stream.channel} gesendet`);
      await onSent();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      toast.error(SEND_ERRORS[code] ?? "Die Nachricht konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={channelUrl(stream)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-display text-h3 font-bold text-foreground underline-offset-4 hover:underline"
          >
            <span className="truncate">{stream.channel}</span>
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">{`auf ${PLATFORM_NAMES[stream.platform]} öffnen`}</span>
          </a>
          <p className="text-small text-muted-foreground">
            {`${PLATFORM_NAMES[stream.platform]}, läuft seit ${clockTime(stream.created_at)} Uhr, zuletzt aktiv ${clockTime(stream.last_activity)} Uhr`}
          </p>
        </div>
        <Badge variant={stream.chat_state === "live" ? "secondary" : "outline"}>
          {CHAT_STATE_LABELS[stream.chat_state]}
        </Badge>
      </div>

      <p className="text-small text-foreground">
        {`Runde ${formatNumber(stream.round)}, ${roundState(stream)}, ${formatNumber(stream.guesses)} Wörter, ${formatNumber(stream.viewers)} Mitspieler im Chat`}
      </p>

      {stream.recent_guesses.length > 0 && (
        <ol className="flex list-none flex-col gap-1.5" aria-label="Letzte Wörter">
          {stream.recent_guesses.map((guess) => (
            <li key={`${guess.word}-${guess.rank}`}>
              <GuessBar word={guess.word} rank={guess.rank} by={guess.nickname} />
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-small font-medium text-foreground">
          {"Nachricht an den Streamer"}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={text}
            maxLength={MAX_CHARS}
            placeholder="Danke für den Stream!"
            autoComplete="off"
            onChange={(event) => setText(event.target.value)}
            aria-describedby={`${inputId}-hint`}
          />
          <Button type="submit" disabled={!trimmed || sending}>
            <Send className="size-4" aria-hidden />
            {"Senden"}
          </Button>
        </div>
        <p id={`${inputId}-hint`} className="text-micro text-muted-foreground">
          {`Erscheint oben auf der Spielseite des Streamers, nicht im Stream selbst. ${text.length}/${MAX_CHARS}`}
        </p>
      </form>

      {stream.messages.length > 0 && (
        <ul className="flex list-none flex-col gap-1 text-small" aria-label="Gesendete Nachrichten">
          {stream.messages.map((message) => (
            <li key={message.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words text-foreground">{message.text}</span>
              <span className="shrink-0 text-micro text-muted-foreground">
                {message.seen_at
                  ? `angekommen ${clockTime(message.seen_at)} Uhr`
                  : `wartet seit ${clockTime(message.sent_at)} Uhr`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
